// StyleTab — the "Style" tab of the Form Builder.
//
// Layout: a top row with <ResponsivePreviewToggle />, then a two-column
// grid (left = <StyleControls />, right = <LivePreview />). The grid shell
// (.forms-builder-style / -controls / -preview) and the toggle bar classes
// are defined in builder.css; the scoped chrome classes live in styleTab.css
// (imported once here).
//
// Style edits flow through formsStore.updateForm; the live preview reuses the
// embed FormRenderer so the preview is the real published form output.

import type { LeadForm } from '../../../types/forms';
import { StyleControls } from './components/StyleControls';
import { LivePreview } from './components/LivePreview';
import { ResponsivePreviewToggle } from './components/ResponsivePreviewToggle';
import './styleTab.css';

export interface StyleTabProps {
  form: LeadForm;
}

export default function StyleTab({ form }: StyleTabProps) {
  return (
    <div className="forms-builder-style-tab">
      <ResponsivePreviewToggle />
      <div className="forms-builder-style">
        <div className="forms-builder-style-controls">
          <StyleControls form={form} />
        </div>
        <div className="forms-builder-style-preview">
          <LivePreview form={form} />
        </div>
      </div>
    </div>
  );
}
