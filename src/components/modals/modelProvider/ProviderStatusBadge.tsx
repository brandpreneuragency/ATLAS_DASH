import type { ProviderStatus } from '../../../types';

interface ProviderStatusBadgeProps {
  status: ProviderStatus;
}

const STATUS_STYLES: Record<ProviderStatus, { text: string; bg: string; border: string; color: string }> = {
  connected: {
    text: 'Connected',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    color: '#15803d',
  },
  not_connected: {
    text: 'Not Connected',
    bg: 'var(--c-background-4)',
    border: 'var(--c-border-1)',
    color: 'var(--c-text-2)',
  },
  needs_setup: {
    text: 'Needs Setup',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    color: '#b45309',
  },
};

export function ProviderStatusBadge({ status }: ProviderStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="row-xs shrink-0"
      style={{
        fontSize: 'var(--fs-sm)',
        fontWeight: 500,
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
        padding: '2px 8px',
        borderRadius: 9999,
      }}
    >
      {style.text}
    </span>
  );
}
