# SPIDER·VERSE — Into the Web

An Awwwards-tier, immersive Spider-Man tribute built with **Next.js (App Router)**,
**React Three Fiber**, **GSAP + ScrollTrigger**, **Lenis**, and **TailwindCSS**.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start
```

> Requires Node ≥ 18.18. Tested on Node 24.

## Experience flow

1. **Preloader** — animated SVG turbulence "spider-sense tingle" + 0→100 counter.
2. **Hero Intro** — full-screen WebGL canyon. The camera *dives* (ease-in-quad on
   Y, ease-in-cubic on Z) with a tightening lateral weave, then a web strand
   *shoots toward the screen* in the final 22% and a white flash cuts to the hero.
3. **Hero** — fluid editorial type, cursor-following generative web, magnetic CTAs.
4. **The Suit** — interactive 3D distorted-core viewer (drag to rotate).
5. **The City** — parallax grid of cinematic shots (ScrollTrigger scrub).
6. **The Legacy** — pinned horizontal-scroll timeline.

## Architecture

```
spiderverse/
├── app/
│   ├── layout.tsx        # fonts (Syne / Space Grotesk / Instrument Serif) + globals
│   ├── globals.css       # design tokens: palette, type scale, easing, grain, glass
│   └── page.tsx          # phase orchestration (preload → intro → ready)
├── components/
│   ├── Preloader.tsx     # spider-sense tingle + count-up
│   ├── HeroIntro.tsx      # ★ R3F camera dive + web pull-in (real math)
│   ├── CursorWeb.tsx     # generative cursor-following particle web (2D canvas)
│   ├── Hero.tsx          # editorial hero + magnetic CTAs
│   ├── Nav.tsx
│   ├── SmoothScroll.tsx  # Lenis ↔ GSAP ticker bridge
│   └── sections/
│       ├── TheSuit.tsx   # interactive 3D viewer
│       ├── TheCity.tsx   # parallax grid
│       └── TheLegacy.tsx # horizontal scroll timeline
├── hooks/
│   ├── useMousePosition.ts
│   └── useMagnetic.ts     # weighted magnetic hover
└── lib/
    ├── gsap.ts            # plugin registration + global defaults
    └── tokens.ts          # COLORS, EASE, easing math, seeded PRNG
```

## Notes / swaps

- **Real assets:** drop cinematic stills into `TheCity` panels (replace the
  gradient `tone` classes with `<Image>`), and a `.glb` suit model into `TheSuit`
  via `useGLTF` from `@react-three/drei`.
- **SSR:** all WebGL lives in `"use client"` components. If you hit an SSR error
  from `three`/`drei` during `next build`, wrap the section in
  `dynamic(() => import("./X"), { ssr: false })`.
- **Performance:** `dpr={[1,2]}` caps retina cost; instanced meshes for the city;
  `transpilePackages` set in `next.config.mjs`.

## Fonts (recommendations)

| Role | Font | Why |
|------|------|-----|
| Display / Headlines | **Syne** (800) | Geometric, fashion-editorial, holds huge weights |
| Body / UI | **Space Grotesk** | Technical, neutral, modern agency |
| Accent / Pull-quotes | **Instrument Serif** | Editorial contrast |

Alt for display: *Clash Display* (Fontshare) for an even more "designed" feel.
