# Rescue Camp Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration and superpowers:dispatching-parallel-agents for independent model and collection domains. Steps use checkbox syntax.

**Goal:** Implement approved rescue-camp homepage, daily supply, rescue manual, independent music/effects, and finer model appearance with same six gameplay colors.
**Architecture:** Retain standalone game and existing album identity service. A separate camp entry shares local state and links to the bundled game. Separate visual tint from logical color; retain legacy decoding. Browser-first, Creator runtime explicitly unverified.
**Tech Stack:** Existing TypeScript, Three.js, esbuild, browser Web Audio and local storage.
**Spec:** docs/archive/2026-11-17-rescue-camp-visual-proposal-session.md; approved by user in current session.

## Global Constraints
- Keep constant fast clearing and one-second drag-release auto-rotation.
- Retain guest/account collection isolation, real counts, and explicit simulated ads.
- Six logical ammo colors; tint must not alter quota or solvability.
- New daily reward is local guest prototype; no claim of production server validation.

## Review Focus
- Denied/corrupt storage must keep game usable and not silently spend rewards.
- Refresh or double tap cannot grant daily reward twice on normal local storage.
- Enter/exit camp, album and settings must not advance a paused game.
- Appearance detail must disappear with owning cell; legacy models must still load.
- Mobile safe areas and four supply rows must remain accessible.

### Task 1: Model appearance and density comparison
**Files:** sampler, appearance helper, shared cell/decoder types, wizard presets, ready page, appearance tests.
- [x] Test tint validity/legacy import and unchanged gameplay color/quotas.
- [x] Add bounded visual shades, attached wizard face details, finer seams; generate approximately6000 comparison within cap, preserve4500 baseline.
- [x] Verify decoder, preset conservation, replay and render screenshots.

### Task 2: Rescue manual and local camp state
**Files:** album.js, camp-state.js and tests.
- [x] Test local-day single claim, malformed data and independent audio preferences.
- [x] Implement storage module and chaptered two-column manual, collected model inspect; preserve auth service and real collection counts.
- [x] Verify identity regressions and state tests.

### Task 3: Camp UI and game integration
**Files:** camp entry/main/style, build-color-clear.mjs, game main/index/style, browser check.
- [x] Create original camp scene with duck, main CTA, envelope daily supply, settings and manual.
- [x] Integrate independent audio, reward spend and rescue win reveal without altering game rules.
- [x] Browser-check homepage→play→camp, daily double claim, audio toggles, model detail, manual, small-screen layout and input/rotation regressions.

### Task 4: Verification and delivery
- [x] Run appropriate full tests, type/build, browser checks; independent review and fixes.
- [x] Record implementation/limits, update state/design/roadmap and sync main without overwriting remote changes.

## Completion evidence

214/214 full tests, strict type/build, new camp and four existing browser regression scripts passed; important cross-frame collection and comparison-run replacement findings fixed with regression coverage. Current-page resume only; native UI, real daily backend and mobile performance remain explicitly unverified. See implementation archive.
