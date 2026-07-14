import { serializeMdString } from './export';

export const SUPPORTED_EXTENSIONS = ['md', 'markdown', 'txt', 'doc', 'json', 'mjs', 'cjs', 'js', 'ts', 'tsx', 'jsx', 'env', 'local', 'gitignore', 'yaml', 'yml', 'toml', 'html', 'htm', 'css', 'scss', 'xml', 'csv'];

export const TEXT_AS_IS_EXTENSIONS = new Set(['mjs', 'cjs', 'js', 'ts', 'tsx', 'jsx', 'env', 'local', 'gitignore', 'yaml', 'yml', 'toml', 'html', 'htm', 'css', 'scss', 'xml', 'csv']);

function mdNodeFromLines(lines: string[]): object[] {
  const nodes: object[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'codeBlock', attrs: { language: lang || null }, content: [{ type: 'text', text: codeLines.join('\n') }] });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      nodes.push({ type: 'heading', attrs: { level: headingMatch[1].length }, content: [{ type: 'text', text: headingMatch[2] }] });
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      const text = line.slice(2);
      nodes.push({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
      i++;
      continue;
    }

    if (/^[-*+]\s/.test(line)) {
      const items: object[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: lines[i].slice(2) }] }] });
        i++;
      }
      nodes.push({ type: 'bulletList', content: items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: object[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: lines[i].replace(/^\d+\.\s/, '') }] }] });
        i++;
      }
      nodes.push({ type: 'orderedList', content: items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    nodes.push({ type: 'paragraph', content: parseInline(line) });
    i++;
  }

  return nodes;
}

function parseInline(text: string): object[] {
  const parts: object[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('`')) {
      parts.push({ type: 'text', text: raw.slice(1, -1), marks: [{ type: 'code' }] });
    } else if (raw.startsWith('**')) {
      parts.push({ type: 'text', text: raw.slice(2, -2), marks: [{ type: 'bold' }] });
    } else {
      parts.push({ type: 'text', text: raw.slice(1, -1), marks: [{ type: 'italic' }] });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts.length > 0 ? parts : [{ type: 'text', text }];
}

export function parseMarkdown(text: string): object {
  const lines = text.split('\n');
  const content = mdNodeFromLines(lines);
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

export function parseTxt(text: string): object {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  const content = blocks.length > 0
    ? blocks.map((block) => ({ type: 'paragraph', content: [{ type: 'text', text: block.replace(/\n/g, ' ').trim() }] }))
    : [{ type: 'paragraph' }];
  return { type: 'doc', content };
}

export function parseJson(text: string): object {
  const result = JSON.parse(text);
  if (result?.type === 'doc') return result;
  throw new Error('Not a valid TipTap document');
}

export function parseByExt(text: string, ext: string): object {
  if (ext === 'md' || ext === 'markdown') return parseMarkdown(text);
  if (ext === 'txt' || ext === 'doc') return parseTxt(text);
  if (ext === 'json') {
    try { return parseJson(text); } catch { return parseTxt(text); }
  }
  if (TEXT_AS_IS_EXTENSIONS.has(ext)) return parseTxt(text);
  throw new Error(`Unsupported extension: ${ext}`);
}

export function serialize(json: object, ext: string): string {
  if (ext === 'md' || ext === 'markdown') return serializeMdString(JSON.stringify(json));
  if (ext === 'txt' || ext === 'doc') {
    const doc = json as { content?: Array<{ content?: Array<{ text?: string }> }> };
    return (doc.content ?? [])
      .map((n) => (n.content ?? []).map((c) => c.text ?? '').join(''))
      .join('\n\n');
  }
  return JSON.stringify(json, null, 2);
}
