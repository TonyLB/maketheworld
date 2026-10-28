# Pure-name path (Identify without embeddings)

**Status:** Slices 1-2 shipped (utilities and full-pass orchestrator extracted; name-subsequence predicate and pure resolver, not yet called in production). Next: Slice 3 (pure-pass and cross-pass orchestrators).

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and the Recommended order checkbox conventions.

## Purpose

Identify embeds every object span it cannot match exactly (one Bedrock Titan call per trimmed span, concurrent since ISS8329). A span that is plainly a short form of a name still pays for it: `get cup` in a room holding a "red cup" embeds `cup` before it grounds, though the lexical channel alone already scores the pair 0.954 (well above `T_JOINT_ABS_UNARY`, 0.48).

Skipping the embed per span is not enough, for two reasons:

- **The embed scores every candidate, not only the matching one.** Dropping it for one span changes that span's whole pool.
- **Fills compete on `jointRelevance`.** A reading's confidence is the least `jointRelevance` among its keys ([`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts), `enumerateIdentityAssignments`). A lexical-only span beside an embed-blended one would put two fills on different scales. And since embeds are concurrent, latency drops only when **no** span embeds.

**Target:** the producer tries a **pure pass** first. It keeps only the fills whose every object span matches by name (PP-1), grounds them by the lexical channel alone, and runs them through the dry run and selection. If that pass ends in a `CommandAttempt` or a `Consult`, that is the result and nothing embeds. Otherwise the **full pass** runs exactly as today, embeddings included.

The policy this sets: **a literal name match that the world accepts beats a semantic one.** `get light` with a "light switch" and a "lamp" takes the light switch without embedding, where today the lamp is at least scored.

## Relationship to existing code

| What | Where | Change |
| --- | --- | --- |
| Producer | [`compileAttemptsFromSkeleton.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileAttemptsFromSkeleton.ts) `compileReadings` | Becomes the cross-pass orchestrator over two per-pass orchestrators and shared utilities (PP-4) |
| Identify over the skeleton | [`identifySkeletonSpans.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identifySkeletonSpans.ts), [`identityStage.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityStage.ts) | Take a **span resolver** function instead of calling `resolveCatalogSpanToPool` directly; return the span texts the resolver found ineligible beside the pools. No pass flag |
| Span to pool | [`resolveCatalogSpanToPool.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveCatalogSpanToPool.ts) | Split into pieces (catalog/exact match, embed-plus-lexical pool) composed into the **full resolver** (today's behavior); a **pure resolver** composes the exact match with a name-subsequence pool (PP-2) and never imports `internalCache` |
| Span forms | [`spanMatchForms.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/spanMatchForms.ts) | New word-subsequence predicate beside `spanMatchForms` (or a sibling file) |
| Lexical pool | [`embeddingMatch/buildSpanCandidatePool.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/buildSpanCandidatePool.ts) | Unchanged; the pure pass calls it with no `spanEmbedding` over the matching candidates only |
| Exact-fill precedence | `compileReadings` (the temporary bridge) | Unchanged, applies within each pass (PP-5) |
| Environment reads | `buildAttemptEnvironment` via `defaultPositionsReads` | Unchanged: reads go through `internalCache.Positions`, so the full pass's rebuild after a pure pass is memo hits (PP-4) |

## Getting started

1. **Durability framework** --- [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Testing (command authority)** --- [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Run from `lambda/ephemera/`, with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient: `*.integration.test.ts` sit outside `tsconfig`.
3. **Baseline (must pass before edits)** --- from `lambda/ephemera/`: `npm run test -- --watchAll=false`
4. **Identify and the lexical channel** --- [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md), and [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) ("Compile").
5. **Rules this must keep** --- [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md) "Qualifier": "Every fill is a reading", "Exact-fill precedence is a temporary bridge", "Surplus another reading could explain".
6. **Test seam** --- tests module-mock `internalCache` and assert on `SpanEmbeddings.get` calls (the house pattern; see the spanEmbeddings migration in `compileAttemptsFromSkeleton.*.test.ts`).

## Decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the slices below. Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| PP-1 | **Name match = ordered word subsequence, gaps allowed.** The span's words, after peeling a leading article and normalizing (`normalizeShortNameForEmbedding(peelLeadingArticleWhenTail(span))`, the `SpanEmbeddings` key form), appear among the name's words (`normalizedShortName`) **in the same order**, not necessarily adjacent: `cup`, `red cup` and `big cup` all match "big red cup"; `cup red` does not match "red cup"; `cup` does not match "cupboard" or "teacup" (whole words only). The normalized span must be **at least 3 characters**. An exact match is the case where the subsequence is the whole name. | 2 | Decided (user, 2026-10-27) |
| PP-2 | **Pure pool = the matching candidates, scored lexically.** Exact matches short-circuit as today (`'exact'` pools). Otherwise the pool is `buildSpanCandidatePool(matchSpan, matching, { structure })` with no `spanEmbedding`, over only the candidates PP-1 matches: lexical-only scores, so every pure fill is on one scale. A span no candidate matches (or under 3 characters) is **ineligible**, and a fill holding an ineligible object span is not in the pure pass. Exit spans (`exitSpanPool`, exact) are always eligible. If no fill is fully eligible, the pure pass is skipped. | 2, 3 | Decided |
| PP-3 | **The pure pass succeeds on `CommandAttempt` or `Consult`.** Either means at least one reading passed the dry run. A Consult among pure candidates (`get cup` with a red cup and a blue cup, lexical 0.954 vs 0.954) is accepted: embeddings would not separate them, and a semantic-only candidate ("mug") is not offered. `Abstain` or `Error` falls through to the full pass, so an illegal pure reading ("The table has no cup.") now costs the embeds it skipped; the full pass still answers it as today. | 3 | Decided |
| PP-4 | **Utilities, per-pass orchestrators, one cross-pass orchestrator** (user, 2026-10-27). **Utilities** know nothing of passes: Identify takes a span resolver (`(span, catalog, structure?) => Promise<pool \| error \| ineligible>`); the two resolvers are composed from `resolveCatalogSpanToPool`'s pieces, so the pure one cannot embed by construction; exact-fill precedence, post-Identify refusals, and propose -> environment -> dry run -> select -> result are shared as they are identical in both passes. **Per-pass orchestrators** each own a refusals list: the **full pass** is Identify with the full resolver, then the shared steps (today's behavior); the **pure pass** is Identify with the pure resolver, dropping every survivor whose fill holds an ineligible key, then the shared steps, reporting success per PP-3. The **cross-pass orchestrator** (`compileReadings`) runs the once-only steps (attempt refusals, room-graph read, catalog merge), chooses the starting pass (PP-6), falls through, and keeps only the refusals of the pass whose result it returns, so a discarded pure pass's refusals cannot surface through `compileAttemptsFromSkeleton`'s "first Error refusal over an Abstain". No new environment cache: `buildAttemptEnvironment` reads through `internalCache.Positions`. | 1, 3 | Decided |
| PP-5 | **Exact-fill precedence stays as is, in both passes.** It reads `'exact'` source tags, which pure pools keep. Retiring or replacing it remains rung 14 item (3) ([ladder](AGENT.objectManipulationIterations.planning.md)). | 3 | Decided |
| PP-6 | **A Consult records its pass; a resume starts there.** The Consult result carries `pass: 'pure' \| 'full'`, stored on the persistent-command payload **beside `root`, not inside it** ([`persistentCommand/payload.ts`](../../../../../lambda/ephemera/dataSource/actions/persistentCommand/payload.ts): `root` is Plan's frozen output, and the pass is the producer's). A resume ([`persistentCommand/resume.ts`](../../../../../lambda/ephemera/dataSource/actions/persistentCommand/resume.ts)) hands it to `compileAttemptsFromSkeleton`, which starts at that pass: `full` runs the full pass only, so a resume sees the pools that built its Consult (which may name an embedding-only candidate); `pure` runs the pure pass and, if the world has changed so it no longer succeeds, falls through to the full pass as a first run does. A payload without the field resumes as `full`. (user, 2026-10-27) | 3 | Decided |

## Progress

| Slice | State |
| --- | --- |
| 1. Utilities + full-pass orchestrator extracted (no behavior change) | Shipped (full suite green) |
| 2. Name-subsequence predicate + pure resolver | Shipped (full suite green) |
| 3. Pure-pass and cross-pass orchestrators, recorded pass, payoff test | |
| 4. Durable docs; plan deleted | |

## Recommended order

Mark pending items `[ ]` and completed items `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 1 --- utilities and the full-pass orchestrator.**
    - [X] Split `resolveCatalogSpanToPool` into its pieces (`resolveExactSpan`; `buildEmbeddedLexicalPool`, in `embeddedLexicalPool.ts`, the only module that imports `internalCache`) and recompose them as the **full resolver**, keeping the exported name and behavior. `SpanResolver` and the `ineligible` result variant live in `resolveCatalogSpanToPool.ts`.
    - [X] `runIdentityStage` / `runIdentityStageOverSkeleton` / `runIdentityStageOverReferenceKeys` take the resolver as an optional trailing parameter (default: the full resolver) and return ineligible beside the pools (always empty under the full resolver): `runIdentityStage` the span **texts**, the skeleton-keyed functions the **stableRefKeys** (the pure pass drops fills by key), with ineligible keys absent from the `spanPools` map.
    - [X] In `compileAttemptsFromSkeleton.ts`, extract the shared steps after Identify (exact-fill precedence, post-Identify refusals, and propose -> environment -> dry run -> select -> result) as utilities, and the **full-pass orchestrator** over them with its own refusals list (PP-4). `compileReadings` keeps the once-only steps and calls the full pass.
    - [X] Tests: one existing `identityStage.test.ts` expectation gained `ineligible: []`; two new tests cover a custom resolver declining a span. The rest of the suite passes unchanged.
- [X] **Slice 2 --- the pure resolver.**
    - [X] Word-subsequence predicate (PP-1), `spanIsNameSubsequence` in `spanMatchForms.ts`, with unit tests: `cup` / `red cup` / `big cup` vs "big red cup" match; `cup red` vs "red cup", `cup` vs "cupboard" / "teacup", `up` vs "cup up" (under 3 characters) do not; `the cup` matches "red cup" (article peeled). A bare article (`the`, `some`) never matches, even against a name that contains it.
    - [X] **Pure resolver** (`resolvePureSpanToPool.ts`): the catalog/exact piece as today, else the PP-2 pool, else `ineligible`. To make "never imports `internalCache`" structural, `resolveExactSpan`, `SpanResolver` and the result type moved to `resolveExactSpan.ts` (re-exported from `resolveCatalogSpanToPool.ts`, so importers are unchanged); the pure test module-mocks `internalCache` to throw on import.
    - [X] Unit tests through Identify with the pure resolver: an exact span, a subsequence span (lexical-only pool over the matching candidates only), and an ineligible span.
- [ ] **Slice 3 --- pure-pass and cross-pass orchestrators.**
    - [ ] **Pure-pass orchestrator**: Identify with the pure resolver; drop every survivor whose fill holds an ineligible key; with none left, report failure without running the shared steps; else run them with its own refusals list and report success on `CommandAttempt` or `Consult` (PP-3).
    - [ ] **Cross-pass orchestrator** (`compileReadings`): after the once-only steps, run the pure pass unless the starting pass is `full` (PP-6); on success return its result; otherwise run the full pass on **all** survivors. Only the returned pass's refusals reach `compileAttemptsFromSkeleton` (PP-4).
    - [ ] Record the pass (PP-6): the producer's `Consult` carries `pass`; the persistent-command payload stores it beside `root` (type, guard in `payload.ts`, the write path); `resume.ts` passes it back as the starting pass, absent meaning `full`.
    - [ ] **Payoff test** (`compileAttemptsFromSkeleton.purePass.test.ts`; terminates at the observable: the result and the Bedrock calls), with `internalCache` module-mocked and `SpanEmbeddings.get` a `jest.fn`:
        - [ ] `get cup` with a "red cup": `CommandAttempt` taking the red cup, `get` not called.
        - [ ] `get cup` with a "red cup" and a "blue cup": `Consult` between them, `get` not called.
        - [ ] `get light` with a "light switch" and a "lamp": takes the light switch, `get` not called (records the PP policy).
        - [ ] `get cup red` with a "red cup", and `get mug` with a "red cup": `get` called (full pass), results as today.
        - [ ] A pure reading the dry run refuses (`take cup from table`, the table holding no cup): `get` called, same `Error` as today.
        - [ ] Resume (PP-6): answering the two-cups Consult (`pass: 'pure'`) resolves with `get` not called; a resume with `pass: 'full'`, or with no pass, calls `get`; a `pure` resume whose world changed so the pure pass no longer succeeds falls through and calls `get`.
    - [ ] Re-run `skeletonMatcher.characterization.test.ts` and `phraseCoveragePayoff.integration.test.ts`. Any changed outcome is reviewed case by case against the PP policy, not re-baselined wholesale; list each change in the PR.
- [ ] **Slice 4 --- durable docs, then delete this plan.**
    - [ ] [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md) "Qualifier": a rule for the pure pass (PP-1's match, PP-3's success, the literal-beats-semantic policy, PP-6), placed by "Exact-fill precedence".
    - [ ] [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) "Compile": the cross-pass orchestrator, the two passes, and the span-resolver seam in Identify.
    - [ ] [`embeddingMatch/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/AGENT.md): a line that pure pools are lexical-only.
    - [ ] Grep for inbound links to this file (`grep -rn "pureNamePath.planning" .`), then delete it.

## Not in scope

- **Retiring exact-fill precedence.** The pure pass gates on the dry run, which the bridge does not, so it may make the bridge redundant; that call stays with rung 14 item (3).
- **Rung 14's Consult floor** (what counts as near-exact for a Consult). A pure-pass Consult is a near-exact one by construction, consistent with rung 14's recommendation, but its calibration is rung 14's.
- **Pure-passing part of a command** (grounding eligible spans lexically while embedding the rest). Rejected: mixed scales across fills, and no latency gain while any span embeds.

## Verification

From `lambda/ephemera/`:

```sh
# Slices 2-3
npm run test dataSource/actions/enrich/objectManipulation
npm run test dataSource/actions/parseCommand.test.ts
# Every slice, before calling it done (integration tests are outside tsconfig)
npm run test -- --watchAll=false
```
