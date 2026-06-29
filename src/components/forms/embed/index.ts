// Barrel for the forms embed module.
//
// Re-exports the embeddable form renderer, its isolated styling, the in-app
// preview/test wrappers, and the UTM + honeypot + success helpers. Keep this
// the single import surface for the rest of the app:
//   import { FormRenderer, EmbedPreview, LocalSubmissionHandler } from '@/.../embed';

export { FormRenderer } from './FormRenderer';
export type { FormRendererProps } from './FormRenderer';

export { HoneypotField } from './HoneypotField';
export { EmbedSuccessMessage } from './EmbedSuccessMessage';

export {
  collectUtmAndSourceData,
  pickEnabledUtm,
  DEFAULT_ENABLED_UTM,
  ALL_UTM_KEYS,
} from './UtmCapture';
export type { UtmKeyName } from './UtmCapture';

export { EmbedPreview } from './EmbedPreview';
export type { EmbedPreviewProps, EmbedPreviewMode } from './EmbedPreview';

export { LocalSubmissionHandler } from './LocalSubmissionHandler';
export type { LocalSubmissionHandlerProps } from './LocalSubmissionHandler';
