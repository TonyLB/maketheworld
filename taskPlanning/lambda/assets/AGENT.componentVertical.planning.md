# Component vertical denormalization (assets lambda / Dynamo) - planning

**Status:** In progress (design exploration). **In scope:** building the **component vertical** denormalization (projector + Dynamo rows). **Out of scope for this initiative:** refactoring [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) off `internalCache.Graph` (likely a **follow-on**). Next: resolve **Decision points** enough to spike schema + projector hooks.

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs in package docs). **Dispose** after the initiative ships and lasting notes live under [`lambda/assets/`](../../../lambda/assets/) (or adjacent `AGENT.md` files).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions (checkboxes, verification).
2. Read the current import / inheritance pain and intended component-level graph direction:
   - [`lambda/assets/fetchImportDefaults/AGENT.md`](../../../lambda/assets/fetchImportDefaults/AGENT.md)
   - [`lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md`](../../../lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md)
3. Read asset table caching and component events (where a projector would attach):
   - [`lambda/assets/dataSource/caching/AGENT.md`](../../../lambda/assets/dataSource/caching/AGENT.md)
4. **Command authority:** When this plan adds tests, prefer any future [`lambda/assets/AGENT.development.md`](../../../lambda/assets/AGENT.development.md) if it exists; otherwise follow the relevant package or lambda test patterns referenced from root [`AGENT.md`](../../../AGENT.md).
5. **Baseline (before implementation edits):** No single command is mandated yet; once code exists, record the exact Vitest/Jest invocation for the touched package or lambda in **Verification** below.

---

## Goal

Introduce an **eventually consistent, denormalized view** of each component's **import vertical** (inheritance / merge chain across assets), keyed by **universal component identity** (`ROOM#...`, `FEATURE#...`, etc.), so that:

- **Future read paths** (notably a later refactor of [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts)) can replace **deep recursive asset loads** with a **bounded number of Dynamo operations**: e.g. one `Query` for all lightweight import-meta items under a stable partition, then **`BatchGetItem`** (or equivalent) for full `Meta::...` payloads needed for merge. **Shipping those reads is not required** for the first milestone of this task---see [`Graph source of truth and fetchImportDefaults`](#graph-source-of-truth-and-fetchimportdefaults).
- **Downstream impact** queries ("what depends on this component or asset layer?") become feasible via **reverse indexes** or GSIs (secondary to the primary vertical-read story unless we scope them together).

**Authoritative data** remains the existing asset / WML pipeline and cached component rows; this vertical is a **derived index**, maintained on cache / publish paths.

---

## Background (why this is tractable now)

- **`universalKey` is invariant** for persisted work in the assets path: client and wire formats may still use local-only authoring fragments, but by the time data is handled in the **assets lambda and DynamoDB**, components are expected to be standardized on universal keys (see `StandardForm.finalize()` in [`packages/mtw-wml/ts/standardize/index.ts`](../../../packages/mtw-wml/ts/standardize/index.ts)).
- **Import semantics** have shifted from "fetch asset A's local name X and align to our local name Y" toward **"inherit this universal component's representation in asset A"** (`_from` as asset pointer with stable `universalKey`), which matches a **vertical slice** indexed by universal id.
- **Current `fetchImportDefaults`** builds an asset-level `InheritanceGraph` via `internalCache.Graph.get` (known stale / unmaintained per code comments) while **`recursiveFetchImports`** walks **`component._from`** per asset; see [`lambda/assets/fetchImportDefaults/index.ts`](../../../lambda/assets/fetchImportDefaults/index.ts) and [`recursiveFetchImports.ts`](../../../lambda/assets/fetchImportDefaults/recursiveFetchImports.ts). The redesign doc already argues for **component-level** edges.

---

## Proposed direction (working model)

**Shape (illustrative, not final):**

- Partition **query space** per **universal component id** (e.g. `AssetId` / PK = `ROOM#...` or the project's canonical component id string).
- Sort key or item types for **lightweight** rows such as `Meta::Import::...` (exact naming TBD) encoding **child/parent asset pairing** and denormalized fields needed for **stubs** (e.g. `shortName`) without loading full components.
- **One `Query`** (with a constrained SK prefix or category set) returns **the entire import vertical metadata** for that component **in one round trip**, instead of **O(depth)** recursive discovery calls.
- **Second phase:** `BatchGetItem` (or parallel `GetItem`s within limits) for **full** per-asset component meta / payload rows referenced by that vertical.
- **Optional third:** stub assembly using denormalized fields from import-meta rows where sufficient.

**Maintenance:** Emit or update denormalized rows from existing **cache / diff** flows ([`cacheAsset`](../../../lambda/assets/dataSource/caching/cacheAsset.ts), `Component Updated` events per caching AGENT.md) so the vertical stays **eventually consistent** with authoritative stored components.

---

## Decision points

Most topics below have a **strong lean** (or explicit **out of scope**) in the table and linked subsections---enough to **start implementing** the projector and rows. What remains are **implementation details** (exact attributes per hop item, Problem Report wiring shape if any, same-table vs split layout) and **follow-ons** (healing cycles, `fetchImportDefaults` refactor), not unresolved architectural forks.

| Topic | Question / notes |
| --- | --- |
| **PK scope** | **Lean: pure universal key** (`ROOM#...`, etc.). Rationale: [`PK scope`](#pk-scope). |
| **Item model** | **Lean: one row per hop.** Rationale: [`Item model`](#item-model). |
| **Reverse / range access** | **Lean:** ship **vertical read** first; no separate **GSI** for single-hop dependency walks in v1. Sort-key shape still matters for **`begins_with` inside one partition**---see [`Sort key and DataCategory for Meta::Import`](#sort-key-and-datacategory-for-metaimport). |
| **Graph source of truth** | **Long-term lean:** `fetchImportDefaults` should use **component verticals**, not `internalCache.Graph`. **This initiative** only delivers the vertical index; **wiring fetchImportDefaults** is **out of scope**---see [`Graph source of truth and fetchImportDefaults`](#graph-source-of-truth-and-fetchimportdefaults). |
| **Cycles** | Long-term design question; pipeline limits strict rejection---see [`Cycles (imports)`](#cycles-imports). **Near-term lean:** emit **Problem Report** for diagnostics; defer **healing**. |
| **Consistency UX** | **Lean:** eventual consistency is fine; editor assumes **concurrent edits** and shifting authoritative data---see [`Consistency UX`](#consistency-ux). |
| **Naming** | **`Meta::Import::...`** encoding (stripped asset ids): [`Sort key and DataCategory for Meta::Import`](#sort-key-and-datacategory-for-metaimport). Also align with existing `Meta::Room`, caching conventions, and Dynamo key size limits. |

### PK scope

**Lean:** Partition by **universal component id** only so all denormalized import-meta rows for that identity live under **one partition** and **one `Query`** returns the full vertical (single round trip for the metadata envelope).

**Composite PK** (e.g. anchor asset + universal key) **fragments** one logical vertical across many partitions. To assemble the **same** graph you then need **multiple queries**, and **N** can grow with the number of anchor contexts---often **unknown until enumerated**, i.e. potentially **unbounded** without a separate discovery pass. That trades away the main access-pattern win (bounded reads, no recursive widening).

**Hot partitions** are the usual motivation for composite sharding; for typical content that cost is likely **small** next to losing single-query vertical reads. Revisit only if metrics show one universal key carrying an extreme volume of co-located rows.

### Item model

**Lean:** **One Dynamo item per hop** (each records an edge or layer endpoint along the import vertical under the universal-key partition).

**Summary row (single ordered ancestry list on one item)** upside: one **`GetItem`** can return the **full merge order** without walking/sorting multiple hop rows.

**Summary downside (your read):** If the ordered chain is **materialized on many rows**---for example each downstream asset or dependent stores its **own** copy of "full ancestry from root"---then a **mid-chain edit** (asset **C** switches import parent from **A** to **B**) forces updates to **every** replica that embedded the old prefix. That is classic denormalization **fan-out**.

**Nuance:** A **single** canonical summary item per universal key---whether an **ordered chain** or a **tree-shaped** encoding---avoids multi-row fan-out **within that index**, but **every** import-graph edit for that identity contends on **the same item** (hot key, optimistic retries). Compared with **replicated** chain summaries across dependents, that trades **fan-out writes** for **concentrated contention**.

**Per-hop** localized edits: change only the affected hop row(s), derive total order with explicit ordering metadata on each hop or a cheap sort over a small depth---still **one `Query`** loads all hops.

**Hybrid:** optional small **summary cache** for debugging or fast paths later; **authoritative** edges remain per-hop to limit blast radius.

### Sort key and DataCategory for Meta::Import

**Primary read:** partition by **universal component id** and **`Query`** the import-meta rows for that vertical (full envelope). We are **not** relying on a separate index for **either direction** of single-hop lookup as the main API.

**Sort-key ordering still matters** for optional **`begins_with` / range filters on the sort key** within **that same partition**:

| Order | Example shape | Range queries |
| --- | --- | --- |
| Child then parent | `Meta::Import::${child}::${parent}` | Little benefit: a given child asset should have **at most one** parent for this hop, so keyed lookup suffices; prefix on child does not match how we filter by upstream asset. |
| **Parent then child** | `Meta::Import::${parent}::${child}` | **`begins_with('Meta::Import::${parent}::')`** selects hop rows whose **upstream** asset is `${parent}`---**within this universal key's partition**, i.e. modest extra filtering without scanning unrelated hops. |

**Descendants across the whole library** are **not** answered by this prefix alone (that would require querying **every** universal-key partition or a dedicated reverse index). When we need **all descendants** of an asset, we likely **walk projected trees** or run a **job**---same as before; parent-first SK is a **small** ergonomics win, not a global graph index.

**Lean encoding (proposal):** treat sort key / `DataCategory` segment as:

`Meta::Import::${parentAssetId}::${childAssetId}`

where **`${parentAssetId}` and `${childAssetId}` are asset ids with the `ASSET#` prefix stripped** (fixed convention, shorter SKs, predictable sorting). Revisit if stripping collides with id formats; document the canonical strip rule next to implementation.

### Graph source of truth and fetchImportDefaults

**Long-term expectation:** [`fetchImportDefaults`](../../../lambda/assets/fetchImportDefaults/index.ts) should **stop depending** on asset-level `internalCache.Graph` ancestry (see [`lambda/assets/internalCache/graph.ts`](../../../lambda/assets/internalCache/graph.ts); stale / unmaintained per existing comments in `fetchImportDefaults`) and instead read **component vertical** metadata plus batched component payloads.

**This initiative (scope):** implement **maintenance and storage** of the vertical (`Meta::Import::...` under universal-key partitions, projector from cache events). **Deliberately not required here:** rewiring `fetchImportDefaults` or removing `Graph.get` from that path. Treat that as a **follow-on refactor** once the index exists and can be validated (comparison tests, backfill).

**Asset-level summaries:** if legacy callers still need coarse asset-to-asset edges, they can be **derived** from component verticals later; not blocking the first vertical ship.

### Cycles (imports)

**Intent:** Import chains are expected to stay **acyclic** in normal authoring. The **front-end** tries to fence edits that would create cycles where it can see enough graph context.

**Pipeline gap:** The **`wml`** path that **accepts** edits does **not** have the same **cross-asset consistency** visibility as **`assets`** when applying cached structure. By the time **`assets`** could validate import topology against the full picture, **`wml` has already committed**. There is therefore **no easy reject-at-submission** fix at the `wml` acceptance layer for cycles that only become visible once cross-asset state is considered.

**Implication for this initiative:** Cycle enforcement on the **vertical projector** is not a hard gate we can rely on to block bad writes upstream. **Near-term lean:** when projection detects an inconsistent or cyclic import graph, emit a **`Problem Report`** (or equivalent) aimed at **diagnostics** / author tooling, and **defer** "how do we **heal** this?" to later work. That keeps the vertical index honest about failure without blocking delivery on a full healing story.

**Testing:** Full **cycle regression** coverage is constrained by the same ordering (**committed `wml`** before **`assets`** validation). Treat exhaustive cycle-testing as **follow-on** once acceptance or healing strategy is clearer.

### Consistency UX

The **editor** is being built to tolerate **concurrent edits** to underlying imports and other foundational data **moving under the session** for reasons beyond this index. **Vertical-index staleness** is therefore **not** a primary UX risk: there is **no tight product requirement** on maximum lag between authoritative writes and projected rows---staleness is another case of "the world changed," alongside other concurrent edits.

**Lean:** implement the vertical as **eventually consistent** without hard latency SLOs for catch-up. Optimize projector throughput and correctness first; **do not** block on strong read-after-write for the denormalized vertical unless a future caller proves it needs one.

---

## Unknowns / risks

- **Invalidation granularity:** With **one partition per universal component id** and hop rows that describe **only that identity's** import vertical, a change to **`from` / import** for component **X** should normally touch **partition X only** (update or replace affected `Meta::Import::...` items there). **Fan-out across many partitions** would show up only if we **replicate** edges onto dependents or maintain separate **reverse** projections---not implied by the forward vertical index alone.
- **Batch size limits:** Dynamo **`BatchGetItem`** caps (100 items, 16 MB per call) are **unlikely to bind** in the near term: current content uses **inheritance depth of at most about 2**, far below 100. Revisit only if product allows **very deep** chains or if each vertical pulls **many** additional keys per hop.
- **Interaction with broken asset graph today:** Migration path: backfill from cached components vs rebuild job vs lazy rebuild on read.
- **Testing:** Contract tests for "query vertical + merge equals recursive golden path" once both paths exist.
- **Cycles:** Cross-asset cycles may exist only after **`wml`** commit; projector should **surface** problems (Problem Report) rather than pretending this initiative solves **acceptance** or **healing**---see [`Cycles (imports)`](#cycles-imports).

---

## Out of scope (for this planning doc)

- Replacing **within-asset** structural parenting (`SchemaOrganization`, explicit parent) -- still authoritative in StandardForm; only **cross-asset import vertical** here unless we explicitly merge initiatives.
- Client authoring **local-only** fragments before `finalize()` -- outside Dynamo contract.
- **Refactoring `fetchImportDefaults`** to consume component verticals (and dropping or narrowing reliance on `internalCache.Graph` there) -- **follow-on** after the vertical index and projector exist; see [`Graph source of truth and fetchImportDefaults`](#graph-source-of-truth-and-fetchimportdefaults).

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`lambda/assets/fetchImportDefaults/AGENT.md`](../../../lambda/assets/fetchImportDefaults/AGENT.md) | Fetch imports behavior |
| [`lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md`](../../../lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md) | Component-level graph rationale |
| [`lambda/assets/dataSource/caching/AGENT.md`](../../../lambda/assets/dataSource/caching/AGENT.md) | Cache pipeline / events |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply the same rule to nested bullets when added.

- [ ] Confirm **PK/SK** and item shapes with a short schema sketch (and Dynamo access patterns: vertical `Query`, optional reverse GSI).
- [ ] Document **projector** placement: which function(s) run after diff vs on decache; idempotency and delete behavior.
- [ ] Add **golden** or comparison tests for **vertical assembly** vs current merge behavior (fixtures / harness); may run **outside** `fetchImportDefaults` until that lambda is wired.
- [ ] **Follow-on (separate initiative or later milestone):** refactor **`fetchImportDefaults`** to use vertical `Query` + `BatchGetItem` and retire reliance on `internalCache.Graph` for ancestry where appropriate.
- [ ] Plan **backfill** job or lazy repair for existing Dynamo rows (if needed).
- [ ] Move steady-state architecture notes to [`lambda/assets/`](../../../lambda/assets/) `AGENT.md` (or fetchImportDefaults doc) and trim this file when done.

---

## Progress

| Milestone | Status |
| --- | --- |
| Problem framing + proposed denormalized access pattern | Done (this doc) |
| Schema + projector design | Not started |
| Implementation spike | Not started |
| Tests / migration | Not started |

---

## Verification

When implementation exists, record **exact** commands here (cwd + runner). Until then:

- [ ] Unit tests for **vertical assembly** pass (paths TBD).
- [ ] **Follow-on:** when `fetchImportDefaults` is refactored, `grep -r "fetchImportDefaults\\|recursiveFetchImports" lambda/assets/fetchImportDefaults` reflects vertical reads (or document deliberate interim behavior).

---

## Notes

- Prefer **ASCII punctuation** in edits to this file (project convention).
