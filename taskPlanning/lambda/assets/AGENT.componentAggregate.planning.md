# Component aggregates (merged view + derived DataSource) - planning

**Status:** Planning (not started). **In scope:** sequence work so **query / assembly logic** lands first (preferably as shared **read-only gateway** code in [`packages/mtw-gateways`](../../../packages/mtw-gateways/AGENT.md)), then add **`mtw.assets.components.aggregate`** as a **non-replayable** derived [`AssetsDataSource`](../../../lambda/assets/dataSource/abstract.ts) under [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/) for **streaming** and **invalidation-oriented** signals. **Next:** agree gateway contract sketch with [`mtw.assets.components.verticals`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) readers; spike pure merge-from-vertical + bodies.

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs in package docs). **Dispose** after the initiative ships and lasting notes live under [`lambda/assets/`](../../../lambda/assets/) (or [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) for the gateway surface).

**Sibling initiative:** Vertical denormalization is shipped in durable docs: [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md). Aggregates **consume** vertical hop metadata plus authoritative per-asset component rows; they do **not** replace the vertical projector.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions (checkboxes, verification, durable vs transient content).
2. Read the vertical writer semantics and shared gateway surface (you will query the same Dynamo rows the vertical owner writes):
   - [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)
3. Read **gateway rules** and existing assets gateways (pattern for shared read surfaces):
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)
   - [`packages/mtw-gateways/ts/assets/components/assetMeta/`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) (example of injected `assetDB` reads)
4. Read **merge / stack** behavior today so golden tests have a comparison baseline:
   - [`lambda/assets/fetchImportDefaults/AGENT.md`](../../../lambda/assets/fetchImportDefaults/AGENT.md)
   - [`lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md`](../../../lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md)
5. Read a **derived** assets DataSource that already merges across a stack for product-specific events (pattern reference only; contracts will differ):
   - [`lambda/assets/componentExamples/index.ts`](../../../lambda/assets/componentExamples/index.ts) and [`exampleEnrichment`](../../../lambda/assets/componentExamples/exampleEnrichment.ts) (`getOrderedAssetStack`, `merge*AcrossStack`)
6. Read the **DataSource pattern** for non-replayable derived sources:
   - [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)
7. **Command authority:** For gateway tests, follow [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (`npm test` from package root). For assets lambda tests, prefer [`lambda/assets/AGENT.development.md`](../../../lambda/assets/AGENT.development.md) if it exists; otherwise root [`AGENT.md`](../../../AGENT.md) and existing lambda test conventions.
8. **Baseline (before implementation edits):** Record exact commands in **Verification** as slices land; until then, `cd packages/mtw-gateways && npm test` and `cd lambda/assets && npm test -- --testPathPattern=dataSource/components/verticals` are reasonable sanity checks when touching shared dependencies.

---

## Goal

Deliver a **bounded-read** path and (later) **mesh-visible signals** for **merged component state** at a **perspective**: universal component identity **U** interpreted through an **asset stack** (ordered inherited layers ending at an anchor asset), matching semantics users already get from recursive import resolution / merge today.

**Phase 1 (gateway-first):**

- **Shared, read-only** helpers in **`mtw-gateways`** that compose:
  - **Vertical envelope:** `Query` import-meta **`Meta::Import::...`** rows for **U** (same partition contract as [`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)).
  - **Authoritative bodies:** `BatchGetItem`-style reads of per-asset component projections already owned elsewhere (same Dynamo rows [`assetMeta`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) and related shapes touch).
  - **Merge assembly:** deterministic ordering + merge rules aligned with **`fetchImportDefaults`** / StandardForm expectations (exact code reuse is a **decision point** below).
- **Tests:** **Vertical assembly** here means **merge-from-vertical + bodies** (not the vertical projector alone). Golden or comparison tests proving **gateway assembly** matches the **current merge baseline** for fixture stacks live in this initiative (may run **outside** [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) until that lambda consumes the gateway). **`Meta::Import`** **`Query`** / normalization are already shipped in **`mtw-gateways`**; Phase 1 **imports** those helpers rather than re-encoding Dynamo keys here.

**Phase 2 (DataSource):**

- Add **`mtw.assets.components.aggregate`**: [`AssetsDataSource`](../../../lambda/assets/dataSource/abstract.ts), **`replayable: false`** lean, living under [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/).
- **Subscribe** to enough of **`mtw.assets`** (and possibly internal **`mtw.assets.components.verticals`** diagnostics later) to know when a **merged view** at a perspective may have changed.
- **Publish** narrowly scoped **aggregate update** signals (internal `streamEvent` first; EventBridge serializers **contingent** on subscribers outside assets lambda).

**Non-goals for early milestones:** persisting full merged blobs in Dynamo as the primary truth (high invalidation fan-out unless proven necessary); replacing ephemera's render cache in one shot; defining global reverse indexes for "all descendants of asset X" (still a vertical-plan follow-on unless scoped together).

---

## Relationship to `mtw.assets.components.verticals`

| Concern | Verticals DataSource | Aggregate gateway / DataSource |
| --- | --- | --- |
| **Writes** | Owns **`Meta::Import::...`** projection maintenance | **No** Dynamo writes for merge payloads in v1 |
| **Reads** | **`Query`** envelope under **`AssetId = U`** | **Uses** that envelope + batched component rows |
| **Consistency** | Eventually consistent projector | Merge is **derived** at read or **signaled** on events |
| **Gateway** | **Owns** **`mtw-gateways`** read surface for **`Meta::Import::...`**; writer [`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) stays authoritative for encoding | **Consumes** that vertical reader inside **`assembleMergedComponent`**; adds aggregate-specific types and merge only |

**Sequencing note:** Keep aggregate assembly on the shipped vertical read helpers in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) so aggregate never forks SK/query logic.

**Vertical reader shipped:** Phase 1 should import **`@tonylb/mtw-gateways/ts/assets/components/verticals`** (`queryImportVerticalMeta`, key builders, normalized hop types) rather than duplicating partition/sort encoding.

**Dependency (aggregate on vertical):** Phase 1 assembly **depends on** the shipped **`Meta::Import`** read helpers in **`mtw-gateways`**.

---

## Proposed direction (working model)

**Perspective key (illustrative):** `(universalComponentId: EphemeraId | string, anchorAssetId: AssetUUID)` plus rules for deriving **stack order** from vertical hops toward the anchor (must match **`getOrderedAssetStack`** semantics where they overlap).

**Assembly:**

1. Load **vertical hops** for **U** (one partition `Query`).
2. Derive **ordered asset ids** for the stack relevant to the anchor (details TBD; must handle malformed / cyclic graphs consistently with vertical projector diagnostics).
3. **`BatchGet`** component rows for **U** at each layer (reuse gateway factories where possible).
4. **Merge** bottom-up or top-down per established StandardForm merge rules (explicit decision).

**Streaming (Phase 2):**

- On **`Component Updated` / Removed** (and optionally vertical-specific heals), determine affected **(U, anchor)** perspectives **or** emit coarse signals requiring downstream filtering.
- Optional **debouncing** or **scope filters** to avoid emitting **N x depth** events per library edit.

---

## Decision points

Most rows below are **open**; this plan exists partly to force early answers without blocking the vertical initiative.

| Topic | Question / notes |
| --- | --- |
| **Merge authority** | Single implementation shared with **`fetchImportDefaults`** vs duplicated merge with golden tests enforcing parity. |
| **Stack vs vertical drift** | If vertical rows lag authoritative **`_from`**, assembly may disagree with a fresh recursive walk; acceptable under eventual consistency, or require **read-through** fallback? |
| **Perspective surface** | Is the public API **anchor-only** (stack derived entirely from vertical + anchor) or does the caller pass a **full stack** (ephemera-style)? |
| **Materialization** | **Lean:** compute on demand in gateway; **optional** cached summaries only with crisp invalidation (likely later). |
| **Gateway package layout** | `mtw-gateways/ts/assets/components/verticals` for **`Meta::Import`** reads + `.../aggregate` for orchestration, vs one folder; follow [`mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) deep-import style. |
| **Invalidation graph** | Which subscribers **must** react when **any** asset in the inherited tree changes? Ephemera render paths, editor sessions, diagnostics only? |
| **Event payload** | Full merged component vs **invalidation tokens** vs **changed layer ids** only. |
| **Overlap with `componentExamples`** | Shared **`mergeAcrossStack`** utilities vs keeping example-specific enrichment separate. |
| **Subscription breadth** | Subscribe only to **`mtw.assets`** component events vs also **`mtw.assets.components.verticals`** heal findings / **`mtw.diagnostics`**. |
| **Cycles / Problem Reports** | Align with vertical projector: emit diagnostics, do not pretend aggregates **repair** graph issues. |

---

## Unknowns / risks

- **Fan-out:** Publishing **aggregate changed** for every upstream edit can overwhelm subscribers; may need **scoped registration** (who cares about which `(U, anchor)`).
- **Hot keys:** High-traffic universal ids might amplify reads if every merge repeats full vertical `Query` + batch gets; caching belongs in **consumer** `InternalCache`, not hidden singletons in `mtw-gateways`.
- **Contract churn:** Early gateway types should stay **narrow** (IDs + ordered layers + merged `StandardComponent`) until callers stabilize.
- **Test baseline:** Until **`fetchImportDefaults`** reads verticals, golden tests are the **contract** between legacy merge and gateway assembly.

---

## Out of scope (for this planning doc unless explicitly pulled in)

- Owning **`Meta::Import::...`** writes (remains **`mtw.assets.components.verticals`**).
- Full **`fetchImportDefaults`** refactor is tracked in [**Recommended order**](#recommended-order) here (aggregate assembly gateway); it should depend on **this** initiative's **`mtw-gateways`** assembly surface, **not** on invoking the **`mtw.assets.components.aggregate` DataSource** for synchronous reads.
- Renaming **`mtw.assets.componentExamples`** or introducing a formal parent **`mtw.assets.components`** umbrella DataSource (same stance as vertical plan; naming stays dotted under **`mtw.assets.components.*`**).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply the same rule to nested bullets when added.

**Interconnection:** **`mtw.assets.components.verticals`** owns **`Meta::Import`** storage and its **`mtw-gateways`** read surface. This initiative **consumes** it inside assembly; **do not** duplicate vertical **`Query`** / SK logic here.

- [ ] **Aggregate types:** Sketch **`AggregatePerspective`** (names TBD), **`OrderedAssetStack`**, and **`MergedComponentResult`** in gateway package (pure types + factories).
- [ ] **Assembly core:** Implement **`assembleMergedComponent`** (name TBD) using **`Meta::Import`** reads from the shipped **`mtw-gateways`** vertical surface plus batch component fetch + merge; inject `assetDB` via factory per gateway norms.
- [ ] **Golden / comparison tests:** Fixtures proving parity with legacy merge path for representative stacks; record commands in **Verification**.
- [ ] **Follow-on (assets lambda):** refactor [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) to call this **aggregate assembly** surface (Phase 1 gateway), replacing hand-rolled recursion / graph walks and retiring reliance on `internalCache.Graph` for ancestry where appropriate. **Do not** route synchronous reads through the **`mtw.assets.components.aggregate` DataSource**---that DataSource is for **mesh streaming** only.
- [ ] **Scaffold DataSource:** Add [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/) with **`dataSourceKey: 'mtw.assets.components.aggregate'`**, **`replayable: false`**, **`subscribedEvents.ts`** stubs, side-effect import from [`lambda/assets/app.ts`](../../../lambda/assets/app.ts).
- [ ] **Streaming design:** Decide **event granularity**, **`streamEvent`** payload shape (bus-only vs EventBridge), and **subscriber list** (ephemera / editor / none in v1).
- [ ] **Implementation:** `receiveEvents` projection that emits aggregate signals; align import-diff / noise avoidance with verticals idempotency guidance in [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md).
- [ ] **Steady-state docs:** Move surviving architecture notes to [`lambda/assets/`](../../../lambda/assets/) `AGENT.md` or [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md); trim this file when done.

---

## Progress

| Milestone | Status |
| --- | --- |
| Problem framing + phased gateway-first approach | Done (this doc) |
| Vertical **`Meta::Import`** read gateway (`mtw-gateways`) | Done (shipped; consumed by aggregate work) |
| Aggregate assembly core + tests | Not started |
| `mtw.assets.components.aggregate` DataSource | Not started |
| Subscriber wiring + serializers | Not started |

---

## Verification

Record **exact** cwd + runner commands as slices land.

- [ ] `packages/mtw-gateways`: `npm test` (and `npx tsc --build packages/mtw-gateways/tsconfig.ref.json` when types change).
- [ ] `lambda/assets`: targeted pattern for aggregate DataSource once present, e.g. `npm test -- --testPathPattern=dataSource/components/aggregate`.
- [ ] **Follow-on:** when **`fetchImportDefaults`** is refactored ([**Recommended order**](#recommended-order)), `grep -r "fetchImportDefaults\\|recursiveFetchImports" lambda/assets/fetchImportDefaults` reflects **aggregate gateway** assembly over vertical reads (or document deliberate interim behavior).
- [ ] Consumer regression (if ephemera or others adopt gateway): follow notes in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) | Vertical writer + Dynamo schema / maintenance |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | Gateway package norms |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) | DataSource pattern |
| [`lambda/assets/fetchImportDefaults/AGENT.md`](../../../lambda/assets/fetchImportDefaults/AGENT.md) | Current merge / defaults behavior |

---

## Notes

- Prefer **ASCII punctuation** in edits to this file (project convention).
- When gateway names stabilize, add **grep-friendly** re-export barrels next to the vertical writer (`readModel.ts` pattern per [`mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)).
