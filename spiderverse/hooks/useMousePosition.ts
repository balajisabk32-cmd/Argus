"use client";

import { useEffect, useRef, useState } from "react";

export interface Pointer {
  x: number; // 0..1 across viewport
  y: number; // 0..1 down viewport
  nx: number; // -1..1 (centered)
  ny: number; // -1..1 (centered)
}

/**
 * Tracks the pointer in viewport-normalized space.
 * Exposes both a ref (for rAF-safe reads inside animation loops, no re-render)
 * and state (for render-driven UI).
 */
export function useMousePosition() {
  const ref = useRef<Pointer>({ x: 0.5, y: 0.5, nx: 0, ny: 0 });
  const [pointer, setPointer] = useState<Pointer>(ref.current);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      const next = { x, y, nx: x * 2 - 1, ny: y * 2 - 1 };
      ref.current = next;
      setPointer(next);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return { pointer, pointerRef: ref };
}
