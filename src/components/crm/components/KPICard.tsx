import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  /** Optional delta text, e.g. "+12%". */
  delta?: string;
  /** Whether the delta is positive (renders up arrow + accent). */
  deltaPositive?: boolean;
  icon?: LucideIcon;
}

export function KPICard({ label, value, delta, deltaPositive, icon: Icon }: KPICardProps) {
  return (
    <div className="crm-kpi-card">
      <div className="crm-kpi-card-top">
        <span className="crm-kpi-card-label">{label}</span>
        {Icon && (
          <span className="crm-kpi-card-icon">
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="crm-kpi-card-value">{value}</div>
      {delta && (
        <div className={`crm-kpi-card-delta${deltaPositive ? ' crm-kpi-card-delta--up' : ' crm-kpi-card-delta--down'}`}>
          {deltaPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
