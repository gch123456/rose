# Album and Full Model Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the frontend/shared model; independent backend work may proceed concurrently under dispatching-parallel-agents.

**Goal:** Complete rapid-input repair, collect completed models into a guest/account album, support vertical observation and start with gentle automatic rotation.
**Architecture:** Stable interactive DOM controls; shape-aware 3D ray tests with yaw/pitch; guest album persisted locally, WeChat account album through Java backend. Frontend and backend share the explicit API below. Keep Cocos/WeChat actual runtime validation explicitly pending on this machine.
**Tech Stack:** Existing TypeScript/Three/Node tests; Java 21 + Spring Boot backend and persistent H2 storage.
**Spec:** User requests in conversation: fix continuous taps; gallery per completed model, guest vs login; top/bottom rotation; default auto-rotation with agent-chosen rate; user selected WeChat login.

## Requirements and choices

- Preserve actual pointer targets during ammunition updates. Decorative flights must never intercept supply/reserve taps.
- Drag X controls yaw; drag Y controls pitch within ±90°. Initial pitch about 15°, auto yaw8°/second. First manual interaction stops auto-rotation; reset for a new level; pause/reward freezes it.
- Real 3D visibility must follow the same model transform. Existing horizontal behavior at pitch0 remains tested. Do not falsely declare deadlocks based only on one latitude.
- Album records a unique unlocked model/level and first completion date. No economy rewards or competitive anti-cheat claims.
- Guest album local; authenticated album cloud; logged-in cache separate by account. Successful login merges guest unlocked IDs by union, not overwriting cloud. Failed network retains pending unlocks for retry.
- No AppSecret or session_key in client/repo. Real wx.login requires configured account and a deployed HTTPS server; browser must not invent WeChat identity.

## Backend contract

POST /api/auth/wechat {code} -> {token,expiresAt,user:{id}}
GET /api/album (Authorization: Bearer token) -> {version:1,entries:[{levelId,unlockedAt}]}
POST /api/album/complete {levelId} -> same album; idempotent per user/level.
POST /api/album/merge {levelIds:[1,2]} -> union album; server timestamps new entries.
POST /api/auth/logout -> 204; token revoked.
GET /api/health -> simple availability, no secrets.
All protected routes authenticate and scope by session user, never userId from request. Known levelIds1–10 only. No real WeChat mock bypass in production; tests replace gateway only inside tests.

## Tasks

- [x] Reproduce pointer-down across real firing update and flight-overlap, repair stable controls, run actual touch and mouse checks.
- [x] Write tests for pitch transforms/vertical occlusion, opening spin/manual stop and pause; implement safe reachability and matching native/browser transforms.
- [x] Implement/test guest album, authenticated client/merge/retry/logout and gallery UI; fake API only in automated tests.
- [x] Independently build/test backend with code exchange, hashed expiring bearer sessions, account-scoped persistence/merge, minimal production configuration docs.
- [x] Integrate local API forwarding, build preview, full rule/type/browser/backend checks, independent review, docs and remote sync.

## Ledger

- Starting commit bafce63. User preference for WeChat login confirmed asynchronously.
- Rapid-input root cause reproduced: supply DOM replaced by live fire refresh; decorative flying capsules can overlap hit targets.

- Shared model tests and strict checks complete; exact3D intersections plus proof-based conservative deadlock fallback.
- Backend independently implemented and checked:12tests, packaged jar and real HTTP smoke; no live credentials or deployment.
- Browser actual checks cover stable physical input, full orbit/auto-spin, real win recording, guest mode, account merge via test-only mock, and modal Escape.
- Review fixes verified RED→GREEN: stale login vs logout (including native-code phase), out-of-order logins, album Escape; native repeated open guarded and modal input blocked.
- Ruling: if a mixed curved enclosure cannot be proved closed, keep playing rather than lose on sparse direction sampling. Cost: some genuine curved deadlocks can require manual restart; difficulty work remains.
- Ruling: achievements are cosmetic unique model unlocks, not anti-cheat proof or economy rewards. Browser has no real WeChat login code; production credentials/HTTPS configured separately.
