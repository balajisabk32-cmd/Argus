/**
 * Centralized design tokens for use in JS/TS (GSAP, Three.js, canvas).
 * Mirrors the CSS custom properties in app/globals.css.
 */
export const COLORS = {
  ink: "#050507",
  void: "#0a0a0f",
  bone: "#f5f3ee",
  ash: "#8a8f98",
  web: "#c9ccd4",
  peter: "#e10600",
  miles: "#ff2d55",
  volt: "#2de2e6",
  flux: "#ff2fd0",
} as const;

/** Easing curves as GSAP-compatible cubic-bezier arrays. */
export const EASE = {
  expo: "expo.out", // cubic-bezier(0.16,1,0.3,1)
  quint: "power4.inOut", // cubic-bezier(0.83,0,0.17,1)
  snap: "back.out(1.4)", // cubic-bezier(0.22,1,0.36,1) w/ overshoot
  soft: "power2.out",
} as const;

/** Math easing helpers (used for procedural camera motion in R3F). */
export const easeInQuad = (t: number) => t * t;
export const easeInCubic = (t: number) => t * t * t;
export const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Deterministic PRNG so the city canyon is stable across renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
