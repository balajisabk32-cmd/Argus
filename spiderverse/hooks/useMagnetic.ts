"use client";

import { useEffect, useRef } from "react";

/**
 * Magnetic hover — the element eases toward the cursor while hovered,
 * then snaps back on leave. The hallmark of premium agency buttons.
 *
 * @param strength 0..1 — how far the element travels toward the cursor.
 * @param radius   px — activation distance beyond the element bounds.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.4, radius = 80) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = rect.left + rect.width / 2;
      const my = rect.top + rect.height / 2;
      const dx = e.clientX - mx;
      const dy = e.clientY - my;
      const dist = Math.hypot(dx, dy);
      const reach = Math.max(rect.width, rect.height) / 2 + radius;

      if (dist < reach) {
        tx = dx * strength;
        ty = dy * strength;
      } else {
        tx = 0;
        ty = 0;
      }

      cancelAnimationFrame(raf);
      const tick = () => {
        // critically-damped-ish lerp for the "weighty" feel
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(tick);
        } else {
          el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      cancelAnimationFrame(raf);
      const tick = () => {
        cx += (0 - cx) * 0.12;
        cy += (0 - cy) * 0.12;
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        if (Math.abs(cx) > 0.1 || Math.abs(cy) > 0.1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength, radius]);

  return ref;
}
