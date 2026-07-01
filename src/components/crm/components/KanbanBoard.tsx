import { useState } from 'react';
import type { CRMDeal, PipelineStage, CRMContact, CRMCompany, CRMDealStage } from '../../../types/crm';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  stages: PipelineStage[];
  deals: CRMDeal[];
  contacts: CRMContact[];
  companies: CRMCompany[];
  onMoveDeal?: (dealId: string, toStage: CRMDeal['stage']) => void;
  onSelectDeal?: (dealId: string) => void;
  onEditDeal?: (dealId: string) => void;
  activeDealId?: string | null;
}

export function KanbanBoard({
  stages,
  deals,
  contacts,
  companies,
  onMoveDeal,
  onSelectDeal,
  onEditDeal,
  activeDealId,
}: KanbanBoardProps) {
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const [dropTargetStage, setDropTargetStage] = useState<CRMDealStage | null>(null);

  const handleDragEnd = () => {
    setDropTargetStage(null);
  };

  return (
    <div className="crm-kanban" onDragEnd={handleDragEnd}>
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.key);
        const totalValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
        const valueLabel =
          totalValue > 0
            ? `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(totalValue)}`
            : '';
        const isDropTarget = dropTargetStage === stage.key;
        return (
          <div key={stage.id} className={`crm-kanban-column${isDropTarget ? ' crm-kanban-column--drop-target' : ''}`} data-stage={stage.key}>
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
            <div
              className="crm-kanban-column-body"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTargetStage(stage.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTargetStage((cur) => (cur === stage.key ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const dealId =
                  e.dataTransfer.getData('application/x-crm-deal') ||
                  e.dataTransfer.getData('text/plain');
                setDropTargetStage(null);
                if (dealId) onMoveDeal?.(dealId, stage.key);
              }}
            >
              {stageDeals.length === 0 && (
                <div className="crm-kanban-column-empty subtle">No deals</div>
              )}
              {stageDeals.map((deal) => (
                <KanbanCard
                  key={deal.id}
                  deal={deal}
                  contact={deal.contactId ? contactMap.get(deal.contactId) : undefined}
                  company={deal.companyId ? companyMap.get(deal.companyId) : undefined}
                  onClick={onSelectDeal}
                  onEdit={onEditDeal}
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
