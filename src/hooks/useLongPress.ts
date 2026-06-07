import { useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseLongPressOptions {
  onLongPress: (pos: Position) => void;
  delay?: number;
  moveThreshold?: number;
}

export function useLongPress({ onLongPress, delay = 600, moveThreshold = 10 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<Position | null>(null);
  const startTimeRef = useRef<number>(0);
  const isLongPressRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    isLongPressRef.current = false;
  }, []);

  const getPos = (e: MouseEvent | TouchEvent): Position => {
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  };

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const pos = getPos(e.nativeEvent);
      startPosRef.current = pos;
      startTimeRef.current = Date.now();
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(pos);
      }, delay);
    },
    [onLongPress, delay]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!startPosRef.current) return;
      const pos = getPos(e.nativeEvent);
      const dx = Math.abs(pos.x - startPosRef.current.x);
      const dy = Math.abs(pos.y - startPosRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const handleEnd = useCallback(() => {
    clear();
  }, [clear]);

  // Prevent context menu on long-press (mobile)
  useEffect(() => {
    const preventContext = (e: Event) => {
      if (isLongPressRef.current) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventContext);
    return () => document.removeEventListener('contextmenu', preventContext);
  }, []);

  return {
    onMouseDown: handleStart,
    onMouseMove: handleMove,
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
    onTouchStart: handleStart,
    onTouchMove: handleMove,
    onTouchEnd: handleEnd,
  };
}
