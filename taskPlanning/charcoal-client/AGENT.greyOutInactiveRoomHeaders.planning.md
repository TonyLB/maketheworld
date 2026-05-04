# Grey out inactive (non-live) room headers in the play transcript

**Status:** In progress (palette split and "Live" chip removal landed in `RoomDescription`; D1 affordance threading still pending).

**Next step:** Extend `RoomExit` / `RoomCharacter` / `CharacterChip` per D1 (Recommended order line below).

This document follows the task planning framework in [`taskPlanning/AGENT.md`](../AGENT.md) (durability, what belongs here vs in package docs, checkbox conventions). When the feature ships, move any lasting UI notes into [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or an adjacent message doc, then **delete or archive** this file so `taskPlanning/` stays current.

**Area dev notes (tests, commands):** [`AGENT.development.md`](AGENT.development.md) and [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md).

---

## Problem statement

In the play-mode message list, room block headers use a **light blue** treatment and a **"Live"** chip when they represent the **current** room section (last group in the transcript). That reads well at the **bottom** of the feed. It is **misleading** when the user has **scrolled up** (historical context) or when a **newer** room section exists **below the fold**: the stuck or visible header can look as "active" as the true current room.

**Proposed direction:** Remove the "Live" chip. Use **two display modes** for `RoomDescription` in **header** (sticky group header) context:

- **Live / active** --- keep the existing light blue palette (and equivalent affordance styling).
- **Historical / inactive** --- **grey** palette for the header strip, exits, and player affordances, so the eye reads "archive" without relying on a text label.

**Definition of "live":** The **last message group** in the transcript is **live** relative to **game reality** (current room section), **independent of scroll position**. We are **not** tying "live" to which sticky header is at the top of the viewport; scroll-synced live would be a separate product effort if ever requested.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md) once if task-plan conventions are unfamiliar.
2. Read [`charcoal-client/AGENT.development.md`](AGENT.development.md) and [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md) for **Vitest** commands. If any command conflicts, prefer **`AGENT.testing.md`** for this package.
3. Baseline: from repo root, `cd charcoal-client` and run `npm run test:single` (or a narrow run against message components) so you have a clean baseline before UI edits.
4. Code touchpoints (read before implementing):
   - [`charcoal-client/src/components/Message/VirtualMessageList.tsx`](../../charcoal-client/src/components/Message/VirtualMessageList.tsx) --- `currentHeader={index >= messageBreakdown.Groups.length - 1}` passed into sticky headers.
   - [`charcoal-client/src/components/Message/RoomDescription.tsx`](../../charcoal-client/src/components/Message/RoomDescription.tsx) --- live (blue) vs historical (grey) shell gradient from `useLivePalette`; maps to `RoomExit` / `RoomCharacter`.
   - [`charcoal-client/src/components/Message/RoomExit.tsx`](../../charcoal-client/src/components/Message/RoomExit.tsx) --- default MUI `Chip`.
   - [`charcoal-client/src/components/Message/RoomCharacter.tsx`](../../charcoal-client/src/components/Message/RoomCharacter.tsx) and [`charcoal-client/src/components/CharacterChip/index.tsx`](../../charcoal-client/src/components/CharacterChip/index.tsx) --- `CharacterStyleWrapper` (per-character theme) for nested chips.
5. Durable architecture for the message list: [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) (link only; do not duplicate here).

---

## Decisions (resolved)

| ID | Topic | Resolution |
| --- | --- | --- |
| D1 | **Character affordances** | Add a **`variant`** prop on [`CharacterChip`](../../charcoal-client/src/components/CharacterChip/index.tsx). **`inactive`** means **plain grey** initially (neutral affordances for historical room headers). Keep the plumbing so we can later experiment with **muted** character-tinted styling without another API churn. |
| D2 | **Generating state** | **`isGenerating`** rows use **live (blue)** styling even when `currentHeader` is false (reasonable default for this edge case). |
| D3 | **Description links** | **Out of scope** for this task; optional follow-up ([`RenderTreeContent`](../../charcoal-client/src/components/Message/RenderTreeContent.tsx) / [`DescriptionLink`](../../charcoal-client/src/components/Message/DescriptionLink.tsx)). |
| D4 | **`currentHeader` default** | **`currentHeader` defaults to false** when omitted / undefined (historical styling); avoids inline [`Message/index.tsx`](../../charcoal-client/src/components/Message/index.tsx) paths looking "live" by accident. |
| D5 | **Definition of live** | **Last group** remains the **normative** definition of live: it reflects **game reality**, not user scrolling. No Virtuoso range-based "live" in this task. |

---

## Implementation sketch (non-binding)

- Treat **`currentHeader`** as explicitly **`Boolean(currentHeader)`** or default **`false`** when implementing styling so undefined stays historical (D4).
- Introduce a derived flag in `RoomDescription`, e.g. **`useLivePalette = isGenerating || Boolean(header && currentHeader)`** (D2 + live definition).
- Centralize **palette tokens** (MUI `blue` vs `grey` gradients, text contrast, divider) in one object or small helper to avoid drift between `isGenerating` and normal branches.
- Remove [`MiniChip`](../../charcoal-client/src/components/MiniChip.tsx) "Live" usage from [`RoomDescription.tsx`](../../charcoal-client/src/components/Message/RoomDescription.tsx).
- Thread **`affordanceTone`** (or boolean) into `RoomExit` and `RoomCharacter`; **`RoomCharacter`** passes **`variant="inactive"`** to **`CharacterChip`** for historical headers (D1). **`CharacterChip`**: add **`variant`** (`default` vs **`inactive`**); **`inactive`** renders **plain grey** and skips or overrides [`CharacterStyleWrapper`](../../charcoal-client/src/components/CharacterStyleWrapper/index.tsx) so future muted variants can swap implementation behind the same prop.
- Update [`RoomDescription.test.tsx`](../../charcoal-client/src/components/Message/RoomDescription.test.tsx) (remove or replace assertions on `"Live"` text; add coverage for grey vs blue if stable enough for RTL).

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created; decisions D1-D5 captured | Done |
| D1-D5 resolved in this doc | Done |
| Implementation in `RoomDescription` + children | Partial (`RoomDescription` palette; exits/characters pending D1) |
| Tests green; task plan checkboxes updated | Partial |
| Lasting notes moved to package doc; this file removed/archived | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as you complete them so partial progress is visible.

- [X] Resolve **Decisions** D1-D5 (see table above).
- [X] Baseline tests: `cd charcoal-client && npm run test:single` (see [`AGENT.development.md`](AGENT.development.md)).
- [X] Implement palette split and remove "Live" chip in [`RoomDescription.tsx`](../../charcoal-client/src/components/Message/RoomDescription.tsx); align `isGenerating` with D2.
- [ ] Extend [`RoomExit.tsx`](../../charcoal-client/src/components/Message/RoomExit.tsx) (and optionally [`RoomCharacter.tsx`](../../charcoal-client/src/components/Message/RoomCharacter.tsx) / [`CharacterChip`](../../charcoal-client/src/components/CharacterChip/index.tsx)) per D1.
- [X] Update [`RoomDescription.test.tsx`](../../charcoal-client/src/components/Message/RoomDescription.test.tsx) and any snapshot or RTL expectations.
- [X] `npm run test:single` (full package or scoped to `src/components/Message`).
- [ ] Manual smoke: scroll transcript (historical vs bottom), room move with new section below fold.
- [ ] Update **Progress** and **Recommended order** checkboxes in this file; migrate durable notes to [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) if needed; archive/delete this plan per [`taskPlanning/AGENT.md`](../AGENT.md).

---

## Verification

Commands run from **`charcoal-client/`** (Vitest; see [`AGENT.development.md`](AGENT.development.md)):

```bash
cd charcoal-client
npm run test:single
npm run test:single -- src/components/Message/RoomDescription.test.tsx
```

Optional quick grep after removing the chip:

```bash
# Should find no "Live" chip in RoomDescription (adjust if string remains elsewhere intentionally)
rg 'MiniChip|Live' charcoal-client/src/components/Message/RoomDescription.tsx
```

---

## Links

| Doc / file | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../AGENT.md) | Task plan framework |
| [`AGENT.development.md`](AGENT.development.md) | Client test commands |
| [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md) | RTL, Vitest, MUI patterns |
| [`charcoal-client/src/components/Message/AGENT.md`](../../charcoal-client/src/components/Message/AGENT.md) | Message area notes (if present) |
