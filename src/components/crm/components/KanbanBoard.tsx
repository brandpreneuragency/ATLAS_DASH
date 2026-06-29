import type { CRMDeal, PipelineStage, CRMContact, CRMCompany } from '../../../types/crm';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  stages: PipelineStage[];
  deals: CRMDeal[];
  contacts: CRMContact[];
  companies: CRMCompany[];
  onMoveDeal?: (dealId: string, toStage: CRMDeal['stage']) => void;
  onSelectDeal?: (dealId: string) => void;
  activeDealId?: string | null;
}

export function KanbanBoard({
  stages,
  deals,
  contacts,
  companies,
  onMoveDeal,
  onSelectDeal,
  activeDealId,
}: KanbanBoardProps) {
  const stageKeys = stages.map((s) => s.key);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  return (
    <div className="crm-kanban">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.key);
        const totalValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
        const valueLabel =
          totalValue > 0
            ? `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(totalValue)}`
            : '';
        return (
          <div key={stage.id} className="crm-kanban-column" data-stage={stage.key}>
            <div className="crm-kanban-column-header">
              <span className="crm-kanban-column-title">
                <span className={`crm-kanban-column-dot crm-kanban-column-dot--${stage.key}`} />
                {stage.label}
              </span>
              <span className="crm-kanban-column-count">
                {stageDeals.length}
                {valueLabel && <span className="crm-kanban-column-value subtle"> · {valueLabel}</span>}
              </span>
            </div>
            <div className="crm-kanban-column-body">
              {stageDeals.length === 0 && (
                <div className="crm-kanban-column-empty subtle">No deals</div>
              )}
              {stageDeals.map((deal) => (
                <KanbanCard
                  key={deal.id}
                  deal={deal}
                  contact={deal.contactId ? contactMap.get(deal.contactId) : undefined}
                  company={deal.companyId ? companyMap.get(deal.companyId) : undefined}
                  stageKeys={stageKeys}
                  onMove={onMoveDeal}
                  onClick={onSelectDeal}
                  isActive={deal.id === activeDealId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
