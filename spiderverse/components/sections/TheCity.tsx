"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/** Cinematic "shot" panels. Replace gradients with real stills later. */
const SHOTS = [
  { tag: "District 1", tone: "from-volt/30 via-void to-miles/20", speed: -0.18 },
  { tag: "Swing Line", tone: "from-flux/30 via-void to-volt/20", speed: 0.12 },
  { tag: "Rooftop", tone: "from-miles/30 via-void to-flux/20", speed: -0.1 },
  { tag: "Rain", tone: "from-volt/20 via-void to-bone/10", speed: 0.2 },
  { tag: "Neon Way", tone: "from-flux/30 via-void to-volt/20", speed: -0.22 },
  { tag: "Dawn", tone: "from-miles/20 via-void to-volt/20", speed: 0.08 },
];

export default function TheCity() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // headline swing-in
      gsap.from(".city-title .hero-line span", {
        yPercent: 120,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: "top 70%" },
      });

      // per-panel parallax
      gsap.utils.toArray<HTMLElement>(".city-panel").forEach((el) => {
        const speed = parseFloat(el.dataset.speed || "0");
        gsap.fromTo(
          el,
          { yPercent: speed * 100 },
          {
            yPercent: speed * -100,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="city"
      ref={root}
      className="relative overflow-hidden px-[var(--gutter)] py-32"
    >
      <div className="mx-auto mb-16 max-w-[var(--maxw)]">
        <p className="eyebrow mb-5">02 — The City</p>
        <h2 className="city-title font-display text-[var(--step-4)] font-extrabold leading-[0.9] tracking-tightest text-bone">
          <span className="hero-line block overflow-hidden">
            <span className="block">A THOUSAND</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block text-gradient">SKIES TO SWING</span>
          </span>
        </h2>
      </div>

      <div className="mx-auto grid max-w-[var(--maxw)] grid-cols-2 gap-4 md:grid-cols-3">
        {SHOTS.map((s, i) => (
          <figure
            key={i}
            data-speed={s.speed}
            className={`city-panel relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${s.tone}`}
          >
            <div className="grain absolute inset-0 opacity-20" />
            <figcaption className="absolute bottom-4 left-4 font-display text-xs uppercase tracking-wider2 text-bone/90">
              {s.tag}
            </figcaption>
            <span className="absolute right-4 top-4 font-display text-xs text-bone/50">
              0{i + 1}
            </span>
          </figure>
        ))}
      </div>
    </section>
  );
}
