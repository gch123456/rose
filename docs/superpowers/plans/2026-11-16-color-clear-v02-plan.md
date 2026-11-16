# Color Clear V02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the accepted second-round feedback, including ammo-preserving rewarded continuation, cleaner UI, visible launcher projectiles and non-box animal models.
**Architecture:** Extend the shared pure model with delayed/reserved impacts, shape-aware visibility, 4–6 slots, reserve tray and run-scoped reward tickets. Update WebGL UI; keep real ads explicitly outside this browser prototype. Synchronize the unverified Cocos adapter with the shared interfaces without hand-authoring scene/meta.
**Tech Stack:** TypeScript, Three.js, Node tests, browser UI checks, Cocos 3.8 adapter.
**Spec:** docs/design-drafts/2026-11-16-color-clear-v02-feedback.md; user accepted the proposed ammo-preserving reserve continuation in conversation.

## Global Constraints

- Four base slots, fifth/sixth separately rewarded, per-run only; prototype one continue per run.
- No forced sharing, no fake real-ad success: browser offers an explicit simulated-complete/cancel flow.
- Preserve model, queue, ammo, yaw, slot capacity and level on continue; discard no remaining ammo; reserve can be reloaded independently of supply fronts.
- Projectile arrival causes impact; reservations prevent duplicate targets; pending impacts prevent false defeat/victory; pause freezes travel.
- Progress/remaining/copy independently configurable and hidden by default; empty base slots have no plus; background enabled.
- Primitive animal pieces use matching logical sphere/cylinder/hemisphere/wedge intersections, not just changed visuals.
- Preserve old GoDuck and default engine profile. No Creator available: do not claim Cocos/WeChat/device validation.

## Review Focus

1. Late/duplicate/cancelled rewards must not grant a slot or revive a different/restarted level.
2. Rescue must preserve exact capsule IDs and remaining ammo, and not re-block supply fronts.
3. Pending bullets/core cascades must not overspend or clear twice; targets rotate while travelling.
4. Arbitrary angles with curved pieces must use the rendered geometry convention.
5. Small-screen layouts must fit six launchers plus four supply columns and reserve controls.

### Task 1: Shared rule changes
**Files:** ColorClearGame.ts, ColorClearLevels.ts, tests/color-clear*.test.mjs.
**Interfaces:** beginReward(kind), resolveReward(ticket,completed), takeReserve(index); flights; optional shape; unchanged select/rotate/tick public controls.
- [x] Write failing tests for delayed impact/reservations, pause, 4→5→6, cancel/stale/duplicate rewards, preserve-and-reload continuation, curved occlusion and all ten solution witnesses.
- [x] Implement shape intersections and critical angular partitions, pending impacts and reward/reserve state.
- [x] Generate original duck/rabbit/cat silhouettes with non-box primitives; adapt solution simulation to delayed impacts.
- [x] Run new and full rule suite, strict shared-rule type check.

### Task 2: Browser presentation and input
**Files:** preview/color-clear/main.js, index.html, style.css; new shapes.js; tools/check-color-clear-browser.mjs.
- [x] Test no-plus/default-hidden indicators, actual muzzle-to-target flight before removal, simulated slot rewards/cancel, reserve rescue and small viewport.
- [x] Implement six-position launcher UI, reserve tray, named simulation modal, SVG overlay projectiles from real slot bounds, muzzle feedback, optional HUD/copy and toy-workshop background.
- [x] Render matching primitives and animal identity; retain sound/rotation/chain cues and local progress.
- [x] Build offline preview and exercise actual browser inputs, progression and screenshots.

### Task 3: Adapter, review and delivery
**Files:** ColorClearView.ts; docs/COLOR_CLEAR.md, STATUS, DESIGN, ROADMAP, archive, CHANGELOG.
- [x] Synchronize Cocos adapter with impact events/capacity/reserve state; keep runtime validation pending.
- [x] Independent whole-change review, fix important findings with regression tests.
- [x] Final tests/type check/bundle/UI/diff/links; record actual boundaries; sync fast-forward to remote.

## Execution ledger

- Starting commit a62209a; normal project checkout, feature branch used; no Creator installed.
- User's acceptance authorizes implementing the previous proposed changes; one-continue/per-run slots are prototype tuning defaults, configurable later.

- Task 1 complete: delayed/reserved hits, curved intersections, tickets, capacity and ammo-preserving rescue; ten animal-level witnesses green.
- Task 2 complete: actual browser flows, explicit simulation, six slots, HUD/background, reserve and launch-to-model paths.
- Task 3 complete within available environment: adapter/geometry code synchronized, independent review fixed, docs updated; Creator/WeChat/device certification explicitly remains pending.
- Review regression evidence: short-screen all-HUD/reserve clipping RED→GREEN; missing projectile during pending shot RED→GREEN; wedge outward normal RED→GREEN.
- Ruling: use sphere/cylinder/hemisphere/wedge animal pieces with analytical footprints, not arbitrary high-poly mesh slicing. Cost: limited first-round model vocabulary, runtime geometry stays understandable and testable.
- Ruling: 5th/6th slots are per-run; one continuation per run. These are prototype defaults, not a validated monetization strategy.
