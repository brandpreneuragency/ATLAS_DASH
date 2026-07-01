import type { FormStatus } from '../../../types/forms';
import { FileEdit, CheckCircle2, Archive, LayoutPanelTop } from 'lucide-react';
import '../forms.css';

interface StatusBadgeProps {
  status?: FormStatus;
  variant?: 'form' | 'template';
}

const STATUS_LABEL: Record<FormStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export function StatusBadge({ status = 'draft', variant = 'form' }: StatusBadgeProps) {
  if (variant === 'template') {
    return (
      <span className="forms-status-badge forms-status-badge--template">
        <LayoutPanelTop size={11} />
        Template
      </span>
    );
  }

  const Icon = status === 'published' ? CheckCircle2 : status === 'archived' ? Archive : FileEdit;
  return (
    <span className={`forms-status-badge forms-status-badge--${status}`}>
      <Icon size={11} />
      {STATUS_LABEL[status]}
    </span>
  );
}
