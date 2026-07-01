interface ModelSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

export function ModelSwitch({ checked, onChange, ariaLabel }: ModelSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="model-switch"
      style={{
        width: 36,
        height: 16,
        minHeight: 16,
        maxHeight: 16,
        boxSizing: 'border-box',
        borderRadius: 9999,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: checked ? 'var(--c-accent-center-panel)' : 'var(--c-background-4)',
        transition: 'background-color 0.15s',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 0.15s',
        }}
      />
    </button>
  );
}
