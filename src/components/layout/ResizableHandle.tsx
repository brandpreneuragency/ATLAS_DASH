import { useResizable } from '../../hooks/useResizable';

export function ResizableHandle() {
  const { onMouseDown } = useResizable();
  return (
    <div
      id="right-resize-handle"
      onMouseDown={onMouseDown}
      className="resize-handle absolute"
      style={{
        top: 0, left: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}
    >
      {/* thin separating line */}

    </div>
  );
}
