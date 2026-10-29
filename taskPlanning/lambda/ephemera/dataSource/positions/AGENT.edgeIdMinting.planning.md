# Minting an `edgeId` within one graph

**Status:** opened 2026-10-28. Slice 1 built 2026-10-29 (`assignEdgeId` method and step, EM-2 alias matching). Slice 2 built 2026-10-29 (round-trip payoff). **Next step: Slice 3** (durable docs, delete this plan). An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

Give one stored relational edge in one graph a fresh `edgeId` when something needs to reference it, and do nothing else. **Most edges never get one** ([EA-8](AGENT.edgeAbstractions.planning.md#settled-register): identity is optional, per edge). The first consumer is `SecuredTo` v1 ([`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)), whose `Justifies` edges name a support and a secured edge by `edgeId`.

This is **CE2-local**, split on 2026-10-28 from [CE2](AGENT.abstractionLayers.planning.md#recommended-order) in the abstraction-layers plan. CE2 as specified creates an Edge record and a reverse index along with the id. This plan creates **neither**, so it is not P8's entity half and does not wait on electing P8 iteration 2. The record half, and its backfill of ids minted here, stay in CE2. See [Reopened in part](AGENT.edgeAbstractions.planning.md#reopened-in-part-support-between-edges-2026-10-28) for why.

**Payoff, stated at the observable output:** after an `assignEdgeId` step commits, the edge carries its id in the stored row, in the room's `ludicCache`, and on the wire graph. A later dissolve that names the edge only by structure still removes it, id and all.

## What exists today (checked 2026-10-28)

- `edgeId?: string` exists on `EphemeraLudicRelationalEdgeBase` ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) and on `HostRelationalEdgeBase` ([`ludicGraph/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts)). It survives the stored round trip, `removeRelationalEdge`'s re-serialisation, and the wire projection. **Nothing mints one.**
- `edgesMatch` ignores `edgeId` and vetoes on `chainId` (CE1). `addRelationalEdge` dedupes structurally, so **re-adding an edge with an id is a no-op**: there is no way today to put an id on an edge that is already stored. Both facts are pinned by the EA-8 tests in [`ludicGraph/index.test.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.test.ts) (`optional edge identity (EA-8)`).
- The cache's `mergeReducer` refuses to merge legs whose `edgeId` differs (Slice 3f). Only multi-leg chains reach that check, and this plan never writes one.
- **Template: `setHostingKind`**, the most recent single-host step that rewrites part of a graph in place. Its sites: the type and `mutationKernelStepKinds` record and `isKernelMutationStep` in [`kernelStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts); the apply in [`applyStepSequenceCore.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts); the footprint in [`computeStepSequenceFootprint.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/computeStepSequenceFootprint.ts) (**the footprint's step-kind test is a hand-written `||` chain at line 85, `addCrossingPort || removeCrossingPort || setHostingKind`; the compiler does not force a new kind into it, and a kind left out falls through to the relational-leg code that reads `step.subjectId`**); no fact in [`factsForStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/factsForStep.ts); a case in [`invalidationCompleteness.integration.test.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/invalidationCompleteness.integration.test.ts), which the step-kinds record forces at compile time.

## Design

- **A graph method and a kernel step.** `EphemeraLudicGraph.assignEdgeId(edge, edgeId)` finds the stored edge that `edgesMatch`es `edge` and returns the graph with that edge carrying `edgeId`, keeping its position in the edge list. The step is `assignEdgeId { hostId, edge, edgeId }`, applied the way `setHostingKind` is. One host, so the footprint is `hostId`.
- **The caller mints the uuid**, as `addPresenceBinding` carries `presenceUuid`. A later step in the same sequence (the `Justifies` that needs the id) can then name the id before the commit.
- **Single legs only.** An edge carrying a `chainId` is refused with a throw: putting an id on every leg of a chain is CE2's job, with the record. A programming error, not a stale read.
- **No published fact.** An id is not a change to what relates to what; `factsForStep` returns `[]`, as for `setHostingKind`.
- **`edgesMatch` stays blind to `edgeId`.** The EA-8 pinning tests pass unaltered. That is a done-when, not a hope: this plan adds the first minting constructor, and the pinning tests' own comment once predicted that would force the id-versus-structure question. It does not, because a single graph cannot hold two structurally identical edges.
- **No strip.** When an id'd edge is dissolved, its id goes with it. Removing an id from a surviving edge has no consumer; it stays with CE3.
- **No op-vocabulary entry and no producer here.** `SecuredTo` v1 decides how its producer emits the step. This plan is tested at the kernel and integration level.

## Relationship to other plans

- **[`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)** is the first consumer and waits on this plan. The edge-terminal arm and the `Justifies` kind are its own slices.
- **[CE2/CE2a](AGENT.abstractionLayers.planning.md#recommended-order)** owns the Edge record and the reverse index, still gated on electing P8 iteration 2. When it is built, it backfills records for ids minted here.
- **[Reopened in part](AGENT.edgeAbstractions.planning.md#reopened-in-part-support-between-edges-2026-10-28)** in the edge-abstractions plan records what this licenses and the capable version it leads to.

## Getting Started

1. **Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4 (legs, chains and ports, for why multi-leg chains are excluded).
3. **Edge identity as it stands:** the `edgeId`/`chainId` comment on `EphemeraLudicRelationalEdgeBase` in [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), and `edgesMatch`'s comment in [`ludicGraph/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts).
4. **The step family:** [`kernelStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts), reading `setHostingKind` as the template.
5. **Immer trap:** the `MultiKeyUpdate` reducers run under `produce()`; anything retained past the reducer's return must be a plain copy.
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Interfaces: `npm --prefix packages/mtw-interfaces run test`.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the interfaces suite. As of 2026-10-28: ephemera 4000, interfaces 775.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | Done 2026-10-28 (EM-1, EM-2 decided) |
| 1. Graph method and kernel step | Done 2026-10-29 (EM-1, EM-2 shipped; their rules go to the durable docs in Slice 3) |
| 2. Round-trip payoff | Done 2026-10-29 (id reaches stored row, cache and wire graph; structural dissolve removes it; no source fix needed) |
| 3. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0. Inventory, no code.**
    - [X] Confirm the `setHostingKind` site list above is complete (grep `'setHostingKind'` across `lambda/ephemera` and `packages`), and note any site that lists step kinds by hand.
    - [X] (one reader found: `customEdgeChallengeId`, now EM-2) Confirm nothing outside the cache's `mergeReducer` reads `edgeId` in a way a single-graph id could disturb (`grep -rn "edgeId" --include='*.ts' lambda/ephemera/dataSource packages/mtw-interfaces/ts packages/mtw-gateways/ts`).
    - [X] Settle EM-1 with the user (2026-10-28: `stale`, reason codes `edgeMissing` / `edgeIdConflict`).
- [X] **Slice 1. Graph method and kernel step.**
    - [X] `EphemeraLudicGraph.assignEdgeId`, with unit tests: assigns in place; same id is a no-op; missing edge and differing id per EM-1; a `chainId` leg throws.
    - [X] `assignEdgeId` in `MutationKernelStep`, `mutationKernelStepKinds`, `isKernelMutationStep`; the apply, footprint and `factsForStep` sites.
    - [X] Add `assignEdgeId` to the footprint's hand-written `||` chain (`computeStepSequenceFootprint.ts:85`).
    - [X] The `invalidationCompleteness` case.
    - [X] **EM-2 alias matching** (sweep done 2026-10-28; sites below). Export the structural half of `customEdgeChallengeId` as its own helper. `applyChallengeAnswers` computes a `CustomEdgeChallenge`'s alias at match time from `challenge.edge` and the primary action id (`primaryActionIdOf`), so the challenge class gains no field. It ([`resumeAnswers.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resumeAnswers.ts)) resolves each stored key to a live challenge's canonical id once, up front, so `recordVerdict`, the owner lookup and the `askedAs` filter all keep working on exact ids. Unit tests: structural answer + id-bearing edge matches; id answer matches; id-less edge unchanged; unknown key still ignored; both forms present for one challenge (canonical wins).
        - **The alias is run-local; the answer key is persistent.** Checked 2026-10-28: the persisted `root` holds Plan's attempts, and each resume re-expands boundary challenges fresh (`expandAndAdjudicateCandidates`, then `applyChallengeAnswers`, in `compileAttemptsFromSkeleton.ts`). The only cross-run identifier is the `challengeAnswers` key. The alias is read once per run, before any verdict, so it needs no field, no `withVerdict` threading and no `toJSON`. Judged challenges *are* serialized afterwards, in the `ludicNetworkChangeRequested` event to `commitAttempt`, which does no answer matching; keeping the alias out of `ChallengeData` keeps it out of that wire shape and `isChallengeData`.
        - **No change needed, checked:** `recordVerdict` (`commandAttempt/index.ts:159`) and `adjudicate.ts:37` act on live challenges' canonical ids; `askedAs` is an opaque string re-added verbatim (its `ask:<challengeKey>` convention is documented in `persistentCommand/payload.ts`, not computed anywhere), so it stays self-consistent when the key was the old form.
        - **Finding, no production writer:** nothing outside tests and `testFixtures.ts` writes a `challengeAnswers` entry or an `askedAs` yet (`answer.ts`, `selectQuestion.ts` and `rowStore.ts` only pass the record through). Alias matching is therefore built ahead of its first writer; when that writer lands it should store the challenge's canonical `id`. Existing id assertions to keep green: `expandBoundaryChallenges.test.ts:133,149`, `persistentCommand/payoff.test.ts:49`.
    - [X] EA-8 pinning tests pass unaltered.
- [X] **Slice 2. Round-trip payoff.** One integration test through `commitStepSequence` (an `it` in `invalidationCompleteness.integration.test.ts`, to reuse its in-memory DynamoDB harness): assign an id to a stored `Custom` edge; read it back from the stored row, the room's `ludicCache`, and the wire projection; then dissolve it by structure alone and confirm it is gone.
- [ ] **Slice 3. Durable docs, then delete this plan.**
    - [ ] The `edgeId` comment in `ephemeraMeta.ts` (*no constructor mints one*) and `edgesMatch`'s comment.
    - [ ] `positions/AGENT.contract.md` (*Edge persist shape*): one id-bearing edge per graph, single legs only, ids caller-minted. Also the two shipped decisions: a missing edge or a different id is `stale` (`edgeMissing`, `edgeIdConflict`); a stored challenge answer under a Custom edge's structural key is matched to its id-keyed challenge by run-local alias (`applyChallengeAnswers`, `customEdgeStructuralChallengeId`), canonical id winning.
    - [ ] `positions/AGENT.implementation.md` and `ludicGraph/AGENT.md`: the step and the method.
    - [ ] Check `AGENT.concepts.md`'s port paragraph, which says every leg of a crossing *shares one `edgeId`*; that reads like `chainId` and may already be stale.
    - [ ] Update CE2's split note in the abstraction-layers plan to say CE2-local shipped. Grep inbound links to this file, then delete it.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`.
- After Slice 1: `grep -rn "'setHostingKind'" --include='*.ts' lambda/ephemera/dataSource | grep -v test` and check `assignEdgeId` appears at each matching dispatch site.
