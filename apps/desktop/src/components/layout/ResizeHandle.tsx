import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    },
    [direction],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = direction === 'vertical' ? e.clientX : e.clientY;
      const delta = current - lastPos.current;
      lastPos.current = current;
      if (delta !== 0) onResize(delta);
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, direction, onResize]);

  return (
    <div
      className={[
        styles.resizeHandle,
        direction === 'vertical' ? styles.vertical : styles.horizontal,
        dragging ? styles.dragging : '',
      ].join(' ')}
      onMouseDown={handleMouseDown}
    />
  );
}
