"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

const LINKS = [
  { href: "#suit", label: "Suit" },
  { href: "#city", label: "City" },
  { href: "#legacy", label: "Legacy" },
];

export default function Nav({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.to(ref.current, {
      y: visible ? 0 : -120,
      opacity: visible ? 1 : 0,
      duration: 1,
      ease: "expo.out",
    });
  }, [visible]);

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-[var(--gutter)] py-5"
      style={{ opacity: 0, transform: "translateY(-120px)" }}
    >
      <a
        href="#top"
        className="font-display text-lg font-extrabold tracking-tightest text-bone"
      >
        SPIDER<span className="text-volt">·</span>VERSE
      </a>
      <nav className="glass hidden items-center gap-1 rounded-full px-2 py-1 md:flex">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-full px-4 py-2 font-display text-xs uppercase tracking-wider2 text-bone/80 transition-colors hover:text-volt"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <a
        href="#suit"
        className="rounded-full bg-bone px-5 py-2 font-display text-xs font-bold uppercase tracking-wider2 text-ink transition-transform hover:scale-105"
      >
        Enter
      </a>
    </header>
  );
}
