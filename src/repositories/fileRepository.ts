// File repository. The only module (other than `apiClient`) that knows the
// shape and URLs of the file endpoints.
//
// Stores call these methods. React components call stores. Components do
// not import this file.
//
// Endpoints (see plan.md § "File Service Requirements" and
// server/src/routes/files.ts):
//
//   GET    /api/files/:fileId/content   → streams the file
//   DELETE /api/files/:fileId           → soft-delete DB row + remove bytes
//
// File upload is owned by `commentRepository.createWithFile` — the
// multipart comment endpoint is the only way to get a `fileId` in v1.
//
// The server never returns the on-disk `storagePath`. The download endpoint
// streams the file directly through Express with `Content-Type`,
// `Content-Length`, and `Content-Disposition: inline` headers, so a
// browser can render images / videos / PDFs in place by pointing `<img>`,
// `<video>`, or `<iframe src>` at the content URL.

import { apiClient } from '../services/apiClient';

export interface FileMetadata {
  id: string;
  ownerId: string;
  taskId: string | null;
  commentId: string | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: number;
  deletedAt: number | null;
}

export const fileRepository = {
  /**
   * Returns a relative URL the browser can use as the `src` of an `<img>`,
   * `<video>`, or `<iframe>`, or as the `href` of a download link. The
   * session cookie is included automatically; no extra headers are needed.
   *
   * The URL is returned as a string, not a Blob, so React can use it in
   * `src` props directly. The browser will fetch it on first paint.
   */
  getContentUrl(fileId: string): string {
    return `/files/${encodeURIComponent(fileId)}/content`;
  },

  delete(fileId: string): Promise<{ ok: true; file: FileMetadata }> {
    return apiClient.delete<{ ok: true; file: FileMetadata }>(
      `/files/${encodeURIComponent(fileId)}`,
    );
  },
};
