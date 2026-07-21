"use client";

import { useState } from "react";
import Preloader from "@/components/Preloader";
import HeroIntro from "@/components/HeroIntro";
import Hero from "@/components/Hero";
import Nav from "@/components/Nav";
import SmoothScroll from "@/components/SmoothScroll";
import TheSuit from "@/components/sections/TheSuit";
import TheCity from "@/components/sections/TheCity";
import TheLegacy from "@/components/sections/TheLegacy";

/**
 * PHASE ORCHESTRATION
 *  1. Preloader      → spider-sense tingle + counter
 *  2. HeroIntro      → Three.js camera dive + web pull-in (fixed, z-50)
 *  3. Ready          → nav fades in, hero + narrative become interactive
 *
 * The main content is mounted underneath from the start so the WebGL intro
 * simply dissolves to reveal it (no layout jump).
 */
export default function Page() {
  const [preloadDone, setPreloadDone] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  return (
    <SmoothScroll>
      <Nav visible={introDone} />

      {!preloadDone && <Preloader onComplete={() => setPreloadDone(true)} />}
      {preloadDone && !introDone && (
        <HeroIntro onComplete={() => setIntroDone(true)} />
      )}

      <main id="top">
        <Hero />
        <TheSuit />
        <TheCity />
        <TheLegacy />

        <footer className="px-[var(--gutter)] py-20">
          <div className="mx-auto flex max-w-[var(--maxw)] flex-col items-start justify-between gap-6 border-t border-white/10 pt-10 md:flex-row md:items-center">
            <p className="font-display text-2xl font-extrabold tracking-tightest text-bone">
              SPIDER<span className="text-volt">·</span>VERSE
            </p>
            <p className="max-w-sm text-[var(--step--1)] text-ash">
              A fan-made, non-commercial immersive tribute. Built with Next.js,
              React Three Fiber, GSAP &amp; Lenis.
            </p>
          </div>
        </footer>
      </main>
    </SmoothScroll>
  );
}
