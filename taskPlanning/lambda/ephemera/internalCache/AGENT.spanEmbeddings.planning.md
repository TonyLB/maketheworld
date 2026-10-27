# Span embeddings cache (`internalCache.SpanEmbeddings`)

**Status:** Slice 1 shipped (handler, wired into `InternalCache`; nothing calls it yet). Next: Slice 2 (route Identify through it).

Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and the Recommended order checkbox conventions.

## Purpose

Identify embeds each object span it cannot match exactly (one Bedrock Titan v2 call per span). Today:

- **Embeds run one at a time.** [`runIdentityStage`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) `await`s [`resolveCatalogSpanToPool`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveCatalogSpanToPool.ts) per span in a `for` loop. A command whose fills segment into several distinct spans ("put cup from table on shelf" yields `cup`, `cup from table`, `table`, `table on shelf`, `shelf`, ...) pays one Bedrock round trip per span, in series.
- **The memo lives for one Identify call, not one invocation.** [`spanEmbedCache`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/spanEmbedCache.ts) is a `Map<string, EmbedObjectSpanResult>` created inside `runIdentityStage` (nothing above it passes one in), so it dedupes only within that call.
- **The memo stores results, not promises.** Two concurrent requests for the same span would both miss and both call Bedrock, so the current memo cannot simply be shared by parallel callers.
- **The key and the request text are decided in two places.** `resolveCatalogSpanToPool` peels the leading article (`peelLeadingArticleWhenTail`) before calling `getOrEmbedSpan`; `getOrEmbedSpan` keys on `normalizeShortNameForEmbedding`; `embedObjectSpan` normalizes again to build the request. They agree today only because every production caller peels first.

**Target:** a per-invocation `internalCache.SpanEmbeddings` handler keyed by the **trimmed span** --- `normalizeShortNameForEmbedding(peelLeadingArticleWhenTail(span))`, so `cup`, `the cup` and `  The  Cup ` are one key, one Bedrock request (whose input text is the key), one result. It memoizes the **promise**, so concurrent requests share one in-flight call, and Identify starts every span's embed before awaiting any of them.

## Relationship to existing code

| What | Where | Change |
| --- | --- | --- |
| Span memo | [`embeddingMatch/spanEmbedCache.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/spanEmbedCache.ts) | Replaced by the handler; file deleted |
| Span embed primitive | [`objects/embedding/embedObjectSpan.ts`](../../../../lambda/ephemera/dataSource/objects/embedding/embedObjectSpan.ts) (+ test) | **Moves** to `internalCache/spanEmbeddings/embedObjectSpan.ts` with its result types; it becomes the handler's default embedder and has no other production caller |
| Shared Titan core | [`objects/embedding/embedNormalizedSemanticText.ts`](../../../../lambda/ephemera/dataSource/objects/embedding/embedNormalizedSemanticText.ts) | Unchanged; stays with objects (spawn-time `buildShortNameSemanticEmbedding` and calibration also use it) |
| Key forms | [`spanMatchForms.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanMatchForms.ts) (`peelLeadingArticleWhenTail`), [`impromptuEmbeddingNeedsRefresh.ts`](../../../../lambda/ephemera/dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh.ts) (`normalizeShortNameForEmbedding`) | Composed into the handler's key function |
| Identify | [`identityStage.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts), [`resolveCatalogSpanToPool.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveCatalogSpanToPool.ts) | Read through the handler; loop becomes concurrent |
| v1 calibration shim | [`resolveObjectSpanByEmbedding.ts`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/resolveObjectSpanByEmbedding.ts) | Reads through the handler (now also article-peeled; calibration only) |
| Cache singleton | [`internalCache/index.ts`](../../../../lambda/ephemera/internalCache/index.ts) | New member; reset in `clear()` (called per invocation in [`app.ts`](../../../../lambda/ephemera/app.ts)) |
| Catalog-side vectors | `internalCache.ObjectEmbedding` (DB rows) | **Not** in scope --- those are stored, not Bedrock calls at parse time |

## Getting started

1. **Durability framework** --- [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Testing (command authority)** --- [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Run from `lambda/ephemera/`, with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient: `*.integration.test.ts` sit outside `tsconfig`.
3. **Baseline (must pass before edits)** --- from `lambda/ephemera/`: `npm run test -- --watchAll=false`
4. **Internal cache conventions** --- [`internalCache/AGENT.md`](../../../../lambda/ephemera/internalCache/AGENT.md) (**Common Cache Handler Patterns**), and the `DeferredCache` source itself: [`deferredCache.ts`](../../../../packages/mtw-lambda-patterns/ts/internalCache/deferredCache.ts) (`generalAdd` for the in-flight share and the rejection path SE-3 guards against).
5. **Identify pipeline** --- [`embeddingMatch/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md) and [`actions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) ("Identify").

## Decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the slices below. Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SE-1 | **Storage: `DeferredCache<EmbedObjectSpanResult>`, standard handler shape.** Its core property is the one this plan needs: a second request for a key whose fetch is still in flight awaits that same fetch, so concurrent spans that share a key make one Bedrock call. `get(span)` follows the house pattern (`isCached` -> `add` with a single-key `promiseFactory` -> `_Cache.get`); `add` invokes the factory synchronously, so call-initiation order follows request order. Wired into both `InternalCache.clear()` and `flush()`. No `_Store` mirror unless a synchronous reader appears. | 1 | Decided |
| SE-2 | **Key = request text.** The handler owns the span form: `spanEmbeddingKey(span) = normalizeShortNameForEmbedding(peelLeadingArticleWhenTail(span))`, and the embedder is called with that key. Callers stop peeling before the call. A span that normalizes to empty memoizes `{ success: false }` without Bedrock (`embedObjectSpan`'s existing abstain). | 1 | Decided |
| SE-3 | **The factory never rejects; failures are memoized for the invocation.** `DeferredCache` does not settle a key's `Deferred` when its `promiseFactory` rejects (the internal loop throws past the `set`/`reject` calls), so every awaiter of that key would hang. The factory therefore catches embedder throws and resolves `{ success: false }`, which Identify already treats as "no embedding channel". A `{ success: false }` result stays cached for the invocation (current behavior). | 1 | Decided |
| SE-4 | **Test seam: module-mock `internalCache`, and retire the `embedSpan` dependency.** Production calls `internalCache.SpanEmbeddings.get(span)` directly. `embedSpan` / `spanEmbedCache` are removed from `ParseCommandDeps` ([`baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)), `IdentityStageDeps`, `ResolveCatalogSpanToPoolDeps` and `ResolveObjectSpanByEmbeddingDeps`. The only production caller ([`actions/index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts) `parseCommand(..., { messageBus })`) never passes them, so they exist only for tests. Those tests switch to the house pattern: `jest.mock('<rel>/internalCache', () => ({ __esModule: true, default: { SpanEmbeddings: { get: jest.fn() } } }))`, with per-test `mockResolvedValue`, which ~60 ephemera test files already use; the `internalCacheOverride` style in `AGENT.testing.md` has 4 users. The handler's own unit test mocks the moved `./embedObjectSpan` module instead. | 2 | Decided |
| SE-5 | **No concurrency cap.** Spans per command are single digits to low tens; Titan's default on-demand quota is far above that. Revisit only if throttling shows up in logs. | 3 | Decided |
| SE-6 | **Error order is span order.** With concurrent resolution, `runIdentityStage` still returns the error of the **first span in input order** that errors (`Promise.all`, then scan results by index), not the first to settle. | 3 | Decided |

## Progress

| Slice | State |
| --- | --- |
| 1. `SpanEmbeddings` handler + `InternalCache` wiring | Shipped. Also split `normalizeExitName` into a leaf module (import cycle, see Slice 1 note). |
| 2. Identify reads through the handler; `spanEmbedCache.ts` deleted | |
| 3. Concurrent Identify + payoff test | |
| 4. Durable docs; plan deleted | |

## Recommended order

Mark pending items `[ ]` and completed items `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 1 --- the handler.**
    - [X] Move `dataSource/objects/embedding/embedObjectSpan.ts` and `embedObjectSpan.test.ts` to `internalCache/spanEmbeddings/` (`git mv`); repoint the type imports in [`actions/baseClasses.ts`](../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) and `resolveObjectSpanByEmbedding.ts`, and the default import in `spanEmbedCache.ts` (deleted in Slice 2).
    - [X] Add `internalCache/spanEmbeddings/index.ts`: exported `spanEmbeddingKey`, class `SpanEmbeddingsCache` over a `DeferredCache` with `get(span): Promise<EmbedObjectSpanResult>`, `flush()` and `clear()` (SE-1--SE-3).
    - [X] Wire `SpanEmbeddings` onto `InternalCache`, into `clear()` and `flush()`.
    - [X] Unit tests (`spanEmbeddings/index.test.ts`): `cup` / `the cup` / `  The  Cup ` -> one embedder call, called with `cup`; two concurrent `get`s before either resolves -> one call, both resolve to its result; `{ success: false }` memoized; a throwing embedder resolves `{ success: false }` for every concurrent awaiter (no hang); empty / article-only span (`the`) behaves as `peelLeadingArticleWhenTail` + `embedObjectSpan` do today; `clear()` forgets.
    - [X] Import cycle found and fixed at the source: `impromptuEmbeddingNeedsRefresh.ts` and `spanMatchForms.ts` imported `normalizeExitName` from `roomExitTargetsForCharacter.ts`, which imports `internalCache`, so any module loaded from the handler first re-entered `internalCache` half-built. `normalizeExitName` now lives in leaf `dataSource/actions/normalizeExitName.ts` (re-exported from `roomExitTargetsForCharacter`, so other importers are untouched). Keep the handler's imports free of `internalCache`.
- [ ] **Slice 2 --- route Identify through it.**
    - [ ] `resolveCatalogSpanToPool`: drop the peel before the embed call (the handler peels); keep the peeled `matchSpan` for `buildSpanCandidatePool` (lexical channel unchanged).
    - [ ] `resolveCatalogSpanToPool` and `resolveObjectSpanByEmbedding` call `internalCache.SpanEmbeddings.get` directly.
    - [ ] Remove `embedSpan` / `spanEmbedCache` from the four deps types and the pass-throughs in `parseCommand`, `compileAttemptsFromSkeleton`, `identifySkeletonSpans` and `identityStage` (SE-4). Drop the `identifySkeletonSpans` doc comment's "`embedSpan` sees the same calls in the same order" or restate it against `SpanEmbeddings.get`.
    - [ ] Delete `spanEmbedCache.ts`.
    - [ ] Migrate the tests that inject `embedSpan` to a module mock of `internalCache` (SE-4): `parseCommand.test.ts`, `identityStage.test.ts`, `identifySkeletonSpans.test.ts`, `resolveCatalogSpanToPool.test.ts`, `resolveObjectSpanByEmbedding.test.ts`, `compileAttemptsFromSkeleton.{fills,transfer,relational}.test.ts`, `skeletonMatcher.characterization.test.ts`, `phraseCoveragePayoff.integration.test.ts`. Most inject one constant result per test, so the change is mechanical. Two kinds of assertion change meaning:
        - [ ] Call arguments: `get` now receives the span **as given**, since the handler peels. `toHaveBeenCalledWith('brooms')` becomes the raw span.
        - [ ] Dedupe (`identityStage.test.ts` "1 call", the `resolveObjectSpanByEmbedding` cache tests): dedupe is now the handler's job, so these move into `spanEmbeddings/index.test.ts`. They are not rewritten against a mocked `get`, which cannot dedupe.
    - [ ] Tests that already mock `internalCache` and can reach Identify: `actions/index.test.ts` (automock: `get` returns `undefined`), `roomExitAmbiguousMatch.regression.test.ts` and `commitAttempt.test.ts` (factory mocks without `SpanEmbeddings`). Give each a `SpanEmbeddings.get` resolving `{ success: false }` if the suite shows it reaches a non-exact span.
- [ ] **Slice 3 --- concurrent Identify.**
    - [ ] `runIdentityStage`: map spans to `resolveCatalogSpanToPool(...)` promises, `Promise.all`, return the first error by input index (SE-6), else pools in input order.
    - [ ] **Payoff test** (terminates at the observable: Bedrock calls in flight). Through `compileAttemptsFromSkeleton`, or `parseCommand` if the fixture is cheap, with a multi-span command. The `internalCache` mock's `SpanEmbeddings` is a **real** `SpanEmbeddingsCache` (`jest.requireActual`), and its `./embedObjectSpan` module is mocked so each call's promise is held open. Assert that every distinct non-exact span's embed has **started** before any is released, that `cup` / `the cup` across fills make one call, and that releasing them gives the same result as the sequential baseline.
- [ ] **Slice 4 --- durable docs, then delete this plan.**
    - [ ] [`internalCache/AGENT.md`](../../../../lambda/ephemera/internalCache/AGENT.md): add `SpanEmbeddings` to the handler list and its key under **Cache Key Patterns** (`spanEmbeddingKey(span)`). Correct **DeferredCache Foundation**, which leads with batching: its first bullet should be in-flight sharing (a request for a key already being fetched awaits that fetch). Also record that a rejecting `promiseFactory` leaves its keys unsettled, so factories must resolve.
    - [ ] [`embeddingMatch/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md): replace the `spanEmbedCache` row with a pointer to the handler.
    - [ ] Repoint the moved primitive's links: [`llm/AGENT.md`](../../../../lambda/ephemera/llm/AGENT.md) ("Callers of `invokeBedrockTitanEmbed`": the caller is now the handler) and [`enrich/AGENT.md`](../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md) ("Span Bedrock embed").
    - [ ] [`actions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) "Identify": one line --- span embeds go through `internalCache.SpanEmbeddings`, concurrently, one per trimmed span per invocation.
    - [ ] [`actions/AGENT.contract.md`](../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md): a falsifiable rule if one is wanted --- "Identify makes at most one Bedrock embed per trimmed span per invocation; spans that differ only by a leading article or case share it."
    - [ ] Grep for inbound links to this file (`grep -rn "spanEmbeddings.planning" .`), then delete it.

## Not in scope

- **Prefetching span embeds before Identify** (e.g. concurrently with the room-graph read in `compileAttemptsFromSkeleton`). Saves another round trip, but spans of fills later filtered out --- and spans that would match exactly --- would be embedded for nothing. Worth measuring once Slice 3 lands; not part of this plan.
- **Persisting span embeddings across invocations** (Dynamo or Lambda-container memo). The key function makes it possible later; nothing here commits to it.

## Verification

From `lambda/ephemera/`:

```sh
# Slice 1
npm run test internalCache/spanEmbeddings
# After Slice 1: nothing still points at the primitive's old home
grep -rn "objects/embedding/embedObjectSpan" --include='*.ts' --include='*.md' .
# Slices 2-3
npm run test dataSource/actions/enrich/objectManipulation
npm run test dataSource/actions/parseCommand.test.ts
# Every slice, before calling it done (integration tests are outside tsconfig)
npm run test -- --watchAll=false
# After Slice 2: no remaining references to the retired memo
grep -rn "spanEmbedCache\|getOrEmbedSpan\|createSpanEmbedCache" --include='*.ts' --include='*.md' .
# After Slice 2: the embedSpan dependency is gone (calibration's unrelated embedSpanNormalized excepted)
grep -rnw "embedSpan" --include='*.ts' .
```
