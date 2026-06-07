import { useMemo } from 'react';
import { FileType, Download } from 'lucide-react';
import type { FileViewerItem } from '../../types';
import { getFileCategory } from '../../utils/fileType';
import type { FileCategory } from '../../utils/fileType';

interface FileViewerContentProps {
  file: FileViewerItem;
}

function FileViewerImage({ src, name }: { src: string; name: string }) {
  return (
    <div className="file-viewer-content-inner file-viewer-content-image">
      <img src={src} alt={name} />
    </div>
  );
}

function FileViewerVideo({ src, name }: { src: string; name: string }) {
  return (
    <div className="file-viewer-content-inner file-viewer-content-video">
      <video src={src} controls autoPlay>
        {name}
      </video>
    </div>
  );
}

function FileViewerPdf({ src, name }: { src: string; name: string }) {
  return (
    <div className="file-viewer-content-inner file-viewer-content-pdf">
      <iframe
        src={src}
        title={name}
        className="file-viewer-pdf-iframe"
      />
    </div>
  );
}

function FileViewerText({ dataUrl }: { dataUrl: string }) {
  const text = useMemo(() => {
    try {
      // Handle base64 data URLs
      if (dataUrl.startsWith('data:')) {
        const base64 = dataUrl.split(',')[1];
        return atob(base64);
      }
      // Plain text
      return dataUrl;
    } catch {
      return 'Could not decode file content.';
    }
  }, [dataUrl]);

  return (
    <div className="file-viewer-content-inner file-viewer-content-text">
      <pre className="file-viewer-pre">{text}</pre>
    </div>
  );
}

function FileViewerOther({ file }: { file: FileViewerItem }) {
  const href = file.dataUrl || file.path || '#';

  return (
    <div className="file-viewer-content-inner file-viewer-content-other">
      <div className="file-viewer-other-card">
        <FileType size={48} strokeWidth={1.5} />
        <span className="file-viewer-other-name">{file.name}</span>
        {file.size && <span className="file-viewer-other-size">{file.size}</span>}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="file-viewer-download-btn"
          download={file.name}
        >
          <Download size={14} />
          Download file
        </a>
      </div>
    </div>
  );
}

export function FileViewerContent({ file }: FileViewerContentProps) {
  const category: FileCategory = getFileCategory(file.name);

  // Build a usable src for media types
  const src = file.dataUrl || file.path || '';

  switch (category) {
    case 'image':
      return <FileViewerImage src={src} name={file.name} />;

    case 'video':
      return <FileViewerVideo src={src} name={file.name} />;

    case 'pdf':
      return <FileViewerPdf src={src} name={file.name} />;

    case 'text':
    case 'code':
      if (file.dataUrl) {
        return <FileViewerText dataUrl={file.dataUrl} />;
      }
      // If no dataUrl, fall through to download view
      return <FileViewerOther file={file} />;

    default:
      return <FileViewerOther file={file} />;
  }
}
