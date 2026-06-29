// LivePreview — the right-hand side of the Style tab.
//
// Reads `previewMode` from the forms store and renders the real, fully
// functional embedded form by REUSING FormRenderer (we do NOT rebuild a
// preview renderer). FormRenderer consumes `form.style` and applies it as
// isolated `--tabs-form-*` CSS custom properties on its `.forms-embed-root`,
// so the live preview reflects every style change with no extra wiring here.
//
// The viewport wrapper only constrains width per preview mode (desktop fills
// the pane; tablet = 768px; mobile = 375px) and draws a subtle "device screen"
// frame + a mode label badge. The form itself self-centres at max-width 640
// (see embed.css), so it sits centred inside the frame.

import { FormRenderer } from '../../embed/FormRenderer';
import type { LeadForm } from '../../../../types/forms';
import { useFormsStore } from '../../../../stores/formsStore';
import type { PreviewMode } from '../../../../stores/formsStore';

const VIEWPORT_LABEL: Record<PreviewMode, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

export interface LivePreviewProps {
  form: LeadForm;
}

export function LivePreview({ form }: LivePreviewProps) {
  const previewMode = useFormsStore((s) => s.previewMode);

  return (
    <div className="forms-builder-style-stage">
      <div
        className={
          'forms-builder-style-viewport ' +
          `forms-builder-style-viewport--${previewMode}`
        }
      >
        <span className="forms-builder-style-viewport-label" aria-hidden="true">
          {VIEWPORT_LABEL[previewMode]}
        </span>
        <FormRenderer form={form} isPublishedEmbed={false} />
      </div>
    </div>
  );
}
