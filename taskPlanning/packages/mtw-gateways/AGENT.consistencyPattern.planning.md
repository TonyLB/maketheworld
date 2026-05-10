# Consistency analyzer pattern (gateway-injected reads) - planning

**Status:** Not started. **In scope:** Introduce a **prototype** orchestration abstraction for **component import vertical** consistency (authoritative cached components vs projected **`Meta::Import::...`**), built in **`@tonylb/mtw-gateways`** with **injected async data access** so each lambda supplies **`assetDB`**, **`InternalCache`**-backed reads, or tests---without reversing package dependency arrows. **Out of scope (v1):** Promoting the abstraction into **`mtw-lambda-patterns`** before the vertical prototype is validated. **Documentation:** Add the **generalized** pattern to [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) **early**---same delivery window as the analyzer---per [**Decisions (locked)**](#decisions-locked) (**Package documentation timing**); do **not** wait for a second domain (see [**Promotion after prototype**](#promotion-after-prototype)).

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)). **Dispose** after the initiative closes and lasting notes live under **`packages/mtw-gateways/AGENT.md`** (and optionally a short cross-reference from [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions (checkboxes, verification, durable vs ephemeral docs).
2. Read gateway boundaries and shared vertical helpers:
   - [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Purpose**, **Non-goals**, [**Shared helpers for diagnostics and healing**](../../../packages/mtw-gateways/AGENT.md#shared-helpers-for-diagnostics-and-healing))
3. Read the sibling initiative that owns vertical storage and the current call sites that duplicate orchestration:
   - [`taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../lambda/assets/AGENT.componentVertical.planning.md) (especially **Backfill, healing, and diagnostics** and locked decisions on shared expected-hop logic)
   - [`lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts`](../../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts) (heal / sync path)
   - [`lambda/diagnostics/componentVerticalMisalignmentSweep/`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/) (sweep + local `classification.ts`)
4. **Command authority:** Follow [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) **Test runner**; for consumer lambdas, use the same **Verification** commands recorded in the vertical task plan when touching those trees.
5. **Baseline (before implementation edits):** From repo root or package root, confirm existing vertical gateway tests pass, e.g. `cd packages/mtw-gateways && npm test -- --testPathPattern=ts/assets/components/verticals` (exact command also in **Verification** below).

---

## Goal

Today, **the same multi-step pipeline** (load universal-key partition rows, derive/salvage expected hops, build expected **`Meta::Import::...`** `DataCategory` set, diff against existing index rows, classify **aligned** / **missing** / **orphan** / **stale**) is **orchestrated inline** in more than one lambda. Pure helpers in [`ts/assets/components/verticals`](../../../packages/mtw-gateways/ts/assets/components/verticals) already centralize **semantics**; call sites still **chain** them and reimplement set diff and Meta row filtering.

**Target:** A **constructable** analyzer implemented as a **concrete class** with **constructor-injected** dependencies (see [**Decisions (locked)**](#decisions-locked)) in **`mtw-gateways`** that:

- Accepts **split** **constructor** injection: **narrow structural interfaces** per read concern (see [**Decisions (locked)**](#decisions-locked)), so a lambda **`InternalCache`** can satisfy deps by passing **implementations that align with cache handlers** (the cache is often a **superset** of what the analyzer requires), or callers pass **thin wrappers** around **`assetDB`** / partial cache surfaces / test doubles---without **`mtw-gateways`** importing **`InternalCache`** types. Call sites do **not** see internal steps such as partition loads as **public** methods on the analyzer.
- Exposes a **primary `async check(...)`** entry that **runs** the pipeline and **fills** optional internal **findings** state; **subsequent** accessors (or small output methods) read that state so the pattern stays **reusable** and call sites treat the core as a **black box** (see [**Decisions (locked)**](#decisions-locked)).
- Exposes a **stable findings / plan** surface after **`check`** (at minimum: classification, expected vs existing category sets, and **repair intent**: categories to add, rows or categories to remove) so each lambda only **elaborates** (Dynamo writes, cache invalidation, EventBridge, logging).
- Keeps **pure** building blocks (`deriveRawImportVerticalHopsFromComponents`, `salvageImportVerticalHops`, `metaImportDataCategory`, set classification) **testable in isolation**; the new type is **orchestration + contract**, not a replacement for those functions.

**Non-goal:** The analyzer does **not** perform writes, cache `clear()` / `flush()`, or EventBridge publish. Those stay in lambdas and DataSources per existing gateway rules.

---

## Background (why a prototype, then a pattern)

- **Per-lambda caching** (`DeferredCache` + gateway-shaped readers) is valuable for sweeps and heals that touch many universal keys; the analyzer should benefit from **injected** loaders that memoize, not from **`mtw-gateways`** reaching into a specific lambda's cache type.
- **Risk:** Accidentally importing **`InternalCache`** (or a lambda path) into **`mtw-gateways`** **reverses the dependency arrow** and couples releases. The prototype must demonstrate **structural interfaces only**---**split** so each matches a coherent fetch responsibility (e.g. authoritative partition lines vs projected **`Meta::Import`** reads); **`InternalCache`** can implement them **directly** where methods already exist, or callers wrap.
- **Promotion:** **Generalized** documentation ("any lambda builds injections, then treats core processing as a black box") ships in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) **together with** the vertical prototype ([**Package documentation timing**](#decisions-locked)); optional later note under [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md). This task plan still **disposes** once lasting notes live in package **`AGENT.md`**.
- **Reuse across domains:** Expect **little shared implementation** between future consistency analyzers (different sources, index shapes, repair rules). The lasting artifact is a **pattern for how to build each orchestrator** (deps, pure helpers, black-box core), not a **common superclass** or deep inheritance hierarchy. Document that pattern; avoid premature **`abstract`** bases.

---

## Proposed shape (illustrative)

Exact names are **TBD** during implementation; the plan locks **separation of concerns**, not final identifiers.

| Layer | Responsibility |
| --- | --- |
| **Constructor deps** | **Multiple** narrow structural interfaces (often grouped on **one** deps object passed to the constructor), each aligned with a **single** kind of read. A lambda **`InternalCache`** frequently **already** exposes matching capabilities---pass those handlers (or object slices) **directly**; otherwise use **thin wrappers** with the same method shapes around **`assetDB`** or tests. Call sites wire **behavior**, not **public** loader methods on the analyzer. |
| **Analyzer** | Concrete **class**: **`async check(...)`** loads via **private** / internal helpers (conceptually **private**; use TypeScript **`private`**, **`#`**, or module-local helpers so callers are not tempted to orchestrate loads themselves), runs the pure pipeline, and **stores** findings on the instance (or an immutable snapshot field). Separate **getters** or **`getFindings()`**-style methods expose outputs **after** a successful **`check`**. |
| **Call site** | **`await analyzer.check(...)`**, then read outputs; apply repairs (`syncImportVerticalPartition`-style), invalidate **`ComponentVerticals`**, emit diagnostics findings, etc. |

**Classification helpers:** Shared taxonomy (**`classifyImportVerticalSets`**, **`aggregateMisalignmentStatuses`**) should live with shared semantics (**`mtw-gateways`** when centralized). A lambda may still **configure** how the constructed analyzer uses classification or aggregates across partitions; keeping a small **`classification`** module vs **inlining** at the wiring site is a **later local** choice ([**Classification and lambda-local config**](#decisions-locked)).

---

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| **API style** | **Constructor-based class** (`new ImportVerticalConsistencyAnalyzer(deps)` or final name TBD). Prefer **not** a factory unless implementation hits a concrete TypeScript pain (e.g. inference that cannot be fixed without a factory); factories buy inference polish more than this prototype needs. |
| **Public surface vs internals** | **Single primary async entry:** **`check(...)`** (exact args TBD, e.g. universal key or scope). **`check`** performs **all** loading and comparison and **populates** optional instance **findings** (or a clear snapshot field). **Output** is read via **subsequent** getters or small methods that **assume** **`check`** has run; avoid exposing **`loadUniversalPartitionRows`** or similar as **public** instance methods---those stay **internal** so the abstraction stays portable and call sites do not re-orchestrate. TypeScript **privacy** is ergonomic, not cryptographic; document intent for reviewers. |
| **Constructor deps shape** | **Split** injection: **separate** narrow **structural** types for each fetch concern the vertical analyzer needs (e.g. authoritative universal-key **component** lines vs **projected** **`Meta::Import`** / index material), declared in **`mtw-gateways`** so the package still **never** imports **`InternalCache`**. At the call site, an **`InternalCache`** instance (or a **superset** object) can be passed through **as** the implementation where existing methods **match** those shapes; otherwise use **thin wrappers** that forward to **`assetDB`**, a subset of cache methods, or fakes. **Do not** collapse into a **single** catch-all callback if that would prevent cache-aligned wiring. **Concrete TypeScript** interface names and which **`InternalCache`** methods map to which dep (**assets** vs **diagnostics**) are **not** prescribed here---**improvise** during implementation as makes sense; document the chosen wiring briefly next to the analyzer or in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) when stable. |
| **Generics** | **Keep minimal.** A fixed **findings DTO** for the vertical prototype is enough. Heavy type-parameter fan-out belongs at APIs like **`standardComponentFactory`** (one entry, many component kinds); consistency analyzers are **one orchestrator per projection**---variance is **between** analyzers, not inside one mega-generic factory. Add generics only if a second analyzer proves shared type plumbing. |
| **Cross-analyzer reuse** | **Pattern and composition**, not **inheritance.** Document **how** to build analyzers (injection, pure helpers, tests with fakes); do **not** introduce a shared **`ConsistencyAnalyzer` base class** in v1. |
| **Row typing** | **Reuse** the existing universal-partition **query row** shape used across vertical helpers: **`StandardComponentData` + `AssetId` + `DataCategory`** (same as [`componentRowsFromUniversalPartitionLines`](../../../packages/mtw-gateways/ts/assets/components/verticals/partitionComponentRows.ts) inputs). Do **not** introduce a narrower branded analyzer-only row type for v1 unless a concrete pain appears. |
| **Stale semantics** | **Confirmed:** taxonomy unchanged---both **missing** and **orphan** **`Meta::Import`** categories vs expected implies **stale**. The analyzer **findings** after **`check`** must expose enough detail for **diagnostics** (labels) and **heal** (repair intents) under that same rule as today. |
| **Package documentation timing** | **Generalize early:** when the vertical analyzer ships, add (or extend) a **generalized** consistency-analyzer subsection in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) describing injection, **`check`**, black-box processing, and dependency rules---**without** waiting for a second non-vertical analyzer. Vertical-specific exports remain documented beside it. |
| **Classification and lambda-local config** | Shared **taxonomy** belongs with shared **semantics** (typically **`mtw-gateways`** once helpers move). Per-lambda concerns include **configuring** the constructed analyzer (how classification participates, aggregation across keys for diagnostics, etc.). Whether [`classification.ts`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/classification.ts) stays a **module** or is **inlined** at the wiring boundary is a **local** ergonomics decision later---not primarily a repo-wide "avoid duplicate taxonomies" problem once semantics are centralized. |
| **Testing split** | Analyzer **unit** tests in **`mtw-gateways`**: **in-memory** fakes only for injected deps. **Integration** tests stay in **`lambda/assets`** / **`lambda/diagnostics`** with existing **`assetDB`** mocking patterns. |

---

## Dependency rules (non-negotiable)

1. **`@tonylb/mtw-gateways`** must **not** import concrete **`InternalCache`** modules from **`lambda/...`**.
2. Injection interfaces should depend only on **shared types** (e.g. `EphemeraId`, row shapes from **`mtw-wml`** / interfaces) and **`Promise`** return types. Prefer **several** small interfaces (see [**Decisions (locked)**](#decisions-locked), **Constructor deps shape**) so lambdas can **satisfy** them with cache surfaces **or** thin wrappers.
3. Lambdas **construct** adapter objects that close over **`InternalCache`**, `assetDB`, or both; the analyzer depends only on the **structural** contract, not the concrete cache class.

---

## Decision points and unknowns

No open items at present; resolved decisions live under [**Decisions (locked)**](#decisions-locked).

---

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Apply the same rule to nested bullets when added.

- [ ] Implement **split constructor deps** (structural interfaces), **`async check`** signature, **findings** fields, and **output** accessors (types exported from `ts/assets/components/verticals/` or adjacent file); **name** interfaces and map **`InternalCache`** per [**Decisions (locked)**](#decisions-locked) (**Constructor deps shape**, improvisation); document wiring for assets and diagnostics when stable.
- [ ] Implement **analyzer** as a **constructor-based class** with **`check`** + internal (non-public) load/compare steps using existing **`deriveRaw` / `salvage` / `metaImportDataCategory`** pipeline; no Dynamo except via injected deps.
- [ ] Centralize shared taxonomy (**`classifyImportVerticalSets`**, **`aggregateMisalignmentStatuses`**) in **`mtw-gateways`** as appropriate; update **`lambda/diagnostics`** imports. Per [**Classification and lambda-local config**](#decisions-locked), lambda-side **configuration** of the analyzer vs keeping a small **`classification`** module vs **inlining** is decided locally when wiring.
- [ ] Refactor **`syncImportVerticalPartition`** to use the analyzer output for **toPut** / **toDelete** (and single place for Meta row prefix filtering if extracted).
- [ ] Refactor **`componentVerticalMisalignmentSweep`** `analyzeUniversalPartition` to use the same analyzer with **direct** `assetDB` injection (or adapter).
- [ ] Optional: **assets** path passes a loader that uses **`InternalCache`** where it reduces duplicate reads (document in **`lambda/assets`** cache `AGENT.md` if non-obvious).
- [ ] Update **`packages/mtw-gateways/AGENT.md`**: **Shipped exports** / shared helpers for the vertical analyzer **and** a **generalized** consistency-analyzer subsection per [**Package documentation timing**](#decisions-locked) (**generalize early**, same window as code); link from [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) if the writer/heal story changes for readers.

---

## Promotion after prototype

Per [**Package documentation timing**](#decisions-locked), land the **generalized** pattern description in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) **together with** the vertical prototype (injection, **`check`**, black-box processing, no lambda imports). Trim redundant prose from this task plan when that doc update ships. Optional: link from [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) under **composition** if future analyzers follow the same injection style.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan agreed | Done (this doc) |
| API shape (constructor class, **`check`** + findings, encapsulated loads, **split** deps / **`InternalCache`** alignment, pattern vs inheritance, modest generics) | Locked ([**Decisions (locked)**](#decisions-locked)) |
| Row typing, stale semantics, **generalize early** doc policy, classification/config, testing split | Locked ([**Decisions (locked)**](#decisions-locked)) |
| Injection + analyzer implementation | Not started |
| Diagnostics + assets refactors | Not started |
| Package doc promotion | Not started |

---

## Verification

Record **exact** commands in this section when implementation exists; prefer repeating cwd + runner from [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

- [ ] `cd packages/mtw-gateways && npm test -- --testPathPattern=ts/assets/components/verticals` (gateway + new analyzer/classification tests).
- [ ] `cd lambda/assets && npm test -- --testPathPattern=dataSource/components/verticals` (if sync/heal touched).
- [ ] `cd lambda/diagnostics && npm test -- --testPathPattern=componentVerticalMisalignmentSweep` (if sweep touched).

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | Gateway purpose, non-goals, test runner |
| [`taskPlanning/lambda/assets/AGENT.componentVertical.planning.md`](../../lambda/assets/AGENT.componentVertical.planning.md) | Vertical index initiative |
| [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) | `DeferredCache` / `InternalCache` |

---

## Notes

- Prefer **ASCII punctuation** in edits to this file (project convention).
