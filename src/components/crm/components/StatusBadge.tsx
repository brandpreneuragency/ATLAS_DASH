import type { CRMLeadStatus, CRMDealStage } from '../../../types/crm';

type BadgeStage = CRMLeadStatus | CRMDealStage;

interface StatusBadgeProps {
  stage: BadgeStage;
  /** Optional override label; defaults to capitalized stage. */
  label?: string;
}

const STAGE_LABELS: Record<BadgeStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
  spam: 'Spam',
};

export function StatusBadge({ stage, label }: StatusBadgeProps) {
  const text = label ?? STAGE_LABELS[stage];
  return <span className={`crm-status-badge crm-status-badge--${stage}`}>{text}</span>;
}
