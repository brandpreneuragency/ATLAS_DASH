import { useResizable } from '../../hooks/useResizable';

export function ResizableHandle() {
  const { onMouseDown } = useResizable();
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 left-0 h-full w-[6px] cursor-col-resize flex items-center justify-center z-[1]"
    >
      {/* thin separating line */}
      <div className="absolute inset-y-0 right-[2px] w-px bg-[#dedede]" />
    </div>
  );
}
