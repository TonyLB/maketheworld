# Component aggregates (merged view + derived DataSource) - planning

**Status:** Phase 1 in progress (aggregate **compute-only** gateway types landed under **`mtw-gateways`**). **In scope:** sequence work so **query / assembly logic** lands first as shared **read-only gateway** code under [`packages/mtw-gateways/ts/assets/components/aggregate/`](../../../packages/mtw-gateways/ts/assets/components/aggregate/) (see [**Gateway package layout**](#phase-1-gateway)), then add **`mtw.assets.components.aggregate`** as a **non-replayable** derived [`AssetsDataSource`](../../../lambda/assets/dataSource/abstract.ts) under [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/) for **streaming** and **invalidation-oriented** signals. **Next:** **`assembleMergedComponent`** + goldens (Phase 1 [**Recommended order**](#recommended-order)); vertical contract is already shipped---touch base with verticals readers only when the **anchor-only participant closure** or batch shape needs alignment.

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs in package docs). **Dispose** after the initiative ships and lasting notes live under [`lambda/assets/`](../../../lambda/assets/) (or [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) for the gateway surface).

**Sibling initiative:** Vertical denormalization is shipped in durable docs: [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md). Aggregates **consume** vertical hop metadata plus authoritative per-asset component rows; they do **not** replace the vertical projector.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions (checkboxes, verification, durable vs transient content).
2. Read the vertical writer semantics and shared gateway surface (you will query the same Dynamo rows the vertical owner writes):
   - [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)
3. Read **gateway rules** and mirror existing assets gateway **layout** (shared read surfaces---do not invent a parallel package architecture):
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md): read at least [**How to add a gateway**](../../../packages/mtw-gateways/AGENT.md#how-to-add-a-gateway) and [**Consistency analyzers: contract vs composition**](../../../packages/mtw-gateways/AGENT.md#consistency-analyzers-contract-vs-composition) before sketching types or adding files under **`aggregate/`**. (Optional but useful: [**Wrapping gateways in InternalCache (playbook)**](../../../packages/mtw-gateways/AGENT.md#wrapping-gateways-in-internalcache-playbook) so lambda wiring stays out of the package.)
   - Code to mirror: [`packages/mtw-gateways/ts/assets/components/assetMeta/`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) (injected `assetDB`, row normalization) and [`packages/mtw-gateways/ts/assets/components/verticals/`](../../../packages/mtw-gateways/ts/assets/components/verticals/) (sibling module under `ts/assets/components/`; **`Meta::Import`** reads this initiative composes).
   - Planned aggregate home: [`packages/mtw-gateways/ts/assets/components/aggregate/`](../../../packages/mtw-gateways/ts/assets/components/aggregate/) ([**Gateway package layout**](#phase-1-gateway))
4. Read **merge / stack** behavior today so golden tests have a comparison baseline:
   - [`lambda/assets/fetchImportDefaults/AGENT.md`](../../../lambda/assets/fetchImportDefaults/AGENT.md)
   - [`lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md`](../../../lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md)
5. Read a **derived** assets DataSource that already merges across a stack for product-specific events (pattern reference only; contracts will differ):
   - [`lambda/assets/componentExamples/index.ts`](../../../lambda/assets/componentExamples/index.ts) and [`exampleEnrichment`](../../../lambda/assets/componentExamples/exampleEnrichment.ts) (`getOrderedAssetStack`, `merge*AcrossStack`)
6. Read the **DataSource pattern** for non-replayable derived sources (primarily **Phase 2** when scaffolding `mtw.assets.components.aggregate`):
   - [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)
7. **Command authority:** For gateway tests, follow [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (`npm test` from package root). For assets lambda tests, prefer [`lambda/assets/AGENT.development.md`](../../../lambda/assets/AGENT.development.md) if it exists; otherwise root [`AGENT.md`](../../../AGENT.md) and existing lambda test conventions.
8. **Baseline (before implementation edits):** Record exact commands in **Verification** as slices land; until then, `cd packages/mtw-gateways && npm test` and `cd lambda/assets && npm test -- --testPathPattern=dataSource/components/verticals` are reasonable sanity checks when touching shared dependencies.

---

## Goal

Deliver a **bounded-read** path and (later) **mesh-visible signals** for **merged component state** at a **perspective**: universal component identity **U** interpreted through a **merge participation order** (explicit ordered asset ids; optionally derived from anchor + vertical hops---see [**Perspective surface**](#phase-1-gateway)), matching semantics users already get from recursive import resolution / merge today.

**Phase 1 (gateway-first):**

- **Shared, read-only** helpers in **`mtw-gateways`** under [`ts/assets/components/aggregate/`](../../../packages/mtw-gateways/ts/assets/components/aggregate/) that compose:
  - **Vertical envelope:** `Query` import-meta **`Meta::Import::...`** rows for **U** (same partition contract as [`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)).
  - **Authoritative bodies:** `BatchGetItem`-style reads of per-asset component projections already owned elsewhere (same Dynamo rows [`assetMeta`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) and related shapes touch).
  - **Merge assembly:** deterministic ordering + merge rules aligned with **`fetchImportDefaults`** / StandardForm expectations (see [**Merge authority**](#phase-1-gateway)).
- **Tests:** **Vertical assembly** here means **merge-from-vertical + bodies** (not the vertical projector alone). Golden or comparison tests proving **gateway assembly** matches the **current merge baseline** for fixture stacks live in this initiative (may run **outside** [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) until that lambda consumes the gateway). **`Meta::Import`** **`Query`** / normalization are already shipped in **`mtw-gateways`**; Phase 1 **imports** those helpers rather than re-encoding Dynamo keys here.

**Phase 2 (DataSource):**

- Add **`mtw.assets.components.aggregate`**: [`AssetsDataSource`](../../../lambda/assets/dataSource/abstract.ts), **`replayable: false`** lean, living under [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/).
- **Subscribe** to enough of **`mtw.assets`** (and possibly internal **`mtw.assets.components.verticals`** diagnostics later) to know when a **merged view** at a perspective may have changed.
- **Publish** narrowly scoped **aggregate update** signals (internal `streamEvent` first; EventBridge serializers **contingent** on subscribers outside assets lambda).

**Non-goals for early milestones:** persisting full merged blobs in Dynamo as the primary truth (high invalidation fan-out unless proven necessary); replacing ephemera's render cache in one shot; defining global reverse indexes for "all descendants of asset X" (still a vertical-plan follow-on unless scoped together).

**Requirements clarity:** **Phase 1** (gateway assembly + tests) has enough fixed surface to implement: vertical reads, batched authoritative bodies, merge semantics, and a stable caller-facing perspective type. **Phase 2** (aggregate `AssetsDataSource`, `streamEvent` / EventBridge shape, subscriber contracts) stays **under-specified on purpose** until Phase 1 types and golden tests exist; treat Phase 2 rows in [**Decision points**](#decision-points) and in the **Unknowns / risks** section (Phase 2 subsection) as **deferred** unless a Phase 1 choice would paint us into a corner (called out inline).

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

**Perspective key:** Merge input is always **(U, merge participation order)** as an **explicit ordered asset id list**; callers that only have **(U, anchor)** use a **derived** list from vertical hops + anchor where that is sufficient ([**Perspective surface**](#phase-1-gateway) decided). See [**Ordered participation vs. import tree**](#ordered-participation-vs-import-tree-naming) before treating "stack" as a single ancestry chain.

### Ordered participation vs. import tree (naming)

**Worth a call-out:** For merge, we only need a **total order** of assets at which **U** appears: fold `StandardComponent.merge` in that order. That list is enough for implementation and matches WML layering. It is **easy to misread** `assetStack` (and words like "stack" or "walk up the tree") as meaning "**one** root-to-leaf chain in the import graph," i.e. authoritative ancestry from a single leaf. That is **not** always what a **perspective** is.

**`fetchImportDefaults` as a special case (and a confusion source):** In that path we **often are** following a **single thread** from a starting node **up** its import ancestry to build one ordered chain for a focused fetch. That is a **legitimate special case** of merge participation order: the total order happens to be a **simple path** in the import graph. Other callers (ephemera perspective, character-visible asset sets, editor aggregates) may need an order that is **not** that thread alone. Treating the FetchImports mental model as the **definition** of "stack" for all merge contexts has likely **contributed to long-term confusion**; the gateway primitive should be documented as **ordered participation**, with FetchImports documented as **one way** that order is produced when the product question is "extend from this anchor along this ancestry."

**Example:** `ROOM#X` is defined in **Asset A**, imported into **B** from **A** (with edits), and imported into **C** from **A** (with edits). B and C are **siblings** in the import graph relative to A, not ancestors of each other. A character (or editor) whose **perspective** includes **A, B, and C** still needs a single merged view of `ROOM#X` for that session---often something like **A then B then C** (exact order comes from perspective / canon rules, not from "start at B and walk up" or "start at C and walk up" alone). Some consecutive pairs in that order are **parent-child** in the import graph; others are **not**, yet the **same** `.merge` mechanics apply. Conceptually, "tree vs. stack" differs; in **WML / StandardForm** handling, the ordered fold is the shared truth.

**Documentation and naming (Phase 1 guidance):**

- Prefer vocabulary that stresses **perspective** and **participation order**: e.g. **`mergeParticipationOrder`**, **`orderedMergeLayers`**, or **`perspectiveAssetOrder`**, alongside a short docstring that the list is "**total merge order for this perspective, not necessarily a single import-graph path**."
- Keep **`assetStack`** as a **field name** only where legacy / ephemera alignment matters; in **new gateway types**, avoid **stack** as the *only* word in the public name unless docs beside it spell out the sibling case.
- In AGENT text, pair "**ordered asset ids**" with "**for this perspective**" so readers do not equate the list with "the unique ancestry chain from anchor to root."

**Verticals:** `Meta::Import` rows describe **hops** (edges); composing them with an **anchor** (or with an explicit order supplied by ephemera) yields the **ordered participation list**. The list may be derivable from graph + perspective rules without being isomorphic to "one DFS trace of the whole import tree." **Turning hops + perspective into that list** is not automatic; see [**Phase 1**](#phase-1-gateway) decision **Participation order from graph**.

**Assembly:**

1. Load **vertical hops** for **U** (one partition `Query`).
2. When deriving order (vs caller-supplied list): apply [**Participation order from graph**](#phase-1-gateway)---pure **(set + tree)**, DFS preorder, **AssetUUID** sibling and root order, no event metadata in the sort; handle malformed / cyclic graphs consistently with vertical projector diagnostics. **Anchor-only closure:** the **finite asset set** for that derivation must be defined from **`Meta::Import`** hops for **U** plus **anchor** (which assets are in-bounds for this merge); pin the exact rule in **`aggregate/`** module docs or a tiny AGENT on first ship and lock with the same golden tests---not an open architecture fork, a **first-cut spec** to write down when coding.
3. **`BatchGet`** component rows for **U** at each layer (reuse gateway factories where possible).
4. **Merge** along participation order per established StandardForm merge rules; **fold direction** (which end of the list merges first) is part of [**Merge authority**](#phase-1-gateway) and must match the legacy baseline **via golden tests**.

**Streaming (Phase 2):**

- On **`Component Updated` / Removed** (and optionally vertical-specific heals), determine affected **(U, anchor)** perspectives **or** emit coarse signals requiring downstream filtering.
- Optional **debouncing** or **scope filters** to avoid emitting **N x depth** events per library edit.

---

## Decision points

**Phase 1** rows **shape the gateway** (types, factories, tests); resolve or explicitly default them before calling Phase 1 "done." Every row in the Phase 1 table below is **Decided** (or explicitly scoped as follow-on polish). **Phase 2** rows **shape the derived DataSource and mesh**; they can stay open until Phase 1 is in place unless noted as a **Phase 1 dependency** (none of the Phase 2 table rows are hard prerequisites for a first gateway slice today).

### Phase 1 (gateway)

| Topic | Question / notes |
| --- | --- |
| **Merge authority** | **Decided (Phase 1):** Ship **`aggregate/`** merge-across-participation-order **in isolation first** (single authoritative implementation using `StandardComponent.merge` / StandardForm rules). **Then** migrate [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) to **call** that surface instead of keeping a parallel historically-constrained recursive path---no long-term duplicate merge logic. **While the migration is incomplete,** golden / comparison tests remain the **contract** against the legacy baseline (see [**Recommended order**](#recommended-order)). **Fold direction** along the ordered asset list (see [**Assembly**](#proposed-direction-working-model) step 4) is an **implementation detail** pinned by those tests and by alignment with existing **`merge*AcrossStack`** behavior, not a competing architectural fork. |
| **Stack vs vertical drift** | **Decided (Phase 1):** The gateway **depends on the vertical index** for graph-derived participation order and related reads; **eventual consistency** between **`Meta::Import`** rows and authoritative **`_from`** / bodies is **desirable**, not merely tolerable---avoiding a default **read-through** full graph walk is what **pays for** indexing (bounded reads, shared projection). Document semantics and tests around **index-first** assembly; any **read-through** fallback (if ever added) stays **exceptional** and explicitly scoped, not the normal path. |
| **Perspective surface** | **Decided (Phase 1):** Support **both**, composed cleanly: the **narrow merge primitive** takes **`(U, orderedAssetIds)`** (caller-owned participation order; required for ephemera / multi-branch perspectives). Provide **additional** entry points or helpers that **derive** `orderedAssetIds` from **`(U, anchor)`** + vertical hops for **FetchImports**-style single-chain cases. Exact export names remain a small API polish item; semantics and naming tone are per [**Ordered participation vs. import tree**](#ordered-participation-vs-import-tree-naming). Graph-side derivation rules: [**Participation order from graph**](#phase-1-gateway) (next row). |
| **Participation order from graph** | **Decided (Phase 1)** for **graph-derived** `orderedAssetIds`: a **pure** function of the **finite asset set** and **import edges** among that set (from **`Meta::Import`** / vertical, or `_from` restricted to the set). **No** pipeline context in the sort: **not** [`getOrderedAssetStack`](../../../lambda/assets/componentExamples/exampleEnrichment.ts)-style **`eventAssetId` / `streamKey`** tie-breaks (or any other invocation-dependent key). **Algorithm:** **depth-first preorder** on the forest; visit children in **ascending AssetUUID** order; visit **roots** (no in-set parent) in **ascending AssetUUID** order; **cycles** handled deterministically like vertical / existing diagnostics (no infinite descent). **Conscious break** from **`getOrderedAssetStack`**, which uses **ascending depth sort** and **event-scoped** equal-depth tie-breaks---on branched graphs the two can **differ**. When migrating callers onto the aggregate gateway, **evaluate** whether that gap is **product-meaningful** or only requires **rewriting test expectations** (and similar fixtures). **Ephemera** canon order from [`resolveCanonAssetStackForRoom`](../../../lambda/ephemera/dataSource/state/resolveAssetStackForRoom.ts) stays **caller-supplied**. Any anchor- or event-specific bias belongs in an **explicit** `orderedAssetIds` from the caller ([**Perspective surface**](#phase-1-gateway)), not inside graph derivation. |
| **Gateway package layout** | **Decided (Phase 1):** New aggregate read surface and its **realm of authority** (assembly, graph-derived participation order, merge orchestration, aggregate-specific types and factories) live under [`packages/mtw-gateways/ts/assets/components/aggregate/`](../../../packages/mtw-gateways/ts/assets/components/aggregate/). **`Meta::Import`** reads remain in [`ts/assets/components/verticals`](../../../packages/mtw-gateways/ts/assets/components/verticals); aggregate code **imports** that module (deep import per [`mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)) and does **not** fork vertical SK/query logic. |
| **Assembly materialization (v1)** | **Decided (Phase 1):** Merged output is **always on demand** in the aggregate gateway---computed per call from vertical reads + batched bodies + merge; **no** aggregate-owned Dynamo materialization of full merged blobs. **Working hypothesis:** this stays **permanently** true for the **`mtw-gateways`** aggregate surface (the gateway remains a read/compose layer only). **Phase 2** / **consumers** may still introduce their own **caches** or **bus payloads**; that does not move merged primary truth into Dynamo under this initiative. |
| **Overlap with `componentExamples`** | **Decided (Phase 1):** The **`aggregate/`** gateway **does not** depend on refactoring **`mtw.assets.componentExamples`** or on restoring a first-class Situation-Facet identity; ship aggregate assembly and tests **standalone**. Optional later **extract** of shared merge helpers remains open; **`getOrderedAssetStack`** vs gateway order is covered under [**Participation order from graph**](#phase-1-gateway). Product history and a **planned** Examples refactor (out of scope here) shape foundations only---see [**componentExamples overlap (context)**](#componentexamples-overlap-context). |
| **Cycles / problem reports** | **Decided (Phase 1):** Stay **consistent** with the **bounded** cycle handling already used for import verticals (same salvage / diagnostics posture as [`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) and shared **`mtw-gateways`** helpers): classify and surface problems; **do not** silently "repair" the graph inside merge or invent hops that the vertical index would not admit. |

### componentExamples overlap (context)

**Historical:** Room-related state used to be modeled as separate **`Example`** components. They were first-class, but **hard to relate** back to the **Room** (and situation) they modified.

**Present:** The **Situation-Facet** structure improves that story, but the **short-term cost** is that a Situation-Facet is **no longer** a single first-class identity you can treat **in isolation** (with its own import-vertical envelope and aggregates the way a universal component row does).

**Planned (not Phase 1):** A **future** refactor of **`componentExamples`** will likely reintroduce a **computed** first-class *view*---language for **"the Example" as one Situation-Facet on a Room** (or on another host component)---without insisting that Situation-Facet be first-class **in every** storage and pipeline context. That step is **wildly out of scope** for the current aggregate initiative.

**Implication for foundations:** Knowing that refactor is **planned** can nudge **narrow types**, **clear `(U, orderedAssetIds)` boundaries**, and **avoid entangling** aggregate gateway internals with **`componentExamples`** event shapes or Room/Situation fan-out. **Do not** block Phase 1 on **boiling the ocean** (solving first-class Situation-Facet verticals + aggregates end-to-end inside this slice).

### InternalCache composition (Phase 1)

**Problem:** Aggregate assembly needs **vertical hop envelopes** and **authoritative per-asset bodies**---the same facts **`internalCache.ComponentVerticals`** and **`internalCache.ComponentData`** already memoize on lambdas that have them.

**Rule:** In **`mtw-gateways`**, the aggregate surface stays a **pure factory + assembly** with **narrow injected deps** (same **contract vs composition** split as **`ImportVerticalConsistencyAnalyzer`** in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)): e.g. **`loadImportVerticalMeta(universalKeys)`** and **`loadAuthoritativeComponentData(universalKeys)`** (or reuse the existing **`ImportVerticalAuthoritativeComponentDataLoader`** / **`ImportVerticalMetaImportProjectionLoader`** shapes where they match). **No** `InternalCache` or `DeferredCache` types in the package.

**Lambda composition:** Each lambda that already has sibling handlers wires **`createAggregateGateway(deps)`** (or equivalent) with **closures** that delegate to **`internalCache.ComponentVerticals.get`**, **`internalCache.ComponentData.get`**, etc. Unit tests in **`mtw-gateways`** mock **`deps`** with in-memory data.

**Optional second `InternalCache` handler** (e.g. **`ComponentAggregate`** on assets): a **`DeferredCache`**-backed class whose **`promiseFactory`** calls those **same** sibling **`get`** methods, then runs the **pure** assembly function on the results---so merged reads participate in **`clear()`** / **`invalidate()`** like other handlers. Choose a **cache key** that matches how callers ask for merges (e.g. **`U` + serialized `orderedAssetIds`**); **invalidate** when either vertical or component data for keys that feed that merge change (start coarse, e.g. invalidate on **`U`** partition changes, then tighten if needed). Follow the **Wrapping gateways in InternalCache (playbook)** checklist in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md#wrapping-gateways-in-internalcache-playbook) and document the handler in that lambda's [`internalCache/AGENT.md`](../../../lambda/assets/internalCache/AGENT.md).

**Ephemera** (or other lambdas) repeat the same pattern with their own **`ComponentAssetMeta`** / caches---**do not** import another lambda's **`InternalCache`** singleton into **`mtw-gateways`**.

### Phase 2 (DataSource, streaming, subscribers)

| Topic | Question / notes |
| --- | --- |
| **Invalidation graph** | Which subscribers **must** react when **any** asset in the inherited tree changes? Ephemera render paths, editor sessions, diagnostics only? |
| **Event payload** | Full merged component vs **invalidation tokens** vs **changed layer ids** only (or coarse root / anchor hints). |
| **Subscription breadth** | Subscribe only to **`mtw.assets`** component events vs also **`mtw.assets.components.verticals`** heal findings / **`mtw.diagnostics`**. |
| **Streaming granularity** | Affected **(U, anchor)** enumeration vs coarse signals + downstream filtering; **debouncing** / scope filters to avoid **N x depth** noise (see [**Proposed direction**](#proposed-direction-working-model) **Streaming**). |
| **Optional materialization** | If any **cached summaries** or **bus payloads** carry more than invalidation hints, where they live and how they invalidate (likely **not** in `mtw-gateways`). |

---

## Unknowns / risks

### Phase 1

- **`getOrderedAssetStack` vs gateway:** Graph-derived participation order is [**decided**](#phase-1-gateway) (pure set + tree, DFS preorder, AssetUUID ordering). That is a **conscious break** from **`getOrderedAssetStack`**; when each consumer moves to the aggregate gateway, assess whether ordering differences change real behavior or only **tests / fixtures**.
- **Contract churn:** Early gateway types should stay **narrow** (IDs + ordered layers + merged `StandardComponent`) until callers stabilize.
- **Test baseline:** Until **`fetchImportDefaults`** reads verticals, golden tests are the **contract** between legacy merge and gateway assembly.
- **Hot keys (design rule):** Repeated merges may repeat vertical **`Query`** + batch reads; **`mtw-gateways`** stays **stateless**---no hidden singleton caches. Per-lambda **`InternalCache`** / caller memoization owns dedupe (see [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)). Operational tuning if one **U** becomes extremely hot is mostly a **consumer** topic but informs Phase 1 API shape (batch-friendly, no accidental N+1 in helpers).

### Phase 2

- **Fan-out:** Publishing **aggregate changed** (or dense invalidation streams) for every upstream edit can overwhelm subscribers; may need **scoped registration** (who cares about which `(U, anchor)`), coarse signals, or subscriber-side bucketing.

---

## Out of scope (for this planning doc unless explicitly pulled in)

- Owning **`Meta::Import::...`** writes (remains **`mtw.assets.components.verticals`**).
- Full **`fetchImportDefaults`** refactor is tracked in [**Recommended order**](#recommended-order) here (aggregate assembly gateway); it should depend on **this** initiative's **`mtw-gateways`** assembly surface, **not** on invoking the **`mtw.assets.components.aggregate` DataSource** for synchronous reads.
- Renaming **`mtw.assets.componentExamples`** or introducing a formal parent **`mtw.assets.components`** umbrella DataSource (same stance as vertical plan; naming stays dotted under **`mtw.assets.components.*`**).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply the same rule to nested bullets when added.

**Interconnection:** **`mtw.assets.components.verticals`** owns **`Meta::Import`** storage and its **`mtw-gateways`** read surface. This initiative **consumes** it inside assembly; **do not** duplicate vertical **`Query`** / SK logic here.

**Phase 1**

- [X] **Aggregate types:** Sketch **`AggregatePerspective`** (names TBD), **`OrderedAssetStack`**, and **`MergedComponentResult`** under [`packages/mtw-gateways/ts/assets/components/aggregate/`](../../../packages/mtw-gateways/ts/assets/components/aggregate/) (pure types + factories). Follow **Getting Started** step 3: per-gateway **`index.ts`** public surface, **deep imports**, narrow **`create*Gateway(deps)`** per [**How to add a gateway**](../../../packages/mtw-gateways/AGENT.md#how-to-add-a-gateway) in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md); **no** `InternalCache` / lambda singleton types in **`mtw-gateways`**.
- [ ] **Assembly core:** Implement **`assembleMergedComponent`** (name TBD) in the same **`aggregate/`** tree using **`Meta::Import`** reads from [`ts/assets/components/verticals`](../../../packages/mtw-gateways/ts/assets/components/verticals) plus batch component fetch + merge; inject `assetDB` via factory per gateway norms.
- [ ] **Golden / comparison tests:** Fixtures proving parity with legacy merge path for representative stacks; record commands in **Verification**.
- [ ] **Optional `InternalCache` handler (assets):** Wire **`ComponentAggregate`** (or chosen name) per [**InternalCache composition (Phase 1)**](#internalcache-composition-phase-1); register in [`lambda/assets/internalCache/index.ts`](../../../lambda/assets/internalCache/index.ts) and document in [`lambda/assets/internalCache/AGENT.md`](../../../lambda/assets/internalCache/AGENT.md).
- [ ] **Follow-on (assets lambda):** refactor [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) to call this **aggregate assembly** surface (Phase 1 gateway), replacing hand-rolled recursion / graph walks and retiring reliance on `internalCache.Graph` for ancestry where appropriate. **Do not** route synchronous reads through the **`mtw.assets.components.aggregate` DataSource**---that DataSource is for **mesh streaming** only.

**Phase 2**

- [ ] **Scaffold DataSource:** Add [`lambda/assets/dataSource/components/aggregate/`](../../../lambda/assets/dataSource/components/aggregate/) with **`dataSourceKey: 'mtw.assets.components.aggregate'`**, **`replayable: false`**, **`subscribedEvents.ts`** stubs, side-effect import from [`lambda/assets/app.ts`](../../../lambda/assets/app.ts).
- [ ] **Streaming design:** Decide **event granularity**, **`streamEvent`** payload shape (bus-only vs EventBridge), and **subscriber list** (ephemera / editor / none in v1). (Depends on [**Phase 2**](#phase-2-datasource-streaming-subscribers) decision table.)
- [ ] **Implementation:** `receiveEvents` projection that emits aggregate signals; align import-diff / noise avoidance with verticals idempotency guidance in [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md).

**Either phase (docs)**

- [ ] **Steady-state docs:** Move surviving architecture notes to [`lambda/assets/`](../../../lambda/assets/) `AGENT.md` or [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md); trim this file when done.

---

## Progress

| Milestone | Phase | Status |
| --- | --- | --- |
| Problem framing + phased gateway-first approach | n/a | Done (this doc) |
| Vertical **`Meta::Import`** read gateway (`mtw-gateways`) | prerequisite | Done (shipped; consumed by aggregate work) |
| Aggregate gateway types + `createAggregateGateway` skeleton (`ports` / `input` / `result` / `factory`) | 1 | Done |
| Aggregate assembly core + tests | 1 | Not started |
| `mtw.assets.components.aggregate` DataSource | 2 | Not started |
| Subscriber wiring + serializers | 2 | Not started |

---

## Verification

Record **exact** cwd + runner commands as slices land.

**Phase 1**

- [X] `packages/mtw-gateways` (repo root for `tsc`): `cd packages/mtw-gateways && npm test`; `npx tsc --build packages/mtw-gateways/tsconfig.ref.json` (run after aggregate types / gateway edits).
- [ ] **Follow-on:** when **`fetchImportDefaults`** is refactored ([**Recommended order**](#recommended-order)), `grep -r "fetchImportDefaults\\|recursiveFetchImports" lambda/assets/fetchImportDefaults` reflects **aggregate gateway** assembly over vertical reads (or document deliberate interim behavior).
- [ ] Consumer regression (if ephemera or others adopt gateway): follow notes in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

**Phase 2**

- [ ] `lambda/assets`: targeted pattern for aggregate DataSource once present, e.g. `npm test -- --testPathPattern=dataSource/components/aggregate`.

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
