interface ScoreBadgeProps {
  score?: number;
  /** Pass true for compact list-row rendering. */
  compact?: boolean;
}

function band(score: number): 'high' | 'med' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'med';
  return 'low';
}

export function ScoreBadge({ score, compact }: ScoreBadgeProps) {
  if (score === undefined || score === null || Number.isNaN(score)) {
    return <span className="crm-score-badge crm-score-badge--none">—</span>;
  }
  const b = band(score);
  return (
    <span className={`crm-score-badge crm-score-badge--${b}${compact ? ' crm-score-badge--compact' : ''}`}>
      {score}
    </span>
  );
}
