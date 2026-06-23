import { useMemo } from 'react';
import type { AIProviderConfig, ModelItem } from '../../../types';

interface ModelHoverCardProps {
  targetRect: DOMRect;
  provider: AIProviderConfig;
  model: ModelItem;
  enabled: boolean;
}

const CARD_WIDTH = 240;
const CARD_MARGIN = 12;

export function ModelHoverCard({ targetRect, provider, model, enabled }: ModelHoverCardProps) {
  const position = useMemo(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = targetRect.right + CARD_MARGIN;
    let top = targetRect.top + targetRect.height / 2;

    if (left + CARD_WIDTH > viewportWidth - CARD_MARGIN) {
      left = targetRect.left - CARD_WIDTH - CARD_MARGIN;
    }

    const estimatedHeight = 260;
    if (top + estimatedHeight / 2 > viewportHeight - CARD_MARGIN) {
      top = viewportHeight - estimatedHeight / 2 - CARD_MARGIN;
    }
    if (top - estimatedHeight / 2 < CARD_MARGIN) {
      top = estimatedHeight / 2 + CARD_MARGIN;
    }

    return { left, top };
  }, [targetRect]);

  const cap = model.capabilities;

  const rows: { label: string; value: string }[] = [
    { label: 'Vision', value: cap.vision ? 'Yes' : 'No' },
    { label: 'Tool Calling', value: cap.toolCalling ? 'Yes' : 'No' },
    { label: 'Context Length', value: cap.contextLength },
    { label: 'Speed', value: cap.speed },
    { label: 'Cost', value: cap.cost },
    { label: 'Reasoning', value: cap.reasoning },
    { label: 'Endpoint', value: cap.endpointType },
    { label: 'Last Synced', value: cap.lastSynced ?? 'Unknown' },
  ];

  return (
    <div
      className="model-hover-card"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: CARD_WIDTH,
        transform: 'translateY(-50%)',
        zIndex: 300,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <div className="semibold" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>
          {model.name}
        </div>
        <div className="subtle" style={{ fontSize: 'var(--fs-sm)', marginTop: 2 }}>
          {provider.name} · {enabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>

      <div className="col gap-1" style={{ gap: 4 }}>
        {rows.map((row) => (
          <div key={row.label} className="row" style={{ justifyContent: 'space-between' }}>
            <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{row.label}</span>
            <span className="med" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
