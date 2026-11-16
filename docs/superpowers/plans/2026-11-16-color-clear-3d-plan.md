# Color Clear 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the approved portrait colour-capsule/rotation/chain gameplay as a playable real-3D prototype, with shared rules and a Cocos entry adapter.

**Architecture:** Pure TypeScript rules and authored deterministic voxel levels; a self-contained WebGL browser preview for immediate play, and a Cocos 3.8 component adapter for the same rules. Preserve Home and the old 2D engine profile. This machine has no Creator executable/MCP, so do not hand-author scene/meta assets or claim a Creator build.

**Tech Stack:** TypeScript, Node test runner, Three.js (browser preview only), Cocos Creator 3.8.8 adapter.

**Spec:** docs/design-drafts/2026-11-16-color-clear-gameplay-ui-draft.md (accepted in conversation; user explicitly requested implementation).

## Global Constraints

- Portrait one-handed input; real 3D blocks; drag rotates the model, changes visible targets.
- Four active slots; four supply columns with visible next capsule; simultaneous auto-fire; no shots spent without target; refill any free slot immediately.
- Visible chain cores; finite deterministic, solvable introductory levels; no timer, ads, forced share or purchases.
- Original procedural geometry, palette and synthesized audio; preserve old GoDuck entry/resources/config.
- Existing project has no Creator on this machine: real Cocos diagnostics, scene authoring, builds and phone tests are follow-up checks, never claimed complete.

## Review Focus

- Full slots with targets on another side must not lose; all-angle deadlock is a geometric check, not a timeout.
- Multiple simultaneous capsules cannot consume the same block twice or fire below zero.
- Fast selection cannot duplicate a capsule; replay resets all state and events.
- Cancelled drag/background pause/resizing must not leave rotation or time running.
- Level generation must have a tested winning path and sufficient ammunition, including chain removals.

### Task 1: Shared rules and ten levels

**Files:** Create assets/scripts/color-clear/ColorClearGame.ts, ColorClearLevels.ts; tests/color-clear.test.mjs.
**Interfaces:** ColorClearGame(level), select(column), rotate(delta), tick(dt), visibleTargets(), drainEvents(); level cells carry x/y/z/color/core; slots and supply are immutable to UI callers by convention.
- [x] Write tests for occlusion/rotation, admission/full slot, no-target ammunition, simultaneous shots/chain, true deadlock vs offscreen targets, retry/pause and ten-level winning paths.
- [x] Run tests and observe missing implementation failures.
- [x] Implement geometry and state machine, level generation and known solution witness.
- [x] Run node --test tests/color-clear.test.mjs and npm test; expected green.

### Task 2: Real-3D playable browser UI

**Files:** Create preview/color-clear/{index.html,main.js,style.css}; tools/build-color-clear.mjs; update package scripts and dependencies.
**Interfaces:** Consume Task 1 state/events; view owns Three renderer, bounded particles, input, synthesized audio and progress storage.
- [x] Add interaction smoke coverage for boot, selection, rotation, pause/restart, touch-sized layout, console errors.
- [x] Implement cream/mint portrait UI, instanced voxel mesh, slot/supply buttons, target/core cues, bullets/fragments, audio toggle and progression.
- [x] Bundle offline-capable preview/color-clear.html; validate Chromium desktop and mobile viewports with real pointer interaction and screenshots.

### Task 3: Cocos adapter, handoff and verification

**Files:** Create assets/scripts/color-clear/ColorClearView.ts; tools/prepare-color-clear-cocos.mjs; docs/ archive, STATUS, DESIGN, ROADMAP, CHANGELOG, README.
**Interfaces:** Adapter uses shared model with procedural MeshRenderer + fixed-angle camera + 2D UI; preparation tool adds a named 3D profile without changing default 2D profile, Creator imports script/meta itself.
- [x] Implement a Cocos component that can be attached through Creator, with touch filtering, UI refresh, model rotation, auto-fire, basic effects and sound.
- [x] Add and exercise profile preparation --check/--apply behavior; default 2D config remains untouched.
- [x] Run full tests, strict shared-rule TypeScript checks, browser full-loop checks, bundle rebuild, git diff --check; document actual vs pending Creator/WeChat checks.
- [ ] Review whole change, fix important issues, record evidence and sync normal fast-forward to remote.

## Execution ledger

- Baseline: npm test 102/102. Current branch codex/color-clear-3d; no worktree created because user authorized working in this project and no Creator is active. Existing checkout is preserved on a feature branch.
- Ruling: use Three.js only for immediate browser preview because Creator/MCP unavailable here; Cocos adapter shares the rule layer. Cost: Cocos integration cannot be runtime-certified on this device.

- Task 1: complete; 13 rule tests including an independently derived world-camera sign regression.
- Task 2: complete; actual WebGL browser validation, victory and next level; flight, core range and inertia included.
- Task 3: code and profile/audio preparation complete; Cocos runtime certification remains explicitly pending because Creator is unavailable.
- Final review: independent reviewer found and verified rotation-sign bug plus weak drag assertion; both corrected with regression evidence.
- Ruling: horizontal orthographic camera and full-unit logical occluders match exact all-angle reachability; display blocks leave a decorative seam, which is not an aiming gap. Cost: no free vertical orbit in this prototype.
