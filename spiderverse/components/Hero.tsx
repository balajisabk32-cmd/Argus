"use client";

import { useEffect, useRef } from "react";
import { useMagnetic } from "@/hooks/useMagnetic";
import CursorWeb from "./CursorWeb";
import { gsap } from "@/lib/gsap";

const LINES = ["INTO THE", "WEB", "MULTIVERSE"];

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const ctaRef = useMagnetic<HTMLAnchorElement>(0.45, 90);
  const ctaRef2 = useMagnetic<HTMLAnchorElement>(0.4, 90);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 });
      tl.from(".hero-eyebrow", { y: 20, opacity: 0, duration: 0.8 })
        .from(
          ".hero-line span",
          {
            yPercent: 120,
            duration: 1.2,
            ease: "expo.out",
            stagger: 0.12,
          },
          "-=0.4"
        )
        .from(
          ".hero-sub",
          { y: 24, opacity: 0, duration: 0.9 },
          "-=0.6"
        )
        .from(
          ".hero-cta",
          { y: 24, opacity: 0, duration: 0.8, stagger: 0.1 },
          "-=0.5"
        )
        .from(
          ".hero-scroll",
          { opacity: 0, duration: 0.8 },
          "-=0.3"
        );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-[var(--gutter)]"
    >
      <CursorWeb />

      {/* ambient neon glows */}
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[40vmax] w-[40vmax] rounded-full bg-volt/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[36vmax] w-[36vmax] rounded-full bg-flux/10 blur-[120px]" />

      <div className="relative z-10 mx-auto w-full max-w-[var(--maxw)]">
        <p className="hero-eyebrow eyebrow mb-6">
          Spider-Verse · An Immersive Tribute
        </p>

        <h1 className="font-display font-extrabold leading-[0.86] tracking-tightest text-bone">
          {LINES.map((line, i) => (
            <span key={i} className="hero-line block overflow-hidden">
              <span
                className={`block ${
                  i === 1
                    ? "text-gradient text-[var(--step-6)]"
                    : "text-[var(--step-5)]"
                }`}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        <p className="hero-sub mt-8 max-w-xl text-[var(--step-1)] text-ash">
          Dive the canyon of a thousand skies. Swing a living city. Wear the
          legacy. This is not one hero — it is every hero.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-5">
          <a
            ref={ctaRef}
            href="#suit"
            className="hero-cta group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-bone px-8 py-4 font-display text-sm font-bold uppercase tracking-wider2 text-ink"
          >
            <span className="relative z-10">Enter the Verse</span>
            <span className="relative z-10 transition-transform duration-500 ease-snap group-hover:translate-x-1">
              →
            </span>
            <span className="absolute inset-0 -z-0 origin-left scale-x-0 bg-gradient-to-r from-volt to-flux transition-transform duration-500 ease-snap group-hover:scale-x-100" />
          </a>

          <a
            ref={ctaRef2}
            href="#legacy"
            className="hero-cta glass inline-flex items-center gap-3 rounded-full px-8 py-4 font-display text-sm font-bold uppercase tracking-wider2 text-bone transition-colors duration-500 hover:text-volt"
          >
            The Legacy
          </a>
        </div>
      </div>

      {/* scroll cue */}
      <div className="hero-scroll absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-ash">
        <span className="eyebrow">Scroll</span>
        <span className="block h-10 w-px bg-gradient-to-b from-bone to-transparent" />
      </div>
    </section>
  );
}
