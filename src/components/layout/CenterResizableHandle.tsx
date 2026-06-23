import { useResizable } from '../../hooks/useResizable';

export function CenterResizableHandle() {
  const { onMouseDown } = useResizable();
  return (
    <div
      id="center-resize-handle"
      onMouseDown={onMouseDown}
      className="resize-handle center-resize-handle"
      style={{
        minWidth: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'col-resize',
        userSelect: 'none',
        height: '100%',
      }}
    >
      {/* thin visual line in the center */}
      <div
        style={{
          width: 1,
          height: '100%',
          background: 'var(--c-border-1)',
        }}
      />
    </div>
  );
}