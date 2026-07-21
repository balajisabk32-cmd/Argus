"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const ERAS = [
  { year: "1962", title: "The Origin", body: "A bite. A loss. A promise in red and blue." },
  { year: "2000s", title: "The Web-Slinger", body: "A new generation learns to fly between towers." },
  { year: "2011", title: "The Reboot", body: "Biology rewritten — the suit becomes part of the skin." },
  { year: "2018", title: "The Verse", body: "Every spider, every world, one impossible team." },
  { year: "2023", title: "Beyond", body: "The legacy is no longer inherited. It is chosen." },
  { year: "NOW", title: "You", body: "This is where your story swings in." },
];

export default function TheLegacy() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const el = track.current!;
      const getScroll = () => el.scrollWidth - window.innerWidth;

      gsap.to(el, {
        x: () => -getScroll(),
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${getScroll()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="legacy"
      ref={root}
      className="relative h-[100svh] overflow-hidden bg-void"
    >
      <div className="pointer-events-none absolute left-[var(--gutter)] top-12 z-10">
        <p className="eyebrow mb-3">03 — The Legacy</p>
        <h2 className="font-display text-[var(--step-3)] font-extrabold tracking-tightest text-bone">
          A TIMELINE THAT <span className="text-gradient">NEVER ENDS</span>
        </h2>
      </div>

      <div
        ref={track}
        className="flex h-full items-center gap-8 px-[var(--gutter)] will-change-transform"
      >
        {ERAS.map((e, i) => (
          <article
            key={i}
            className="glass relative flex h-[58vh] w-[78vw] shrink-0 flex-col justify-between rounded-3xl p-10 sm:w-[46vw] lg:w-[32vw]"
          >
            <div>
              <span className="font-display text-[var(--step-3)] font-extrabold text-volt">
                {e.year}
              </span>
              <h3 className="mt-2 font-display text-[var(--step-2)] font-bold text-bone">
                {e.title}
              </h3>
            </div>
            <p className="max-w-sm text-[var(--step-1)] text-ash">{e.body}</p>
            <span className="font-display text-xs uppercase tracking-wider2 text-bone/40">
              {String(i + 1).padStart(2, "0")} / {String(ERAS.length).padStart(2, "0")}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
