import { useLeftResizable } from '../../hooks/useLeftResizable';

export function LeftResizableHandle() {
  const { onMouseDown } = useLeftResizable();

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 right-0 h-full w-[6px] z-[1] cursor-col-resize flex items-center justify-center"
    >
      {/* thin separating line */}
      <div className="absolute inset-y-0 left-[2px] w-px bg-[#dedede]" />
    </div>
  );
}
