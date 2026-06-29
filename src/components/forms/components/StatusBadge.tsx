import type { FormStatus } from '../../../types/forms';
import { FileEdit, CheckCircle2, Archive } from 'lucide-react';
import '../forms.css';

interface StatusBadgeProps {
  status: FormStatus;
}

const STATUS_LABEL: Record<FormStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = status === 'published' ? CheckCircle2 : status === 'archived' ? Archive : FileEdit;
  return (
    <span className={`forms-status-badge forms-status-badge--${status}`}>
      <Icon size={11} />
      {STATUS_LABEL[status]}
    </span>
  );
}
