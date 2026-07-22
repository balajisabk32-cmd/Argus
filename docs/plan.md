# plan.md — KSP Datathon 2026: Crime Intelligence & Analytical Platform

**Working codename:** Project Argus *(Argus Panoptes — the many-eyed watcher; swap freely, but the visual language below is written around this idea of many simultaneous vantage points, so if you rename it, keep that core metaphor or re-derive the signature element from the new name)*

This file is written to be read by both your teammates and an agentic coding tool (Antigravity or similar). Section 9 is the literal build order — everything above it is the reasoning the build order depends on. Don't let an agent jump straight to scaffolding without the design tokens in Section 4; that's how you end up with the generic dashboard the judges have already seen ten times today.

---

## 1. What we're actually building

The brief (Karnataka State Police, KSP Datathon 2026, problem statement 2) asks for three things bolted together:
1. A geospatial, drill-down crime visualization layer (district → station → hotspot)
2. A criminological **network/link-analysis** layer (suspects, victims, locations, MO)
3. A predictive/sociological analytics layer (risk scoring, anomaly detection, socio-economic overlays)

Every team in the room will build three separate dashboard tabs for these three things. **Our bet: they're not three features, they're three views of one graph.** A case, a person, a location, and a station are all nodes in the same underlying schema (see Section 6 — this is literally what the provided ER diagram already models). So the platform has one persistent 3D scene that *re-projects* the same node graph into map-space, network-space, or time-space depending on which lens you select, with a continuous morph between them instead of a page change. That morph is the demo moment. It's also the technical proof that you understood the data model instead of just theming a template.

Judges are senior officers and SCRB analysts, not consumers (per the brief, 43:20–43:31). Speak to them like operators, not end-users: information density and correctness over cuteness, but rendered with enough craft that it reads as production-grade (per 53:32–54:26, "production-grade" is an explicit bar in the brief).

---

## 2. Judging-criteria alignment (say this out loud in the pitch)

| Brief requirement | Where it lives in our build |
|---|---|
| District-level drill-down | Map Mode, camera dolly from state → district → station |
| Spatiotemporal hotspots ("red-zone pulsing") | Instanced pulse shader on map nodes, driven by a rolling z-score vs. historical baseline |
| Relationship mapping / link analysis | Network Mode — same nodes, force-directed layout |
| Repeat offender / MO tracking | Node detail panel + edge styling by shared-MO similarity |
| Socio-economic correlation | Choropleth overlay toggle underneath the map layer |
| Predictive risk scoring | QuickML pipeline (Section 8), surfaced as a confidence-banded forecast, not a bare number |
| Anomaly detection | Visual call-out ring + audit trail explaining *why* (feature attribution), not just a red flag |
| Zoho Catalyst deployment | Section 8 — Functions, Data Store, QuickML, Stratus |
| Production-grade / scalable | Real schema (Section 6), typed API contracts, seeded synthetic data at realistic volume (Section 7), not five hardcoded rows |

---

## 3. What "anti-slop" means for this specific brief

Read this before anyone opens a component library. Three defaults are what an AI-assisted team produces when it isn't paying attention, and a judge who's seen twenty demos today will clock them instantly:
- Cream background, serif display type, terracotta accent — the "warm SaaS landing page" look. Wrong register entirely for a police ops tool.
- Near-black background with one bright acid-green or vermilion accent, glassmorphism cards, rounded-everywhere. This is the one your team will drift toward by default because "dark mode = serious tool." It's not wrong to go dark — it's wrong to stop there and call it done.
- Broadsheet/newspaper hairline-rule layout. Wrong metaphor for a live ops console.

The one real risk we're taking: **no rounded corners, no glassmorphism.** Every panel is a chamfered (cut-corner) polygon — the shape you'd see on a tactical console or a stenciled equipment case, done with `clip-path`. It's a small CSS decision that touches every surface in the app and is the single thing that makes this *not* look like a Tailwind template. Spend the boldness here and nowhere else — keep motion and color disciplined around it.

---

## 4. Design system

### 4.1 Color — "sodium and slate," not "void and neon"

Grounded in something real: Indian police station signage and streetlights run on warm sodium-vapor amber; case files are red-string-and-corkboard; night ops maps are cold slate-blue. Two accents, not one, because the brief genuinely has two data families (incident/case = warm, network/link = cool) and collapsing them into a single accent color would erase that distinction.

| Token | Hex | Use |
|---|---|---|
| `--bg-void` | `#0A0D12` | App background — near-black but with a blue bias, not pure black |
| `--bg-panel` | `#12161D` | Panel fill |
| `--bg-panel-raised` | `#1A2029` | Hovered/active panel |
| `--line-grid` | `#232B36` | Cartographic grid lines, hairline dividers |
| `--ink-primary` | `#E8EAED` | Primary text |
| `--ink-muted` | `#8890A0` | Secondary text, labels |
| `--signal-amber` | `#F2A93B` | Case markers, primary CTAs, active-case state |
| `--alert-red` | `#E1503F` | Gravity/heinous flags, anomaly rings, hotspot pulse core |
| `--link-teal` | `#3FA9A0` | Network edges, resolved/link-analysis state |
| `--risk-violet` | `#8B7FD1` | Predictive/forecast layer only — keeps "this is a model's opinion" visually distinct from ground-truth data |

Do not let amber and red blend into "just orange" — keep at least one full type-weight or motion-state between them (amber = *this is a case*, red = *this case is escalating*).

### 4.2 Type

- **Display:** Space Grotesk, 600–700, tight tracking (-1%). Used for section headers and big stat numbers only.
- **Data/mono:** JetBrains Mono, 400–500. Used for anything that is literally data: case IDs, timestamps, lat/long, the CrimeNo string. This is a deliberate choice, not decoration — the CrimeNo field in the schema is a structured 18-digit code (category + district + station + year + serial); setting it in mono makes that structure legible the way it would be on an actual terminal.
- **Body:** Inter, 400–450. Everything else.
- Do not use a serif anywhere in this build. It pulls the register toward "editorial," which is wrong for an ops console.

### 4.3 Layout concept

Not a dashboard grid of cards. A **command deck**: full-bleed 3D canvas as the permanent background layer, with chamfered HUD panels docked to the edges (left = filters/layers, right = selected-node detail, bottom = timeline scrubber, top = breadcrumb/mode switch). The canvas is never "a chart embedded in a page" — the page is a set of instruments arranged around the canvas.

```
┌──────────────────────────────────────────────────────┐
│ ARGUS   Karnataka SCRB     [Map] [Network] [Forecast] │  ← top: breadcrumb + mode switch
├────────┬───────────────────────────────────┬──────────┤
│ LAYERS │                                   │  NODE    │
│  filter│         3D CANVAS                 │  DETAIL  │
│  panel │   (map / network / time,          │  panel   │
│ (left) │    same node set, morphs)          │ (right)  │
│        │                                   │          │
├────────┴───────────────────────────────────┴──────────┤
│ ▬▬▬▬▬▬▬▬▬▬▬●▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  timeline scrubber    │
└──────────────────────────────────────────────────────┘
```

### 4.4 Signature element — the morphing node canvas

One `react-three-fiber` scene, three coordinate-mapping functions, one continuous camera+position tween between them:

- **Map Mode:** node xyz = (longitude, elevation-by-gravity-score, latitude), projected over an extruded low-poly mesh of Karnataka's district boundaries. Height of the terrain mesh per district is literally driven by case-density, so the "map" is already a 3D choropleth, not a flat Mapbox tile with dots on it.
- **Network Mode:** node xyz = output of a 3D force-directed layout (`d3-force-3d`) seeded from the current node positions, so nodes visibly *fly* from their geographic position into graph position rather than cutting. Edges = shared CaseMasterID (co-occurrence), shared AccusedMasterID across cases (repeat offender), or shared MO signature.
- **Time Mode:** node xyz = (x/y stay from whichever mode you left, z = time offset from IncidentFromDate), scrubbed by the bottom timeline — this is what answers "spatiotemporal cluster."

This is the thing a judge will remember. Everything else in the app should be quiet by comparison — resist the urge to add particle effects or extra chrome elsewhere.

### 4.5 Self-critique (do this pass before writing code, not after)

- If you swap "police crime data" for "SaaS analytics" in your head and the design still makes sense unchanged, revise it. (Test: would the chamfered-panel + CrimeNo-mono-chip details survive that swap? They shouldn't.)
- Don't use the actual Karnataka Police / Government of Karnataka state emblem or crest anywhere in the build — it's protected government insignia. Design a simple abstract mark (an eye/vantage-point glyph fits "Argus") for the demo instead.
- Cut one thing before the demo. Candidates: the choropleth overlay's default-on state, an extra color, a second font weight in the HUD. Ship the version with one fewer flourish than your first instinct.

---

## 5. Motion spec

Libraries: **`motion`** (the current package name for what was Framer Motion — motion.dev) for all DOM/UI transitions and layout animation; **`@react-three/fiber` + `@react-three/drei` + `three`** for the 3D canvas; **`d3-force-3d`** for network layout physics; **GSAP + ScrollTrigger** only if you add a scroll-driven landing/pitch page (optional, see 5.4); **anime.js** for the small stuff DOM libraries do awkwardly — odometer-style digit rolls on stat counters, SVG line-draw on the timeline scrubber.

Don't reach for all five on every element. Pick one tool per job:

1. **Page load (once, on first paint):** canvas fades in from a flat grid, terrain extrudes upward over ~900ms (ease `expo.out`), node markers pop in staggered by district in reading order, HUD panels slide in from their docked edge last. Total under 1.6s — this is a tool people will use repeatedly, not a hero page they watch once.
2. **Mode switch (Map ⇄ Network ⇄ Time):** the signature morph. ~1200ms, custom eased camera dolly + per-node position tween, panel contents cross-fade at the midpoint (not simultaneously with node motion — stagger it so the eye isn't asked to track two things at once).
3. **Hotspot pulse:** a shader-driven expanding ring on `--alert-red` nodes only, capped amplitude, `prefers-reduced-motion` disables it in favor of a static double-ring glyph.
4. **Hover / selection:** node scale + emissive glow, under 150ms, no bounce/spring on hover states (springs read as playful, wrong register here — use linear or ease-out).
5. **Stat counters:** anime.js digit-roll, triggered once per data refresh, not on every scroll into view.
6. Respect `prefers-reduced-motion` globally: disable the pulse shader and camera dolly, replace the mode-morph with a 200ms cross-fade.

---

## 6. Data model — direct from the provided ER diagram

Use the uploaded `Police_FIR_ER_Diagram.pdf` schema as-is; don't invent a parallel simplified schema. Core entities you'll touch in the UI:

- `CaseMaster` — the FIR itself. `latitude`/`longitude` and `IncidentFromDate`/`IncidentToDate` drive Map Mode and Time Mode directly. `CrimeNo` is your literal display ID (render it in the mono face, keep the structured format visible — category digit + district + station + year + serial).
- `Victim`, `Accused`, `ArrestSurrender` — the person-nodes for Network Mode. `Accused.PersonID` (A1, A2…) is a nice authentic detail to surface in the node label.
- `ActSectionAssociation` → `Act` / `Section` — charge basis. **Use BNS (Bharatiya Nyaya Sanhita) as the primary act code, not IPC** — BNS replaced the IPC as India's substantive criminal code effective July 2024, so a 2026 platform should default to it (keep IPC mappable for historical-case data, since older FIRs will legitimately still reference it).
- `CrimeHead` / `CrimeSubHead` — your taxonomy for the "crime category spike" alerts.
- `GravityOffence` — drives node elevation/size in Map Mode and the red-alert threshold.
- `Unit` / `UnitType` / `District` / `State` — your drill-down hierarchy (state → district → station), matches the brief's "District-Level Drill-down" requirement almost verbatim.
- `CaseStatusMaster`, `ChargesheetDetails` — case lifecycle, used in the timeline scrubber.
- `CasteMaster`, `ReligionMaster`, `OccupationMaster` (on `ComplainantDetails`) — **see 6.2 before you touch these in the UI.**

### 6.1 Synthetic data generation

Real KSP data is sensitive and won't be released (brief, 17:42–18:17); you'll be scored partly on how convincing your synthetic data is. Build a seed script (Python, `Faker` + a fixed `numpy` RNG seed for reproducibility) that:
- Generates ~25–30 Karnataka districts (Bengaluru Urban, Mysuru, Dakshina Kannada, Belagavi, Kalaburagi, Ballari, Tumakuru, Dharwad, Udupi, Kodagu, etc.) with realistic relative case volumes (Bengaluru Urban should dominate, not be uniform).
- Distributes `IncidentFromDate` with actual seasonal/weekly structure (property crime spikes around festivals, not flat-random) — this is what makes "predictive risk scoring" demo convincingly instead of predicting noise.
- Keeps `CrimeNo` format-correct per the schema's own spec (1-digit category + 4-digit district + 4-digit station + 4-digit year + 5-digit serial) — small detail, big credibility signal to judges who know the schema.
- Generates co-occurrence structure on purpose: a handful of `Accused` records deliberately linked across multiple `CaseMaster` rows with consistent MO fields, so Network Mode has real clusters to find instead of a random graph.

### 6.2 Responsible-design note (worth stating explicitly in the pitch — it's a strength, not a caveat)

`CasteMaster` / `ReligionMaster` are real fields in the official schema (used for mandated demographic reporting, not something this project introduces), but:
- Never render individual-level caste/religion in any node label, tooltip, or detail panel. Aggregate-only, statutory-reporting views, access-gated.
- If the predictive risk model touches these fields at all, they must not be direct model features — proxy discrimination through correlated fields (e.g., locality standing in for religion) is a real risk in policing ML and a judge from an analytics background will ask about it. Have an answer: feature list shown transparently in the model card, protected attributes excluded from training features, used only for post-hoc fairness auditing of model outputs across districts.
- Gate PII-bearing views (`Victim`, `Accused`, `ComplainantDetails` full records) behind a role check — the brief explicitly scopes the user base to senior officers/investigators, not the public. Model that in the UI with a visible clearance-level indicator, even in the demo.

---

## 7. Tech stack

**Frontend**
- Next.js (App Router) + TypeScript
- `@react-three/fiber`, `@react-three/drei`, `three`
- `motion` (motion.dev)
- `d3-force-3d` for network layout physics
- `maplibre-gl` or raw `three` terrain mesh for the district base layer (prefer the custom three.js terrain — it's what makes the map *part of* the 3D scene instead of a Mapbox iframe with a 3D layer bolted on)
- Recharts or a custom D3/three hybrid for the stat panels (small charts don't need three.js — reserve the 3D budget for the signature canvas)
- Tailwind for utility layout, but every color/spacing token pulled from the design system in Section 4, not Tailwind defaults

**Backend — Zoho Catalyst** (confirmed current as of this writing; recheck the console before build day since Catalyst ships changes often)
- **Catalyst Functions** (Node.js) for the REST API layer over the schema
- **Catalyst Data Store** (NoSQL) or an external Postgres via Catalyst's connectors for the relational FIR schema — given the schema is genuinely relational (lots of FKs), a SQL-shaped store will save you pain; check whether Catalyst's own relational offering fits or bridge to a managed Postgres
- **Catalyst QuickML** for the predictive risk-scoring pipeline — no-code pipeline builder, supports classification/regression, has an AutoML path if you're short on time; use its dataset-import + pipeline-builder flow rather than hand-rolling a model, it'll demo more reliably under time pressure
- **Catalyst Zia** OCR service if you want a "scan a paper FIR" demo moment — nice bonus feature, not core path
- **Catalyst Stratus** for any file storage — note: Catalyst's older **File Store and Cron are in deprecation, EOL 30 April 2026**, so don't build against them; use Stratus for storage and Catalyst's current scheduler for anything time-triggered
- **Catalyst Cache** for hot-path aggregate queries (district counts, hotspot z-scores) so the map doesn't recompute on every camera move

---

## 8. Page-by-page breakdown

1. **Landing / mode-select** — brief hero: the canvas already loaded and idling in Map Mode over the whole state, HUD chrome minimal. One clear CTA into the SCRB console. This is the only page GSAP ScrollTrigger is worth adding, if at all — a single scroll-driven zoom from state-level to a district as the pitch's opening beat.
2. **SCRB Command Console (Map Mode)** — the main screen. Left panel: district/crime-category/date-range filters. Canvas: extruded terrain, pulsing hotspots. Right panel: selected district/station summary. Bottom: timeline scrubber.
3. **Network / Link Analysis (Network Mode)** — triggered from a case or accused node, or directly from the mode switcher. Same canvas, morphed. Right panel becomes a node-detail card (person or case), with an MO-similarity list.
4. **Case Dossier** — a 2D detail view (not 3D — don't force it) for a single `CaseMaster`: complainant, victims, accused, acts/sections, chargesheet status. This is where the chamfered-panel, mono-CrimeNo styling does the most work.
5. **Forecast / Anomaly view** — QuickML output surfaced as a confidence-banded time-series per district/crime-head, plus an anomaly feed with feature-attribution explanations, not bare alerts.
6. **Access/role screen** — brief, but present it in the demo; it's what earns credibility on the "senior officers only" requirement.

---

## 9. Build order (for the agent / for the team, hour-boxed for a ~36hr datathon)

Adjust hours to your actual event length, but keep the *order* — get the real 3D scene up with fake nodes before touching styling, or you'll polish a shell that has to be gutted later.

1. **[0–2h] Scaffold.** Next.js + TS + Tailwind, design tokens from Section 4 as CSS variables, basic chamfered-panel component, font loading.
2. **[2–6h] Schema + seed data.** Stand up the tables from Section 6 (whichever store you land on), write and run the Faker seed script, sanity-check the CrimeNo formatting and district distributions.
3. **[6–7h] API layer.** Catalyst Functions exposing filtered case/node queries; keep response shape identical whether the frontend is about to render Map or Network mode (it's the same node list either way, just different projections).
4. **[7–14h] The canvas — Map Mode only first.** Terrain mesh, node instancing, hotspot shader, camera controls. Get this feeling *good* before starting Network Mode.
5. **[14–18h] Network Mode + the morph.** `d3-force-3d` layout, position-tween on mode switch. This is the highest-risk, highest-payoff item — don't leave it for the last few hours.
6. **[18–20h] Time Mode + timeline scrubber.**
7. **[20–24h] Case Dossier + right-panel detail views.**
8. **[24–28h] QuickML pipeline** — get *something* forecasting, even a simple regression on historical district/crime-head counts; wire its output into the Forecast view.
9. **[28–31h] Anomaly feed + access/role screen.**
10. **[31–34h] Motion pass** — apply Section 5 systematically, don't sprinkle it ad hoc; then do the self-critique pass from 4.5 and cut one thing.
11. **[34–36h] Pitch rehearsal** using Section 2's table as your talking points, with the demo path being: Map Mode → click a hotspot → morph into Network Mode on that case's accused → open Case Dossier → cut to Forecast view predicting the next spike. That's one continuous camera-and-data story, not four separate screenshots.

---
