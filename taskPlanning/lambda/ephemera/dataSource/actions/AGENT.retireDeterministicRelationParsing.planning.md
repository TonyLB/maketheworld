# Retire deterministic relation parsing

**Status:** Slice 1 shipped (working tree, not yet committed). RD-1 and RD-2 decided. Next: slice 2 (delete the relational templates); RD-2's pin lands there. Runs before [`AGENT.attemptNarration.planning.md`](../../AGENT.attemptNarration.planning.md)'s slice 2, which is scoped against what this plan leaves.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is an implementation plan: the direction was settled in conversation (2026-10-06), and what is left are forks inside slices.

## Why

Plan's relational template (`matchRelationalTemplate`) turns a closed verb list and a closed preposition list into relational edges. Peer relations do not have a closed vocabulary, so the template can only keep growing ad-hoc special cases:

- **It discards the meaning.** For a `Custom` relation the label is the *preposition*: `tie the rope to the pole` becomes `Custom: "to"`, and `tie`, the one word that says what the relation is, is thrown away.
- **`Under` and `Against` are the same mistake given types.** They exist so a closed phrase list (`under`, `beneath`, `leaning against`, ...) can map onto an enum. Their only other job is a fixed rule for what happens to the edge when one end moves (`CLOSED_RELATION_BEHAVIOR`). As `Custom` edges they would defer to the LLM adjudicator instead, which is the right owner for "what happens to a lamp under a table when the table moves".

So peer relations are **created only by the LLM Plan fallback** (plan-only / joint, [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md), build sequence step 4). That fallback does not exist yet: today a skeleton no template matches yields zero attempts, and `parseCommand` answers `Unimplemented`. **Relation commands go dark until the fallback lands; that is accepted (2026-10-06), pre-rollout.**

**What stays deterministic:**

- **Containment** (`put X in Y`, `put X on Y`). It is not a peer relation: it is a `transferMembership` with a `containment` flag, and its prepositions (in/into/inside, on/onto/on top of) are a genuinely closed set. It moves into its own template, reduced to exactly that.
- **Expansion's facilitating dissolves** (`take the rope` while it is lashed). They come from the graph (a boundary edge the move severs), not from parsing phrases. Peer edges already classify as `defer` there and become challenges for the adjudicator.
- The **`establishRelation` / `dissolveRelation` primitives and the `Custom` kind.** The LLM fallback and Expansion still produce them; only the deterministic *parsing* into them retires.

**No data migration.** No WML file uses `Under` or `Against`, and the dev instance's runtime graphs hold no `Under`/`Against` edges (both confirmed 2026-10-06).

## Scope

In: Plan-stage relational parsing (`matchRelationalTemplate`, the peer half of `normalizeRelationSpan`), the unwired intent-level relational `DeterministicTemplate` registry, and the `Under`/`Against` kinds across `mtw-interfaces`, `mtw-wml` and `lambda/ephemera`. Out: building the LLM Plan fallback (its own plan, above); relational *narration* ([`AGENT.attemptNarration.planning.md`](../../AGENT.attemptNarration.planning.md), which re-scopes against this plan).

## Getting Started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md), once.
2. Plan stage today: [`enrich/objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) (Plan section), [`plan/planSkeleton.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planSkeleton.ts), [`plan/matchRelationalTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchRelationalTemplate.ts), [`normalizeRelationSpan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/normalizeRelationSpan.ts).
3. Where `Under`/`Against` behave: [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) (`CLOSED_RELATION_BEHAVIOR`), `CLOSED_RELATION_KINDS` in [`mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), `LUDIC_EDGE_PEER_KINDS` in [`mtw-wml/.../dataTypes/ludicEdge.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge.ts).

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- `npm run test`, not `npm test`, from `lambda/ephemera`. If commands conflict, that file wins.

**Hazards:**

- `*.integration.test.ts` sit outside the ephemera tsconfig; run the full suite after any deletion, and grep module paths, not only symbols.
- `mtw-wml` and `mtw-interfaces` tests are not type-checked (ts-jest is transpile-only). Slice 3 deletes types those tests use; verify with a one-off `tsc` over the touched test files, not only a green run.

Baseline (should pass before edits, from `lambda/ephemera`):

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/deterministicTemplate/ \
  dataSource/positions/ludicGraph/expandValidate/
```

## Progress

| Slice | Subject | Status |
| --- | --- | --- |
| 1 | Containment gets its own template | Done |
| 2 | Delete the relational templates (Plan stage and intent-level registry) | Not started |
| 3 | Retire `Under` / `Against` | Not started |
| 4 | Durable docs; retire this plan | Not started |

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes.

- [X] **Slice 1. Containment gets its own template.** A new `plan/matchContainmentTemplate.ts`: `VERB OBJECTSPAN PREP OBJECTSPAN`, where VERB is only `put` / `place` (RD-1) and PREP is only in/into/inside or on/onto/on top of, building the same `transferMembership` + `containment` step the relational template builds today. `planSkeleton` calls it in the relational template's place, ahead of look and membership.
  - [X] Decide RD-1 (which verbs): `put` / `place`.
  - [X] Pin the narrowing: `take the coin in the box` plans as a membership take, and `tie the rope in the box` reaches the zero-attempt branch; neither plans a containment move.
  - [X] The containment phrase lists move out of `normalizeRelationSpan` into this template (or a containment-only helper), so nothing peer-shaped is left for them to share.
  - [X] Relational template answers `noMatch` for containment prepositions (via `matchContainmentPreposition`). Without this, `take X in Y` and `tie X in Y` would gain a peer attempt once the phrases left `normalizeRelationSpan`.
  - [X] Existing containment tests in `matchRelationalTemplate.test.ts` and `planSkeleton.test.ts` move over and pass with the same expectations. `objectContainmentInPayoff.integration.test.ts` stays green.
  - [X] Drop the `declined` / `PartOf` path: `normalizeRelationSpan` never returns `PartOf`, so it is unreachable today. `nestingRelational` had a reader in `actions/index.ts`'s switch; removed with it. `parseCommand.ts`'s two `declined` branches are gone too.
- [ ] **Slice 2. Delete the relational templates.**
  - [ ] Delete `plan/matchRelationalTemplate.ts` and its test, and the peer half of `normalizeRelationSpan` (the `Under`/`Against` phrase map and the `Custom`-from-preposition fallback). Delete `normalizeRelationSpan` entirely if slice 1 left it nothing. `objectManipulationErrorMessages.relationalNoTemplateMatch` (in `resolveObjectSpan.ts`) has no reader today; delete it here too.
  - [ ] Delete the intent-level registry `deterministicTemplate/relationalTemplates.ts` and its test; drop it from `deterministicTemplateRegistry` and fix the count in `index.test.ts`. It has zero production call sites (CPG-6 in [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md) was the plan to wire it, and retires with it).
  - [ ] Pin the dark path: `tie the rope to the pole`, `lean the lamp against the wall` and `put the lamp under the table` each reach `parseCommand`'s zero-attempt branch and answer `Unimplemented`, not an error and not a containment move.
  - [ ] Pin the routing change: `take the rope off the crate` now plans as a membership take (today the relational attempt is primary; `planSkeleton.test.ts`'s "keeps the relational attempt primary" case is rewritten, not deleted). Update `matchMembershipTemplate`'s doc comment, which says `take X off Y` is relational.
  - [X] Decide RD-2 (`take X out of Y` / `take X off Y` as an explicit containment dissolve): no; membership handles it.
- [ ] **Slice 3. Retire `Under` / `Against`.**
  - [ ] `mtw-interfaces`: remove `CLOSED_RELATION_KINDS`, `ClosedRelationKind`, `isClosedRelationKind`, and `Under`/`Against` from `HostRelationalEdgeKind`. Fix `ephemeraMeta.test.ts` cases that enumerate them (port-address and kind-acceptance tables).
  - [ ] `mtw-wml`: `LUDIC_EDGE_PEER_KINDS` becomes `['Custom']`; fix `ludicGraph.test.ts` fixtures; correct the `ludicEdge.ts` doc comment that lists the peer kinds.
  - [ ] `lambda/ephemera`: `classifyInteractionUnderTransfer` loses `CLOSED_RELATION_BEHAVIOR` (every peer edge is `Custom` -> `defer`); `expandSameHost.ts`'s `isPeerKind`; `relationKind.ts`'s `PeerRelationalEdgeKind`; `CLOSED_RELATION_NARRATION` in `perception/publishObjectManipulationPresentation.ts`, unless attemptNarration's slice 2 has already deleted that file.
  - [ ] Build `mtw-interfaces` and `mtw-wml` before running ephemera's suite against them; one-off `tsc` over the touched package test files.
- [ ] **Slice 4. Durable docs; retire this plan.**
  - [ ] Correct the docs that describe the relational template as live: `actions/AGENT.implementation.md` (relational playbook, Plan section), `enrich/objectManipulation/AGENT.md`, `enrich/AGENT.md`, `llm/AGENT.contract.md` and `llm/AGENT.concepts.md` (relational `operationKind` "owned by Plan's deterministic template"), `diegeticLogic/AGENT.operators.concepts.md` (establish/dissolve tables). State the rule durably where Plan is described: peer relations have no deterministic parse; they come only from the LLM fallback.
  - [ ] Remove this plan's forwarding notes from the plans that point here (below), and grep inbound links before deleting this file.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement upcoming slices. When one ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| RD-2 | **Is `take X out of Y` / `take X off Y` a containment template?** **Decided (2026-10-06): no.** It is not a template shape. After slice 2 the membership template claims both by leading verb and ignores the `out of Y` / `off Y` tail, which is the right outcome when X is in or on Y. The tail's eventual use is narrowing *which* X the player means, by extending object spans to read it; that is reference resolution, not a deterministic template, and is out of scope here. The slice 2 pin covers the routing. | 2 | Decided; remove when slice 2 ships |

## Plans that point here

- [`AGENT.attemptNarration.planning.md`](../../AGENT.attemptNarration.planning.md): relational establish narration has no deterministic producer after slice 2; its slice 2 re-scopes to Expansion's dissolves.
- [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md): the plan-only / joint fallback becomes the only producer of peer relations.
- [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md): CPG-6 retires with the registry it would have wired.
- [`AGENT.deterministicFastPathImprovements.planning.md`](AGENT.deterministicFastPathImprovements.planning.md): BD-24 extends the containment template, not `matchRelationalTemplate`.

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/deterministicTemplate/ \
  dataSource/actions/parseCommand.test.ts \
  dataSource/positions/ludicGraph/expandValidate/

# Full suite before marking a slice done --- integration tests are NOT covered by tsc
npm run test -- --watchAll=false

npx tsc --noEmit
```

Slice 3 also runs the `mtw-interfaces` and `mtw-wml` suites (each package's own `npm run test`) and builds both before the ephemera run.

Grep checks, from the repo root:

```bash
# After slice 2: no deterministic relational parsing left
grep -rn "matchRelationalTemplate\|relationalTemplateRegistry\|ESTABLISH_VERBS\|DISSOLVE_VERBS" \
  --include="*.ts" lambda packages | grep -v node_modules | grep -v /dist/

# After slice 3: no closed peer kinds left
grep -rnw "Under\|Against\|ClosedRelationKind\|CLOSED_RELATION_KINDS" \
  --include="*.ts" lambda packages charcoal-client/src | grep -v node_modules | grep -v /dist/
```

The second grep matches English in comments too ("under", "against" as ordinary words); read the hits, do not just count them.
