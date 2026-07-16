# `MultiKeyUpdate` `priorFetch` support

**Status:** Not started. Recorded 2026-07-16, split out from BD-15/16 (`taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`) once it became clear this is a separate, non-gating initiative with its own open questions --- see [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

`transactWrite`'s `MultiKeyUpdate` request kind (`packages/mtw-utilities/ts/dynamoDB/mixins/transact.ts`) always fetches every key in `Keys` itself, batched via one `getItems` call, before running its reducer. This is deliberate and correct --- it's what makes a `MultiKeyUpdate` reducer's re-derived legality check trustworthy (see `applyObjectSetTransfer.ts`/`applyHostRelationalPatch.ts` in `lambda/ephemera`, both built 2026-07-15 specifically to replace an earlier fetch-then-simulate-then-blindly-write design).

In practice, though, many `MultiKeyUpdate` callers in `lambda/ephemera` will have **already fetched the same graph/record moments earlier in the same request** (e.g. the object-manipulation compiler's Selection stage fetches a host's `positionGraph` to run legality checks before ever reaching persistence). `internalCache` (`lambda/ephemera/internalCache`) already memoizes exactly this kind of KR read within an invocation --- so a kernel that called `internalCache.Positions.getPositionGraph(hostId)` itself, and passed the result to `MultiKeyUpdate` as a seed, would very often get a free in-memory hit instead of `transactWrite`'s own redundant live fetch.

**Why this is safe, not a step backward:** `MultiKeyUpdate` (like plain `Update`) builds its `ConditionExpression` from whatever value seeded the reducer (`_optimisticUpdateFactory` / `updateByReducer`, `mixins/update.ts:39-109`) --- a full-value equality check on every field in `updateKeys` against the exact prior value used. That condition is evaluated by DynamoDB **against the live table row at commit time**, not against the caller's local copy. A stale seed (from a cache, or otherwise) can only cause the *proposed* write to fail its own condition and abort --- it can never cause a wrong write to silently succeed. This is a fundamentally different risk profile than the bug BD-15/16 slice 3 fixed (a reducer with **no** condition at all tying the write to what was read).

**Why this is a separate task plan, not folded into BD-15/16:**

- It's an optimization (latency/DDB read cost), not a correctness requirement --- nothing in BD-15/16 or any other in-flight work is blocked on it.
- It has its own open design questions (below) that deserve their own resolution pass, not a rushed decision inside an unrelated feature slice.

## Scope

**In scope:**

- Extend `TransactionRequestMultiKeyUpdate` (`transact.ts`) to accept **per-key** seed data (a partial `priorFetch` --- some keys seeded, others still needing `transactWrite`'s own fetch), mirroring the single-item `Update`'s `priorFetch` (`update.ts:174-177`) but granular across a `Keys` array.
- `transactWrite`'s `allKeysToFetch` computation (`transact.ts:316-327`) must skip any `MultiKeyUpdate` key that already has seed data supplied --- mirroring the existing exemption for plain `Update` items with `priorFetch` (`transact.ts:317`), which currently has **no equivalent** for `MultiKeyUpdate.Keys`.
- `_transactionRequestItemToTransactWriteItems`'s `MultiKeyUpdate` branch (`transact.ts:175-181`, building `priorRecord`) must consult the supplied per-key seed before falling back to `fetchedItems`, mirroring line 143's `item.Update.priorFetch || fetchedItems.find(...)`.
- A stated, enforced contract for **retry safety**: unlike `optimisticUpdate` (`update.ts:341-...`), which has its own internal retry loop and only consults `priorFetch` on the very first attempt (`!retries && priorFetch`, forcing a live `getItem` on every retry), `MultiKeyUpdate`/`transactWrite` has **no internal retry loop at all** --- retry is entirely the calling kernel's responsibility (e.g. `exponentialBackoffWrapper` wrapping the whole `transactWrite` call, as `applyObjectSetTransfer.ts`/`applyHostRelationalPatch.ts` already do). Whatever this feature ships must make it structurally obvious (types, docs, or an assertion) that a caller must **not** resupply the same seed on a retried attempt --- see Open Decisions.

**Out of scope (for now, flag as follow-on if pursued):**

- Actually wiring `applyObjectSetTransfer.ts` / `applyHostRelationalPatch.ts` (or any other `MultiKeyUpdate` consumer) to pass a seed via `internalCache` --- do that once the library-level feature exists and its retry contract is settled, as a small follow-up in the consuming lambda, not part of this package-level task.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| OD-1 | **Seed API shape** --- attach seed data directly on each `Keys` entry (e.g. `Keys: (DBHandlerKey<...> & { priorFetch?: T })[]`) vs. a separate parallel map (e.g. `priorFetch?: Record<string, T>` keyed by the same marshalled-key-string convention `_marshalledKeyString` already uses internally). The parallel-map shape avoids widening `DBHandlerKey` itself, but needs a caller-facing way to compute the same marshalled key --- possibly exporting `_marshalledKeyString` (currently private) or accepting plain `DBHandlerKey` objects as map keys with equality handled internally. | Everything below | Open |
| OD-2 | **Retry-safety enforcement** --- is "don't resupply a stale seed on retry" purely a documented caller contract (like `optimisticUpdate`'s comment-level convention today), or should the library make misuse harder --- e.g. accepting a `attempt`/`isFirstAttempt` flag, or an opaque token from the prior failed attempt that must be threaded through to prove the caller re-derived its seed. Given `MultiKeyUpdate` has no internal loop, the enforcement point (if any) lives in the *caller's* retry wrapper, not this library --- may end up being "document clearly + code review," not a type-level guarantee. | OD-1 | Open |
| OD-3 | **Partial-failure refetch strategy (raised as the motivating "clean" idea, not yet resolved)** --- when a `TransactWriteItemsCommand` fails because *some* (not all) transact items' condition checks failed, DynamoDB's `TransactionCanceledException` carries a `CancellationReasons` array (one entry per transact item, `Code: 'None' | 'ConditionalCheckFailed' | ...`) identifying exactly which ones. Two candidate approaches, not yet compared: **(a)** on a cancellation, inspect `CancellationReasons` and issue a **supplemental `getItems`/batch-get** for only the keys that actually failed, re-run the reducer with a mix of (still-valid seed data) + (freshly-fetched data), and retry --- avoids re-fetching keys that were never stale. **(b)** set `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'` on each `MultiKeyUpdate`-derived transact item, so DynamoDB returns the live conflicting value **directly in the same failed response**, with no supplemental round trip at all. (b) looks more efficient if `CancellationReasons[i].Item` reliably carries the full current item under that setting --- needs verifying against the AWS SDK's actual behavior for `TransactWriteItems`, not assumed. **Today, nothing in this codebase reads `CancellationReasons` at all** --- `exponentialBackoffWrapper` (`dynamoDB/index.ts:34-64`) only matches `err.errorType` against a `retryErrors` string list and blindly retries the *whole* closure (re-running `transactWrite` from scratch, ignoring nothing about *which* keys failed); building either (a) or (b) means teaching that retry path granular awareness for the first time. | OD-1, OD-2 | Open |
| OD-4 | **Does the granular-refetch feature (OD-3) belong in this same task, or its own follow-on?** Even *without* solving OD-3, plain per-key `priorFetch` (skip a known-fresh key's initial fetch, still let the whole transact fail/retry-from-scratch on any conflict) is a complete, independently valuable, much smaller feature. Recommend shipping OD-1/OD-2 first, decide whether OD-3 is worth its added complexity once real production latency/read-cost data justifies it. | N/A | Open |

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for task-plan conventions.
2. Read the current `MultiKeyUpdate` contract: [`dynamoDB/AGENT.contract.md`](../../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.contract.md) --- especially the "`MultiKeyUpdate`'s `cascade`" section, whose `priorFetch`-for-cascade-`Update`-items precedent (`transact.ts:227-236`) is the closest existing analog to what this task builds.
3. Read the code map: [`dynamoDB/AGENT.implementation.md`](../../../../../packages/mtw-utilities/ts/dynamoDB/AGENT.implementation.md).
4. Read `mixins/update.ts:166-205` (`UpdateExtendedProps`, including `priorFetch`'s doc comment) and `mixins/update.ts:341-370` (`optimisticUpdate`'s `!retries && priorFetch` retry loop) --- the precedent this task generalizes to `MultiKeyUpdate`.
5. Read `mixins/transact.ts:1-70` (types), `:111-244` (`_transactionRequestItemToTransactWriteItems`, especially the `MultiKeyUpdate` branch at `:175-244`), and `:316-...` (`transactWrite`'s batch-fetch computation).
6. Existing test coverage to extend: `mixins/transact.multiKeyUpdate.test.ts`, `mixins/update.test.ts` (for the `priorFetch` precedent's own test shape).
7. Real consumers this would eventually help (read for context, don't modify yet): `lambda/ephemera/dataSource/positions/manipulation/membership/applyObjectSetTransfer.ts`, `lambda/ephemera/dataSource/positions/manipulation/applyHostRelationalPatch.ts`.
8. Test runner: this package uses Jest directly (`packages/mtw-utilities/package.json`'s `test` script is `jest`, no custom wrapper). Run from the package directory:
   ```bash
   cd packages/mtw-utilities && npx jest ts/dynamoDB/mixins/transact.multiKeyUpdate.test.ts ts/dynamoDB/mixins/update.test.ts
   ```
9. Baseline before making changes: run the command in step 8 and confirm it passes clean.

## Recommended order

Use `[ ]` for pending and `[X]` for complete.

- [ ] **1. Resolve OD-1** (seed API shape) and **OD-2** (retry-safety contract) --- these gate everything else; small enough to decide together.
- [ ] **2. Extend `TransactionRequestMultiKeyUpdate`** with the chosen seed shape (OD-1).
- [ ] **3. `transactWrite`**: exclude seeded `MultiKeyUpdate` keys from `allKeysToFetch`, mirroring the existing plain-`Update` `priorFetch` exemption.
- [ ] **4. `_transactionRequestItemToTransactWriteItems`**: consult supplied seed data before `fetchedItems` lookup when building `priorRecord`.
- [ ] **5. Tests**: extend `transact.multiKeyUpdate.test.ts` --- all-seeded (zero fetch), partially-seeded (only unseeded keys fetched), stale-seed-fails-condition-and-does-not-corrupt (prove the safety argument in this doc's Purpose section empirically, not just by reasoning), retry-reuses-stale-seed-is-a-caller-bug (document/demonstrate per OD-2's resolution).
- [ ] **6. Decide OD-4**: ship OD-1--OD-3 together, or land the simple per-key seed feature now and open a follow-on plan for OD-3's granular-refetch-on-partial-failure once real usage data justifies the added complexity.
- [ ] **7. If OD-3 is in scope this round**: implement the chosen approach (supplemental batch-get from `CancellationReasons`, or `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`), teach `exponentialBackoffWrapper`'s callers (or a new wrapper) to use it instead of blindly retrying the whole closure.
- [ ] **8. Update durable docs**: `dynamoDB/AGENT.contract.md` (new `priorFetch` clause for `MultiKeyUpdate`, retiring the current "`MultiKeyUpdate` does not accept ... `priorFetch`" line), `dynamoDB/AGENT.implementation.md` (code map).
- [ ] **9. Follow-on (separate, smaller task, not required for this plan to be "done")**: wire `applyObjectSetTransfer.ts`/`applyHostRelationalPatch.ts` in `lambda/ephemera` to actually pass a seed via `internalCache.Positions.getPositionGraph`/`internalCache.Positions.get` (Character-hosted equivalent), respecting the retry contract from OD-2.

## Verification

- `cd packages/mtw-utilities && npx jest` (full package suite --- this touches shared transaction machinery, so the whole package's tests are the relevant regression backstop, not just the touched files).
- Once wired into `lambda/ephemera` (step 9): `cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/`, then the full `lambda/ephemera` suite.
