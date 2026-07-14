import type { Document } from '../../types';

function hasDocumentText(content: string | undefined) {
  return !!content?.includes('"text":');
}

export function getDocumentTabMeta(doc: Document) {
  const isEmpty = !hasDocumentText(doc.content);
  const isCleanFile = !!doc.sourcePath && !doc.isDirty;
  const isReplaceable = isEmpty || isCleanFile;
  const isDirty = !!doc.sourcePath && !!doc.isDirty;
  const hasEdits = isDirty || (!doc.sourcePath && !isEmpty);
  return { isReplaceable, hasEdits };
}
