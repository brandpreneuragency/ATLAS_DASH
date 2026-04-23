import { saveAs } from 'file-saver';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';
import type { Document } from '../types';

function htmlToText(html: string): string {
  const div = window.document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? '';
}

function jsonContentToDocxParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  try {
    const json = JSON.parse(content);
    const nodes = json.content ?? [];

    for (const node of nodes) {
      if (node.type === 'heading') {
        const level = node.attrs?.level ?? 1;
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        const headingMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
        };
        paragraphs.push(new Paragraph({ text, heading: headingMap[level] ?? HeadingLevel.HEADING_1 }));
      } else if (node.type === 'paragraph') {
        const runs = (node.content ?? []).map((inline: { type: string; text?: string; marks?: { type: string }[] }) => {
          const marks = inline.marks ?? [];
          return new TextRun({
            text: inline.text ?? '',
            bold: marks.some((m) => m.type === 'bold'),
            italics: marks.some((m) => m.type === 'italic'),
            underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
            strike: marks.some((m) => m.type === 'strike'),
          });
        });
        paragraphs.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun('')] }));
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        for (const item of node.content ?? []) {
          const text = (item.content?.[0]?.content ?? [])
            .map((n: { text?: string }) => n.text ?? '')
            .join('');
          paragraphs.push(new Paragraph({ text: `• ${text}` }));
        }
      }
    }
  } catch {
    paragraphs.push(new Paragraph({ text: htmlToText(content) }));
  }
  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })];
}

export async function exportDocx(doc: Document) {
  const paragraphs = jsonContentToDocxParagraphs(doc.content);
  const docx = new DocxDocument({
    sections: [{ properties: {}, children: paragraphs }],
  });
  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${doc.title}.docx`);
}

export async function exportPdf(doc: Document) {
  // Dynamically import html2pdf to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default;
  const div = window.document.createElement('div');
  div.style.fontFamily = 'Inter, sans-serif';
  div.style.padding = '40px';
  div.style.maxWidth = '800px';

  try {
    const json = JSON.parse(doc.content);
    // Convert TipTap JSON to simple HTML for pdf rendering
    let html = `<h1>${doc.title}</h1>`;
    for (const node of json.content ?? []) {
      if (node.type === 'heading') {
        const level = node.attrs?.level ?? 1;
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        html += `<h${level}>${text}</h${level}>`;
      } else if (node.type === 'paragraph') {
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        html += `<p>${text}</p>`;
      }
    }
    div.innerHTML = html;
  } catch {
    div.innerHTML = `<h1>${doc.title}</h1><p>${htmlToText(doc.content)}</p>`;
  }

  window.document.body.appendChild(div);
  await html2pdf().from(div).set({
    margin: 10,
    filename: `${doc.title}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).save();
  window.document.body.removeChild(div);
}

export function serializeMdString(content: string): string {
  let md = '';
  try {
    const json = JSON.parse(content);
    for (const node of json.content ?? []) {
      if (node.type === 'heading') {
        const level = node.attrs?.level ?? 1;
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        md += `${'#'.repeat(level)} ${text}\n\n`;
      } else if (node.type === 'paragraph') {
        const text = (node.content ?? []).map((inline: { text?: string; marks?: { type: string }[] }) => {
          let t = inline.text ?? '';
          const marks = inline.marks ?? [];
          if (marks.some((m) => m.type === 'bold')) t = `**${t}**`;
          if (marks.some((m) => m.type === 'italic')) t = `*${t}*`;
          if (marks.some((m) => m.type === 'code')) t = `\`${t}\``;
          return t;
        }).join('');
        md += `${text}\n\n`;
      } else if (node.type === 'bulletList') {
        for (const item of node.content ?? []) {
          const text = (item.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
          md += `- ${text}\n`;
        }
        md += '\n';
      } else if (node.type === 'orderedList') {
        (node.content ?? []).forEach((item: { content?: { content?: { text?: string }[] }[] }, i: number) => {
          const text = (item.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
          md += `${i + 1}. ${text}\n`;
        });
        md += '\n';
      } else if (node.type === 'blockquote') {
        const text = (node.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        md += `> ${text}\n\n`;
      } else if (node.type === 'codeBlock') {
        const lang = node.attrs?.language ?? '';
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        md += `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
      }
    }
  } catch {
    md += htmlToText(content);
  }
  return md;
}

export function exportMd(doc: Document) {
  const md = `# ${doc.title}\n\n` + serializeMdString(doc.content);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${doc.title}.md`);
}

export function exportHtml(doc: Document) {
  let body = '';
  try {
    const json = JSON.parse(doc.content);
    for (const node of json.content ?? []) {
      if (node.type === 'heading') {
        const level = node.attrs?.level ?? 1;
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        body += `<h${level}>${text}</h${level}>\n`;
      } else if (node.type === 'paragraph') {
        const text = (node.content ?? []).map((inline: { text?: string; marks?: { type: string }[] }) => {
          let t = inline.text ?? '';
          const marks = inline.marks ?? [];
          if (marks.some((m) => m.type === 'bold')) t = `<strong>${t}</strong>`;
          if (marks.some((m) => m.type === 'italic')) t = `<em>${t}</em>`;
          if (marks.some((m) => m.type === 'underline')) t = `<u>${t}</u>`;
          if (marks.some((m) => m.type === 'code')) t = `<code>${t}</code>`;
          return t;
        }).join('');
        body += `<p>${text}</p>\n`;
      } else if (node.type === 'bulletList') {
        body += '<ul>\n';
        for (const item of node.content ?? []) {
          const text = (item.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
          body += `  <li>${text}</li>\n`;
        }
        body += '</ul>\n';
      } else if (node.type === 'orderedList') {
        body += '<ol>\n';
        for (const item of node.content ?? []) {
          const text = (item.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
          body += `  <li>${text}</li>\n`;
        }
        body += '</ol>\n';
      } else if (node.type === 'blockquote') {
        const text = (node.content?.[0]?.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        body += `<blockquote>${text}</blockquote>\n`;
      } else if (node.type === 'codeBlock') {
        const text = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        body += `<pre><code>${text}</code></pre>\n`;
      }
    }
  } catch {
    body = `<p>${htmlToText(doc.content)}</p>`;
  }
  const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${doc.title}</title>\n</head>\n<body>\n<h1>${doc.title}</h1>\n${body}</body>\n</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${doc.title}.html`);
}

export function exportTxt(doc: Document) {
  let text = '';
  try {
    const json = JSON.parse(doc.content);
    for (const node of json.content ?? []) {
      if (node.type === 'heading' || node.type === 'paragraph') {
        const line = (node.content ?? []).map((n: { text?: string }) => n.text ?? '').join('');
        text += line + '\n\n';
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        for (const item of node.content ?? []) {
          const line = (item.content?.[0]?.content ?? [])
            .map((n: { text?: string }) => n.text ?? '')
            .join('');
          text += `• ${line}\n`;
        }
        text += '\n';
      }
    }
  } catch {
    text = htmlToText(doc.content);
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${doc.title}.txt`);
}
