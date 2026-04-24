# WML operator canonize outlet (dev / bootstrap) - task plan

**Status:** Agreed decisions recorded; implementation not started.

Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for durability rules, what belongs in this file versus package docs, and how to retire this plan when the work ships.

## Purpose

Add a **development- and bootstrap-oriented** way to promote a WML asset to **Canon** by **asset id**, without wiring the path into the normal client. The primary near-term driver is making **Coyote Game** scenery demoable (see [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md)). Long term, **community publishing** flows in [`AGENT.collaboration.md`](../../../AGENT.collaboration.md) and [`AGENT.collaboration.publishing.md`](../../../AGENT.collaboration.publishing.md) should supersede ad hoc promotion; this outlet should stay **operator-invoked** (not a product client path), **auditable**, and **easy to delete or narrow** once publishing exists. **Security gating** (env flags, secrets, IAM nuances) is **out of scope** for this task slice---assume invoke surfaces you already trust (for example Lambda test console).

**Architectural intent:** Invoke the WML lambda with a **controlled message shape** (for example from the Lambda test console), have the handler enqueue work through the existing **`api.wml`** coordination path (same family as `applyEdit` / `moveAsset`), and rely on the data source to emit **`Zone Changed`** (and any other existing outbounds) **after** authoritative storage updates---not on unrelated services publishing domain events to force state.

## Constraints and non-goals

- **Non-goal:** A first-class client API or UX for canonization (that belongs to publishing work).
- **Non-goal:** Replacing provisional or consensus-driven publishing; this is an **operator / bootstrapping** escape hatch aligned with **direct canon access** and **operator rollback** language in the collaboration docs.
- **Non-goal:** **`Decanonize`** / demotion operator path; reset demos by **removing the asset** instead.
- **Constraint:** **Idempotency is state-derived:** the handler reads **current zone** (and related state as needed), decides the **minimal** internal steps still required to reach Canon, and **only then** enqueues coordination events. If the asset is **already in Canon**, it must **not** enqueue work that would publish redundant **`Zone Changed`** (or similar) outbounds. No **`idempotencyKey`** on the message.
- **Constraint:** **`Canonize Asset`** today is implemented as **Library → Canon** only inside [`lambda/wml/dataSource/mtw-wml.ts`](../../../lambda/wml/dataSource/mtw-wml.ts) (`processCanonizeDecanonize`). Assets not already in **Library** require a **composite** promotion path: read **current zone**, then emit the **minimal sequence** of **normal** internal coordination steps (`moveAsset` between durable zones, then **`Canonize Asset`** as appropriate) until Canon or a documented no-op---**no** ad hoc S3 or bootstrapping-only shortcuts that bypass the existing authority pipeline.

## Links (durable docs)

| Doc | Role |
| --- | --- |
| [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md) | WML event mesh role; **`api.wml`** vs outbound **`Zone Changed`** |
| [`lambda/wml/dataSource/AGENT.md`](../../../lambda/wml/dataSource/AGENT.md) | DataSource area orientation |
| [`lambda/wml/dataSource/moveAsset/AGENT.md`](../../../lambda/wml/dataSource/moveAsset/AGENT.md) | Zone moves and valid transitions (read before changing orchestration) |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | Reserved **Canonize / Decanonize** handlers; do not remove |
| [`lambda/ephemera/perception/AGENT.md`](../../../lambda/ephemera/perception/AGENT.md) | **Real-time** canonize subscribers are not required for this bootstrap slice; ephemera is expected to **pick up canon periodically**. A future in-play canonization story would need tighter ephemera reaction. |

## Key code touchpoints (implementation)

- [`lambda/wml/app.ts`](../../../lambda/wml/app.ts) --- WebSocket / direct Lambda request switch; **`WMLAPIMessage`** guard and message union.
- [`lambda/wml/dataSource/subscribedEvents.ts`](../../../lambda/wml/dataSource/subscribedEvents.ts) --- `sendMoveAsset`, coordination envelopes; patterns for **`Canonize Asset`** headers.
- [`lambda/wml/dataSource/mtw-wml.ts`](../../../lambda/wml/dataSource/mtw-wml.ts) --- `processCanonizeDecanonize`, `moveAsset`, `streamEvent` for **`Zone Changed`**.
- Shared request types: [`packages/mtw-interfaces`](../../../packages/mtw-interfaces) (or adjacent) if the new message is part of the public **`WMLAPIMessage`** union.

## Getting Started

1. **Task planning framework**  
   Read [`taskPlanning/AGENT.md`](../../AGENT.md). **Why:** Keeps this document scoped to process and checklists; steady-state behavior stays in `AGENT.md` next to code.

2. **Product and publishing context**  
   Skim [`AGENT.collaboration.md`](../../../AGENT.collaboration.md) (bootstrapping: direct canon, operator tools) and [`AGENT.collaboration.publishing.md`](../../../AGENT.collaboration.publishing.md) (Phase 1 operator rollback). **Why:** Confirms we are not painting ourselves into a corner for later community flows.

3. **Coyote Game intent**  
   Read [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md) **MVP / demo topology**. **Why:** Clarifies rooms and scenery needs for the demo. For **bootstrap** visibility, assume **`mtw.assets`** plus ephemera's **periodic canon reload** are enough; **real-time** ephemera on **`Zone Changed`** is out of scope for this slice.

4. **Current WML event story**  
   Read [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md) and the **Reserved handlers** note in [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md). **Why:** Canonize is already subscribed; only the **call path** is missing.

5. **Zone move rules**  
   Read [`lambda/wml/dataSource/moveAsset/AGENT.md`](../../../lambda/wml/dataSource/moveAsset/AGENT.md) and trace `moveAsset` usage from `processCanonizeDecanonize`. **Why:** Any multi-hop promotion must respect allowed transitions and failure modes.

6. **Lambda handler pattern**  
   Read the `applyEdit` / `moveAsset` branches in [`lambda/wml/app.ts`](../../../lambda/wml/app.ts). **Why:** New message should mirror **RequestId**, **messageBus.flush**, and **extractReturnValue** conventions.

7. **Testing and local commands**  
   For WML-adjacent development commands, see [`lambda/wml/s3Storage/AGENT.development.md`](../../../lambda/wml/s3Storage/AGENT.development.md) if you touch S3-backed flows; otherwise follow the repo root [`AGENT.md`](../../../AGENT.md) testing quick reference for the packages you change. **Why:** Exact runners differ by package; do not assume Jest-only.

## Agreed decisions

- **Gating:** **Out of scope** for this initiative (no additional env flags, shared secrets, or IAM policy work tracked here).
- **Message name:** **`promoteToCanon`** (clear operator intent; wire through types and `isWMLAPIMessage` alongside existing WML API messages).
- **Zone path:** **Composite handler** that inspects **current zone** and drives the **minimal** sequence of **existing** coordination primitives (`moveAsset`, **`Canonize Asset`**, etc.)---not a parallel bootstrapping-only code path.
- **Idempotency:** Same **state inspection** as the composite path: already **Canon** implies **no** internal coordination sends and **no** spurious publishes---not a separate **`idempotencyKey`** field on **`promoteToCanon`**.
- **Operator debugging:** **Not required**---no obligation to echo **final zone**, **steps applied**, or other diagnostic fields in the Lambda response beyond whatever existing handlers already return for success.
- **Decanonize / demotion:** **Not required.** Demo reset is handled by **removing the asset** rather than demoting canon.
- **Downstream (Coyote bootstrap):** **`mtw.assets`** is assumed to already react as needed for visibility. **Ephemera** is assumed to **reload canon on a period** sufficient for bootstrap demo; **no ephemera change** is in scope for this slice. (**Contrast:** real-time in-play canonization later would want ephemera to react to **`Zone Changed`** or equivalent without waiting for a reload tick---track under publishing / perception work, not here.)

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created (this file) | Done |
| Agreed decisions recorded in plan | Done |
| Handler + composite orchestration + types (`promoteToCanon`) | Not started |
| State-based idempotency + tests | Not started |
| Durable doc updates (event flow, message contract) | Not started |
| Demo verified (Coyote or minimal asset read path) | Not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply the same convention to nested bullets when present; mark nested lines `[X]` as you complete them so partial progress stays visible.

- [ ] Implement **`promoteToCanon`** on **`WMLAPIMessage`** and `isWMLAPIMessage` in [`lambda/wml/app.ts`](../../../lambda/wml/app.ts); add branch that runs **composite orchestration** (minimal `moveAsset` / **`Canonize Asset`** sequence via **`messageBus`**) and awaits **`messageBus.flush`** / return value like existing messages
  - [ ] Implement **composite orchestration** in one place (prefer **handler** or a small **module** next to the lambda, unit-tested) that calls **`sendMoveAsset`** and a typed **`sendCanonizeAsset`** (add the latter next to **`sendMoveAsset`** in [`lambda/wml/dataSource/subscribedEvents.ts`](../../../lambda/wml/dataSource/subscribedEvents.ts) if it does not exist yet) so `mtw-wml` remains the single authority for S3 / zone truth
- [ ] Implement **state-based idempotency**: if already **Canon**, skip all coordination sends so nothing new is published; otherwise only enqueue moves/canonize that are still required (no duplicate **`Zone Changed`**), consistent with `moveAsset` behavior where applicable
- [ ] Add **unit tests** (WML package or lambda-local, per existing conventions) for message parsing, composite paths, and no-op paths
- [ ] Update durable docs: [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md) (and interfaces docstrings if applicable) to describe the **operator-only** path and how it differs from future publishing
- [ ] **Verification** (below) passes; update **Progress** table and this checklist
- [ ] Run demo or smallest manual checklist proving **players / clients** see Canon content if that is in scope for the slice

## Verification

Use after implementation lands; refine grep patterns if names differ from placeholders.

- `rg "promoteToCanon|Canonize Asset" lambda/wml packages/mtw-interfaces` --- expect hits only in intended files.
- Run targeted tests for touched packages (exact commands from package `package.json` or [`lambda/wml/s3Storage/AGENT.development.md`](../../../lambda/wml/s3Storage/AGENT.development.md)).
- Optional: invoke Lambda test payload documented in **durable** WML doc; confirm **one** **`Zone Changed`** (or documented no-op) for idempotent replay.

## When this task finishes

Per [`taskPlanning/AGENT.md`](../../AGENT.md): move lasting contract text into [`lambda/wml/AGENT.event.md`](../../../lambda/wml/AGENT.event.md) or [`lambda/wml/dataSource/AGENT.md`](../../../lambda/wml/dataSource/AGENT.md); then **delete or archive** this file so `taskPlanning/` stays current.
