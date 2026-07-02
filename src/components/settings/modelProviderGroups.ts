/** Virtual group ids for placeholder provider groups (no backend yet). */
export const EMBEDDINGS_GROUP_ID = 'embeddings';
export const VECTOR_GROUP_ID = 'vector';
export const IMAGE_GROUP_ID = 'imageModels';

export function isPlaceholderGroupId(id: string | null | undefined): boolean {
  return id === EMBEDDINGS_GROUP_ID || id === VECTOR_GROUP_ID || id === IMAGE_GROUP_ID;
}
