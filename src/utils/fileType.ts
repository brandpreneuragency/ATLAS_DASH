export type FileCategory = 'image' | 'video' | 'text' | 'code' | 'pdf' | 'other';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const CODE_EXTENSIONS = new Set(['js', 'ts', 'tsx', 'jsx', 'mjs', 'cjs', 'json', 'html', 'htm', 'css', 'scss', 'yaml', 'yml', 'toml', 'xml', 'csv', 'env', 'local', 'gitignore', 'sh', 'bash', 'zsh', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'hpp']);
const PDF_EXTENSIONS = new Set(['pdf']);

const ALL_TEXT_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...CODE_EXTENSIONS]);

export function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length < 2) return '';
  return parts.pop()?.toLowerCase() ?? '';
}

export function getFileCategory(name: string): FileCategory {
  const ext = getFileExtension(name);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'other';
}

export function isTextFile(name: string): boolean {
  const ext = getFileExtension(name);
  return ALL_TEXT_EXTENSIONS.has(ext);
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

export function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.has(getFileExtension(name));
}

export function isPdfFile(name: string): boolean {
  return PDF_EXTENSIONS.has(getFileExtension(name));
}

/** Returns true if the file can be opened in TipTap editor (text/code + images) */
export function canOpenInTipTap(name: string): boolean {
  return isTextFile(name) || isImageFile(name);
}
