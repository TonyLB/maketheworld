# Coyote Game - Implementation Navigation

## Purpose

This document maps where Coyote Game specific behavior currently lives in the codebase, and marks what is temporary or intentionally incomplete.

Use this alongside `AGENT.CoyoteGame.md`:
- `AGENT.CoyoteGame.md` explains product intent and delight hypotheses.
- this file explains technical touchpoints and extension points.

## Current State Summary

There is partial, bespoke support for a Coyote Game demo shape, mostly around room topology and cache scaffolding.

Important: there is currently no global `coyote-game` feature switch wired into guest character generation. Existing support is additive and hard-coded in selected places.

## Where Coyote Game Specific Code Exists

### 0) Global feature switch

- `packages/mtw-base/ts/coyoteGame.ts`
  - Exposes `coyoteGameEnabled` (and default export) as the global switch for Coyote Game specific behavior.
  - Current implementation is a direct code constant: `export const coyoteGameEnabled = true`.
  - Intended as a temporary global gate until a more dynamic rollout path is needed.

Practical meaning:
- new Coyote-specific behavior should be gated behind `coyoteGameEnabled`.
- turning the demo gate on or off is currently a code change.

### 1) Ephemera internal cache: dedicated CoyoteGame cache namespace

- `lambda/ephemera/internalCache/coyoteGame.ts`
  - Defines `CacheCoyoteGameData` with `gameRooms`.
  - Default rooms are `VORTEX`, `STRAIGHTAWAY`, `CLIFFTOP`, `CORNER`, `BRIDGE`.
  - Scope is invocation-local internal cache, not durable storage.
- `lambda/ephemera/internalCache/index.ts`
  - Registers the cache as `internalCache.CoyoteGame`.
  - Clears it as part of `internalCache.clear()`.
- `lambda/ephemera/internalCache/index.test.ts`
  - Tests default values, mutation, and clear behavior.

Practical meaning:
- this provides a small "demo topology" cache hook,
- but does not itself enable or disable demo mode.

### 2) WML primitives initialization: demo room topology in bootstrap

- `lambda/wml/dataSource/initializePrimitives/index.ts`
  - `FULL_PRIMITIVES_WML` includes Coyote demo rooms:
    - `VORTEX`
    - `STRAIGHTAWAY`
    - `CLIFFTOP`
    - `CORNER`
    - `BRIDGE`
  - Repair logic checks and re-adds missing demo rooms.
- `lambda/wml/dataSource/initializePrimitives/index.test.ts`
  - Verifies the full schema and repair behavior with these rooms.

Practical meaning:
- the system bootstrap currently treats this room set as part of baseline primitives.

### 3) Guest character flow (now coyote-aware behind the global switch)

- **Feature behavior (high level)**:
  - when `coyoteGameEnabled` is on, guest identity and character flavor are coyote-specific
  - when off, legacy guest-name generation and hydration behavior remains

- **Where to look in code**:
  - `lambda/diagnostics/player/index.ts` (guest identity generation branch)
  - `lambda/ephemera/guestCharacter/index.ts` (guest character metadata hydration branch)
  - `lambda/updateEphemera/app.ts` (legacy update path kept consistent with the switch)
  - `lambda/ephemera/app.ts` (player-connected entry point calling guest confirmation)
  - `lambda/assets/player/guestNames.ts` (legacy generated-name source)

Practical meaning:
- guest character generation and hydration exist,
- and now support coyote-specific conditional behavior behind `coyoteGameEnabled`.

## Related Data Shapes and Settings

- `Meta::Player` stores `guestName` and `guestId`, which are consumed by ephemera.
- Player `Settings` (notably `onboardCompleteTags`) are available in:
  - `lambda/assets/internalCache/playerSettings.ts`
  - `lambda/assets/player/update.ts`
  - `lambda/assets/players/index.ts`

These settings are per-player and currently onboarding-focused. They are not a global feature-flag framework, but they are one possible substrate if per-player demo toggles are desired.

## Gaps and Explicit Non-Goals (Current)

Current gaps relative to Coyote Game intent:
- no coyote-specific guest generation pattern selection
- no built-in object staging model for Acme objects
- no first-class hypothesis generation pipeline labeled for Coyote loop
- no explicit run memory model dedicated to prior attempt summaries

This is expected for the current stage and aligns with "partial bespoke scaffolding first".

## Getting Started

When adding or changing Coyote Game behavior, start in this order:

1. **Read `AGENT.CoyoteGame.md` first**
   - **Why**: it defines product intent, delight hypotheses, and tone constraints that should drive implementation choices.
   - **Focus**: hypothesis confidence, intelligent interpretation of player intent, and poetic reversal in execution.

2. **Understand current demo scaffolding in ephemera cache**
   - **Why**: this is the clearest existing Coyote-specific runtime hook in ephemera.
   - **Files**:
     - `packages/mtw-base/ts/coyoteGame.ts`
     - `lambda/ephemera/internalCache/coyoteGame.ts`
     - `lambda/ephemera/internalCache/index.ts`
   - **Focus**: global switch semantics, what is invocation-local, and what remains hard-coded.

3. **Understand world bootstrap assumptions**
   - **Why**: demo room topology is currently baked into primitives initialization.
   - **Files**:
     - `lambda/wml/dataSource/initializePrimitives/index.ts`
   - **Focus**: where `VORTEX`, `STRAIGHTAWAY`, `CLIFFTOP`, `CORNER`, and `BRIDGE` are introduced and repaired.

4. **Review guest lifecycle touchpoints**
   - **Why**: guest naming and guest character hydration are likely integration points for a future coyote-mode switch.
   - **Files**:
     - `lambda/ephemera/guestCharacter/index.ts`
     - `lambda/assets/player/guestNames.ts`
     - `lambda/ephemera/app.ts`
   - **Focus**: where names and ids originate, and where they are applied on player connection.

5. **Check nearby tests before and after edits**
   - **Why**: nearby tests encode current contracts and are the fastest guard against regressions.
   - **Files**:
     - `lambda/ephemera/internalCache/index.test.ts`
     - `lambda/wml/dataSource/initializePrimitives/index.test.ts`
   - **Focus**: preserve existing behavior intentionally, and expand tests where Coyote-specific behavior changes.

## Maintenance Notes

- Keep this document implementation-focused and concrete (files, modules, data shapes, and current behavior).
- Keep `AGENT.CoyoteGame.md` narrative-focused (purpose, loop, and delight criteria).
- When Coyote Game support expands, update both docs together so intent and implementation stay aligned.

