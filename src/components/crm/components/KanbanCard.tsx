import { Building2, CalendarDays, GripVertical, User } from 'lucide-react';
import type { CRMDeal, CRMDealStage } from '../../../types/crm';
import type { CRMContact, CRMCompany } from '../../../types/crm';
import { TagChips } from './TagChips';

interface KanbanCardProps {
  deal: CRMDeal;
  /** Resolved contact (used to show the linked person). */
  contact?: CRMContact;
  /** Resolved company (used to show the company name). */
  company?: CRMCompany;
  /** Stage the card currently sits in (used for the move menu). */
  stageKeys: CRMDealStage[];
  onMove?: (dealId: string, toStage: CRMDealStage) => void;
  onClick?: (dealId: string) => void;
  isActive?: boolean;
}

function formatValue(value?: number, currency = 'USD'): string {
  if (value === undefined || value === null) return '—';
  const compact = value >= 1000 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : String(value);
  const symbol = currency === 'USD' ? '$' : '';
  return `${symbol}${compact}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function KanbanCard({ deal, contact, company, stageKeys, onMove, onClick, isActive }: KanbanCardProps) {
  const companyLabel = company?.name ?? deal.companyId ?? '—';
  const contactLabel = contact ? `${contact.firstName} ${contact.lastName}` : deal.contactId ?? '—';
  const otherStages = stageKeys.filter((s) => s !== deal.stage);

  return (
    <div
      className={`crm-kanban-card${isActive ? ' crm-kanban-card--active' : ''}`}
      onClick={() => onClick?.(deal.id)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="crm-kanban-card-drag" title="Drag to move">
        <GripVertical size={12} />
      </div>
      <div className="crm-kanban-card-header">
        <span className="crm-kanban-card-title">{deal.title}</span>
        {onMove && (
          <div className="crm-kanban-card-move">
            <select
              aria-label="Move deal to stage"
              value={deal.stage}
              onChange={(e) => {
                e.stopPropagation();
                onMove(deal.id, e.target.value as CRMDealStage);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value={deal.stage}>{deal.stage}</option>
              {otherStages.map((s) => (
                <option key={s} value={s}>
                  → {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="crm-kanban-card-value">{formatValue(deal.value, deal.currency)}</div>
      <div className="crm-kanban-card-meta">
        <span className="crm-kanban-card-meta-item">
          <Building2 size={11} />
          <span className="trunc">{companyLabel}</span>
        </span>
        <span className="crm-kanban-card-meta-item">
          <User size={11} />
          <span className="trunc">{contactLabel}</span>
        </span>
        <span className="crm-kanban-card-meta-item">
          <CalendarDays size={11} />
          <span>{formatDate(deal.expectedCloseDate)}</span>
        </span>
      </div>
      {deal.tags.length > 0 && (
        <div className="crm-kanban-card-tags">
          <TagChips tags={deal.tags} max={2} />
        </div>
      )}
    </div>
  );
}
