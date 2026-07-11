import { useLeftResizable } from '../../hooks/useLeftResizable';

export function LeftResizableHandle() {
  const { onMouseDown } = useLeftResizable();

  return (
    <div
      id="left-resize-handle"
      onMouseDown={onMouseDown}
      className="resize-handle shrink-0 relative workspace-handle"
      style={{
        minWidth: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'col-resize',
        userSelect: 'none',
        backgroundColor: 'var(--c-background-1)',
        height: '100%',
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: 2,
          height: '100%',
        }}
      />
    </div>
  );
}
