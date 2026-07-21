"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { gsap } from "@/lib/gsap";

/**
 * PRELOADER — "spider-sense tingling".
 * A full-bleed black screen with an animated SVG turbulence field that
 * distorts like a sixth-sense warning, a pulsing concentric ring, and a
 * counter that ticks 0→100 before the experience is revealed.
 */
export default function Preloader({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const turbRef = useRef<SVGFETurbulenceElement>(null);

  // Count-up + animated turbulence "tingle"
  useEffect(() => {
    const counter = { v: 0 };
    const tick = gsap.timeline();
    tick.to(counter, {
      v: 100,
      duration: 2.4,
      ease: "power2.inOut",
      onUpdate: () => setProgress(Math.round(counter.v)),
    });
    // Turbulence baseFrequency wobble → the "tingling" distortion
    const turb = turbRef.current;
    let raf = 0;
    let t = 0;
    const wobble = () => {
      t += 0.08;
      const f = 0.012 + Math.sin(t) * 0.006 + Math.abs(Math.sin(t * 0.5)) * 0.01;
      turb?.setAttribute("baseFrequency", `${f.toFixed(4)} ${(f * 1.6).toFixed(4)}`);
      raf = requestAnimationFrame(wobble);
    };
    raf = requestAnimationFrame(wobble);

    const exit = window.setTimeout(() => setDone(true), 2700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(exit);
    };
  }, []);

  // Exit choreography → hand off to the 3D intro
  useEffect(() => {
    if (!done) return;
    const tl = gsap.timeline({
      onComplete: () => {
        setProgress(100);
        onComplete();
      },
    });
    tl.to(rootRef.current, {
      yPercent: -100,
      duration: 1.1,
      ease: "expo.inOut",
    });
    return () => {
      tl.kill();
    };
  }, [done, onComplete]);

  return (
    <motion.div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink"
    >
          {/* Distortion field */}
          <svg className="absolute inset-0 h-full w-full opacity-40 mix-blend-screen">
            <defs>
              <filter id="tingle">
                <feTurbulence
                  ref={turbRef}
                  type="fractalNoise"
                  baseFrequency="0.012 0.02"
                  numOctaves={2}
                  seed={7}
                />
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="2.2" intercept="-0.4" />
                </feComponentTransfer>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#tingle)" fill="#ff2fd0" />
          </svg>

          {/* Pulsing spider-sense ring */}
          <div className="absolute h-[42vmin] w-[42vmin] rounded-full border border-flux/40 animate-tingle" />
          <div className="absolute h-[30vmin] w-[30vmin] rounded-full border border-volt/40 animate-tingle [animation-delay:-90ms]" />

          {/* Label */}
          <div className="relative z-10 text-center">
            <p className="eyebrow mb-3 animate-flicker">Spider-Sense</p>
            <h1 className="font-display text-[12vw] font-extrabold leading-none tracking-tightest text-bone">
              TINGLING
            </h1>
          </div>

          {/* Progress */}
          <div className="absolute bottom-[8vh] right-[var(--gutter)] font-display text-step-2 font-bold tabular-nums text-volt">
            {String(progress).padStart(3, "0")}
            <span className="text-ash">%</span>
          </div>
          <div className="absolute bottom-[6vh] left-[var(--gutter)] right-[var(--gutter)] h-px bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-volt via-flux to-miles"
              style={{ width: `${progress}%` }}
            />
          </div>
    </motion.div>
  );
}
