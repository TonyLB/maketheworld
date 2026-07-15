# `MultiKeyUpdate`: a Record-reduce optimistic-lock primitive for `transactWrite`

**Status:** Both slices shipped 2026-07-14. Slice 1: `MultiKeyUpdate` implemented in `transact.ts` (reducer operates on `Record<string, T>` keyed by marshalled key, not a `Map` --- refined during implementation planning to avoid Immer's `enableMapSet()` requirement and a `deepEqual`-on-`Map` gap). Slice 2: `MultiKeyUpdate`'s `cascade` field, generalizing `deleteCascade`'s same-transaction-merge pattern beyond its delete-only/final-state-only limits, with no second fetch round for cascade output (a decided constraint, not a gap --- see Design below). Full package suite green (23 suites / 140 tests). Next step: none required by this plan --- see the "when the task finishes" note at the bottom before archiving.

See [`taskPlanning/AGENT.md`](../../../AGENT.md) first for what belongs in this file versus in durable docs, and for the **Recommended order checkboxes** convention this file follows.

## Why this plan exists

This is a **foundational library primitive** for `@tonylb/mtw-utilities`'s `transactWrite`, motivated by (but scoped separately from) an application-level need in `lambda/ephemera`. The application-level need --- consolidating the object-manipulation apply path (`applyObjectTakeHold`/`Drop`/`SetTakeHold`/`SetDrop`, `applyObjectRelationalChange`) so they stop independently re-deriving diffs the sandbox (`evaluateSandboxPlan`) already computed --- is tracked separately in [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`](../../../lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) and should **not** be duplicated here. This plan is scoped to the package folder it lives in (`packages/mtw-utilities/ts/dynamoDB/`): a generic, application-agnostic addition to `transactWrite`'s vocabulary of transaction-item kinds. The ephemera-side consumption (rerunning the sandbox inside the reducer, wiring up adjacency-row cascades for position graphs) is a **future slice on the ephemera plan**, to begin only once this primitive ships and its contract is stable.

## Background: what already exists

`transactWrite` (`packages/mtw-utilities/ts/dynamoDB/mixins/transact.ts:51-195`) already supports 6 kinds of `TransactionRequest` item (`transact.ts:33-45`): `Put`, `Delete`, `Update`, `PrimitiveUpdate`, `SetOperation`, `ConditionCheck`. All 6 are merged into one flat array (`transact.ts:64-187`, `.flat()` at line 187) and sent as a single `TransactWriteItemsCommand` (`transact.ts:188-190`) --- DynamoDB's native all-or-nothing atomicity across heterogeneous item kinds, already proven in this codebase.

The `Update` kind is the interesting one: it is a **single-item optimistic-lock-by-reducer** primitive. Given a key, it batch-fetches the current value (`transact.ts:52-60`), runs it through an Immer reducer (`update.ts:278`, via `updateByReducer`, `update.ts:39-164`), diffs old vs new to build `SET`/`REMOVE` expressions, and conditions the resulting `Update` on every "checked" attribute still equalling its previously-fetched value (`update.ts:60-108`) --- a field-level optimistic lock, not a single version counter, but functionally equivalent. `UpdateExtendedProps` (`update.ts:166-205`) is this item's full prop surface.

There is already a **TODO immediately below `transactWrite`** describing an unbuilt multi-item operation (`transact.ts:197-204`):

```ts
// TODO: Add transactAggregateGraph operation that accepts a graph with nodes of the following types:
//    - ValueFetch (with priorFetch option) to make child steps dependent upon the value of unchanged parent nodes
//    - AggregateUpdate to take in parent values, update a node using a reducer, and pass on the updated values
//
// Process each topological layer of the aggregateGraph as a transaction, using ConditionCheck and Update transactWrite
// arguments.
```

This plan's `MultiKeyUpdate` is a **simpler, flatter special case** of that TODO's idea: one `Record<string, T>`, one reducer over the whole set, no multi-layer topological dependency graph. It is closer in spirit to what `lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts` already hand-rolls informally today (fetch N keys into a map, apply effects across the map, bucket results back into per-key `Update` items, submit as one `transactWrite` call) --- this plan turns that ad hoc pattern into a reusable, generic transact-item kind.

**Cascade precedent, and its limits.** `deleteCascade` (`update.ts:192-195`, consumed at `update.ts:282-297` and merged into the same transaction at `transact.ts:92-105`) is the *only* existing mechanism whose callback output gets merged into the same atomic `TransactWriteItems` call. But it is narrow: it fires only on the delete branch, receives only the **final/new** state (never the prior value), and its return type is restricted to `Delete`-only keys. `successCallback` (`update.ts:203`) is the only callback that sees both `(newState, prior)` together, but it runs strictly *after* the transaction has already committed (`transact.ts:191-194`) --- too late to contribute items to that write. Slice 2 below generalizes the *pattern* `deleteCascade` established (cascade output merges into the same transaction) beyond its current limits (final-state-only, delete-only output).

## Getting Started

1. **Understand project foundations.** Read [`taskPlanning/AGENT.md`](../../../AGENT.md) once for the durability ladder and what belongs in a task plan versus a durable doc. This plan is unusually "foundations-only" --- no application code changes --- so the discipline of *not* pulling ephemera-specific concerns in here matters more than usual.
2. **Read this document's Design and Open decisions sections** below before writing code. Both slices are shipped; only OD-2 (deferred, not blocking) remains in Open decisions.
3. **Core integration points:** `packages/mtw-utilities/ts/dynamoDB/mixins/transact.ts` (the `TransactionRequest` union and the `.map(...).flat()` merge step) and `packages/mtw-utilities/ts/dynamoDB/mixins/update.ts` (`UpdateExtendedProps`, `_optimisticUpdateFactory`, `updateByReducer`, `deleteCascade`'s handling). Both files are small enough to read in full.
4. **Review implemented precedent:** `lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts` (`:184-320`) is the closest thing to a hand-built prior art for this primitive --- read it to see the shape this is generalizing, not to copy its DynamoDB-schema-specific logic (that belongs to the ephemera plan, not this one).
5. **Testing patterns:** this package uses **Jest** (`packages/mtw-utilities/package.json` --- `"test": "jest"`), not Vitest. Existing sibling tests to model new tests on: [`transact.test.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/transact.test.ts) and [`update.test.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/update.test.ts). The `ConditionalCheckFailedException`/`TransactionCanceledException` rejection-propagation test in `transact.test.ts:308-337` is a good model for how this plan's new failure-path tests should be shaped (assert the whole call rejects; no swallowing).
6. **Next task:** see **Recommended order** below; work top to bottom, checking off lines as you complete them, per [taskPlanning/AGENT.md#recommended-order-checkboxes](../../../AGENT.md#recommended-order-checkboxes).
7. **Baseline before editing:** `cd packages/mtw-utilities && npm run test` should be fully green before starting (no `--watchAll=false` flag needed for this package's Jest config, but confirm against the package's own `test` script rather than assuming ephemera's flags apply here).

## Design

### Slice 1: `MultiKeyUpdate` --- the core primitive

A new `TransactionRequest` variant, alongside the existing 6 in `transact.ts:33-45` (`Put`, `Delete`, `Update`, `PrimitiveUpdate`, `SetOperation`, `ConditionCheck`). **Named `MultiKeyUpdate`** (decided 2026-07-14), matching the existing `TransactionRequest<...>Update`/`PrimitiveUpdate`/`SetOperation` naming convention --- so the union member is `{ MultiKeyUpdate: TransactionRequestMultiKeyUpdate<KIncoming, KeyType> }`, alongside today's `{ Update: TransactionRequestUpdate<...> }`. **OD-1 fully resolved (2026-07-14):**

- **Keys supplied** as `Keys: DBHandlerKey<KIncoming, KeyType>[]` --- an array of the same key shape every other `TransactionRequest` kind already uses (no new key vocabulary).
- **Record keying** uses the **marshalled key** (the same string DynamoDB-marshalling already produces for lookups elsewhere in `transact.ts`/`update.ts`, e.g. via `this._remapIncomingObject(...)` + `marshall(...)`), not a caller-supplied key type or the raw unmarshalled `DBHandlerKey` object. So the reducer operates on `Record<string, T>` where each string key is that key's marshalled form --- deterministic, comparable, and consistent with how `transact.ts:83` already looks up a fetched item by matching marshalled-equivalent key fields.

**Shipped shape (2026-07-14):**

- **Input:** `Keys: DBHandlerKey<KIncoming, KeyType>[]`, plus a single `reducer: (draft: WritableDraft<Record<string, T>>) => void` operating on an Immer draft of the whole fetched set (keyed by marshalled key, per OD-1 above). The original framing mirrored the ephemera sandbox's own `Map<hostId, PositionGraph>` shape, but `Record` was chosen instead during implementation planning: `Map` would have required calling Immer's `enableMapSet()` (nothing in this repo does, and it fails only at runtime), and the existing `deepEqual` helper (`packages/objects.ts:42-57`) does not work on `Map` instances at all (`Object.keys`/`Object.entries`-based). Neither risk applies to a plain `Record`, which is also the more idiomatic shape given `DBHandlerItem`'s own `Record<string, any>` base type.
- **Fetch:** batch-fetch all keys via the existing `getItems` path (`transact.ts:57-60` already does this for single-item `Update`; generalized to also cover `MultiKeyUpdate`'s keys in the same batched call), then build the marshalled-key-keyed `Record` from the fetch results before running the reducer.
- **Reduce:** run the whole fetched `Record` through the one reducer via `produce` (Immer), exactly as `updateByReducer` (`update.ts:39-164`) does today for a single item --- generalized from "reduce one `T`" to "reduce one `Record<Key, T>`".
- **Diff, per key:**
  - **Unchanged** (deep-equal old vs new): **always** emits a `ConditionCheck` item (OD-3, decided --- no opt-out), via a new `_unchangedFieldConditions` helper (genuinely new logic --- `updateByReducer` short-circuits to `'ignore'` with no conditions at all when nothing changed, so this case could not be reused from it), so that a key merely *read* by the reducer --- but not written --- still participates in the optimistic lock.
  - **Changed:** reuses `_optimisticUpdateFactory` **directly, unmodified**, via a reducer that ignores its draft and returns the already-computed next value (Immer's `produce` recipe accepts a return value in place of draft mutation) --- zero new diff logic for this path.
  - **Removed from the set:** deferred (OD-2, 2026-07-14) --- Slice 1 does not support a key disappearing from the reduced `Record` entirely; a reducer that removes a previously-fetched key throws synchronously (`MultiKeyUpdate reducer may not remove a previously-fetched key`) rather than silently misbehaving.
- **Merge:** all of the above ride into the same `.map(...).flat()` step (`transact.ts:64-187`) and the same single `TransactWriteItemsCommand` send (`transact.ts:188-190`) as every other kind --- no new DynamoDB call, no new retry logic (retry-on-conflict stays the caller's responsibility via `exponentialBackoffWrapper`, unchanged from today).

Implementation: `transact.ts`'s `MultiKeyUpdate` branch, `_marshalledKeyString`, `_unchangedFieldConditions`. Contract and code-map now recorded in [`packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md`](../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md) and [`AGENT.implementation.md`](../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.implementation.md). Tests: [`transact.multiKeyUpdate.test.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/transact.multiKeyUpdate.test.ts).

### Slice 2: generalized before/after cascade

A cascade mechanism attached to `MultiKeyUpdate` (not a modification of `deleteCascade`, which stays as-is for existing single-item callers): a callback of roughly the shape `(prior: Record<string, T>, next: Record<string, T>) => TransactionRequest<KIncoming, KeyType>[]` (marshalled-key-keyed records, per OD-1), whose returned items merge into the **same** transaction, the same way `deleteCascade`'s output already does (`update.ts:284` -> `transact.ts:99-104`) --- but generalized in the three ways discussion identified `deleteCascade` falls short for this use case. **OD-4 decided (2026-07-14):** the cascade runs strictly *after* the reducer and receives its actual, already-computed output as `next` --- not run independently or in parallel with the reduction. This matches `deleteCascade`'s own precedent exactly (`update.ts:284` passes `updateOutput.newState`, the reducer's own output, not a separately-derived value), so Slice 2 is extending an established sequencing, not inventing a new one.

1. **Sees both prior and next**, not just the final state.
2. **Whole-set visibility**, not scoped to a single key --- since `MultiKeyUpdate`'s reducer already operates over the whole `Record`, the cascade naturally gets the same visibility for free; this is *available*, not *required*, for any given cascade consumer (a consumer needing only its own key's diff, e.g. the eventual adjacency-row use case, simply doesn't use the cross-key information --- that's a property of that consumer, not a constraint this primitive imposes).
3. **Arbitrary output item kinds**, not `Delete`-only --- the cascade should be able to return `Put`/`Update`/`Delete`/`ConditionCheck` items, whatever the consumer needs.

This slice is deliberately generic: it should not reference position graphs, adjacency rows, or anything ephemera-specific. Its test coverage should exercise the mechanism with a synthetic record/reducer/cascade, not real game-state shapes.

**Shipped shape (2026-07-14):** `_transactionRequestItemToTransactWriteItems` was extracted from `transactWrite`'s inline `.map(...)` body (a pure, behavior-neutral refactor, verified by the full existing suite staying green before any cascade code was added) so the `MultiKeyUpdate` branch could recursively convert cascade-returned items through the exact same conversion logic used for every top-level item. **The no-second-fetch-round constraint (confirmed with the user, 2026-07-14):** since the batch-fetch that primes `Update`/`MultiKeyUpdate` items runs once, before the reducer/cascade ever execute, a cascade-returned `Update` item must supply its own `priorFetch` (throws otherwise), and a cascade may not return a nested `MultiKeyUpdate` item (throws otherwise) --- `Put`/`Delete`/`ConditionCheck`/`PrimitiveUpdate`/`SetOperation` need no fetched state and are unrestricted. This was a genuine fork (the alternative was a second fetch round for cascade-returned items lacking `priorFetch`, rejected as edging toward the full multi-layer `transactAggregateGraph` TODO this plan deliberately scoped away from).

Implementation: `transact.ts`'s `cascade` field on `TransactionRequestMultiKeyUpdate`, the cascade-invocation block inside the `MultiKeyUpdate` branch of `_transactionRequestItemToTransactWriteItems`. Contract and code-map updated in [`AGENT.contract.md`](../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md) and [`AGENT.implementation.md`](../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.implementation.md). Tests: the `describe('cascade', ...)` block in [`transact.multiKeyUpdate.test.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/transact.multiKeyUpdate.test.ts).

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to implement the next slice(s). When a decision ships, record it in this package's own contract/implementation docs and remove the row here.

**Both slices shipped (2026-07-14):** OD-1, OD-3, and OD-4 removed below --- all fully decided and now normative text in [`packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md`](../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md). Only OD-2 remains, since it was explicitly deferred rather than resolved.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| OD-2 | **Deferred (2026-07-14):** `MultiKeyUpdate` will not support removal from the set (a key present in the fetched `Record` disappearing entirely --- as opposed to `T` itself expressing "empty"/tombstone state) as a first-class `Delete` case. Neither shipped slice needed it. Revisit only if a future consumer needs it. | Both slices (shipped without it) | Deferred |

## Recommended order

Pending work uses `- [ ]`; completed work uses `- [X]`. Mark nested lines as you finish them so partial progress is visible.

- [X] Slice 1: `MultiKeyUpdate` core primitive (OD-1 decided, OD-2 deferred --- no gating decisions remain)
  - [X] Add the new `TransactionRequest` variant type in `transact.ts`.
  - [X] Extend the batch-fetch step (`transact.ts:52-60`) to also cover this new kind's keys.
  - [X] Implement the Record-reduce-and-diff logic (changed-key path reuses `_optimisticUpdateFactory` directly; unchanged-key path is a new `_unchangedFieldConditions` helper, since `updateByReducer` provides no conditions on its `'ignore'` path).
  - [X] Wire the per-key `Update`/`ConditionCheck` outputs into the existing `.map(...).flat()` merge step (no `Delete` case --- OD-2 deferred; a reducer that removes a fetched key throws instead).
  - [X] Unit tests in a new `transact.multiKeyUpdate.test.ts`: unchanged-key -> `ConditionCheck`; changed-key -> `Update` with correct condition; multi-key mixed split (one changed, one unchanged); multi-key **both changed** (independent per-key `:New0`/`:Old0` indexing, no cross-key collision); new-record (`attribute_not_exists(DataCategory)`) path; whole-transaction rejection (no swallowing); reducer-removes-a-key throws. Confirmed no regression in existing `transact.test.ts`/`update.test.ts` suites (23 suites / 134 tests green package-wide).
  - [X] Created minimal `AGENT.contract.md`/`AGENT.implementation.md` for `packages/mtw-utilities/ts/dynamoDB/` (none existed); removed the OD-1 and OD-3 rows above (both shipped as normative contract text; OD-2 stays, marked Deferred, until a future slice picks it up).
- [X] Slice 2: generalized before/after cascade (OD-4 decided --- no gating decisions remain)
  - [X] Extracted `_transactionRequestItemToTransactWriteItems` from `transactWrite`'s inline `.map(...)` body --- pure refactor, verified behavior-neutral (existing suites green with zero test changes) before any cascade code was added.
  - [X] Added the `cascade` callback field to `MultiKeyUpdate`'s props.
  - [X] Implemented: cascade runs unconditionally after the reducer (even on a no-op), receiving `(prior, next)` where `next` is the reducer's actual output; returns arbitrary `TransactionRequest[]`, converted recursively via `_transactionRequestItemToTransactWriteItems` and merged into the same transaction alongside Slice 1's own generated items. Guards: a cascade-returned `Update` without `priorFetch` throws; a cascade-returned `MultiKeyUpdate` throws (no second fetch round --- confirmed with the user, 2026-07-14).
  - [X] Unit tests (synthetic, no ephemera-specific shapes) in a new `describe('cascade', ...)` block: cascade fires with correct prior/next (`next` matching the reducer's real output); cascade output (`Put` + `ConditionCheck`) rides in the same atomic transaction alongside per-key items; a no-op reducer still invokes the cascade; whole-transaction rejection propagates including cascade items; both guards (`Update` without `priorFetch`, nested `MultiKeyUpdate`) throw with clear messages. Confirmed no regression in existing suites (23 suites / 140 tests green package-wide).
  - [X] Updated `AGENT.contract.md`/`AGENT.implementation.md` with the cascade's normative shape and code-map entry; removed the OD-4 row above once shipped.
- [X] Full package regression: `cd packages/mtw-utilities && npm run test` (all suites green, not just the new ones) --- 23 suites, 140 tests, all passing (2026-07-14).
- [X] Hand off to the ephemera plan: added a pointer in [`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`](../../../lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) noting `MultiKeyUpdate` (including its `cascade`) has shipped and is available for the sandbox-rerun-as-reducer slice; did **not** start that ephemera-side slice from this document.
- [ ] Archive/delete this plan per [taskPlanning/AGENT.md](../../../AGENT.md#when-the-task-finishes) once durable docs have absorbed the lasting content --- both slices are now done, so this plan is a candidate for archival; **flagged for the user to confirm**, not deleted unilaterally.

## Progress

| Slice | Status |
| --- | --- |
| Slice 1: core `MultiKeyUpdate` (OD-2 deferred; OD-1/OD-3 shipped and removed) | Done (2026-07-14) |
| Slice 2: generalized before/after cascade (OD-4 shipped and removed) | Done (2026-07-14) |
| Full package regression | Done (2026-07-14) --- 23 suites / 140 tests |
| Ephemera-plan handoff pointer | Done (2026-07-14) --- see the Slice 3 pointer added to the ephemera migration plan |

## Verification

```bash
cd packages/mtw-utilities && npm run test
```

Run the full package suite (not a narrowed `--testPathPattern`) after each slice, since `transact.ts`/`update.ts` are shared mixins consumed by every DB handler in the package --- a regression here is invisible to a scoped run. No `npm run build` (standing preference, matches the ephemera plan's convention).
