import { useLeftResizable } from '../../hooks/useLeftResizable';

export function LeftResizableHandle() {
  const { onMouseDown } = useLeftResizable();

  return (
    <div
      id="left-resize-handle"
      onMouseDown={onMouseDown}
      className="resize-handle shrink-0 relative"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}
    >
      {/* thin separating line */}

    </div>
  );
}
