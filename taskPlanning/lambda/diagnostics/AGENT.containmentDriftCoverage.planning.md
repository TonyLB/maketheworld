# Containment drift coverage: implementation

**Status: ready (queued 2026-10-18, unblocked the same day): the monotone-covers plan landed and was deleted, and the contract clauses this plan links are rewritten. Slice 0 is next.**

**Scope in one sentence: make the `ContainmentPopulationDriftSweep` sense every condition cache-time containment population repairs, keyed on the condition rather than on the owner's kind.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../AGENT.md). Deleted when the work lands; lasting rules go to [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md) (the sweep section) and [`positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (`Component Updated`).

**Why.** The sweep is the no-diff rerun path into population: an unchanged asset never reaches population again, so drift the sweep doesn't sense is never repaired. The classifier ([`classification.ts`](../../../lambda/diagnostics/containmentPopulationDriftSweep/classification.ts)) reads one row at a time and checks two conditions: (a) a Room's Area binding that is not an empty carve-out, and (b) a Room or Area with no unpointed root. Population ([`containmentPopulationSteps.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts)) repairs more than that, and the extra conditions need the parent's row:

- a child's pointer that names the wrong binding on the parent (`:139`);
- a correct binding whose node the parent lacks (`:141`);
- a missing containment edge (`:165`).

Until 2026-10-18 the classifier also excluded Characters and Objects by kind, and its comment claimed to be "a superset" of population's test. The user pointed out that kind isn't the criterion: an Object contains things the way a Room does. The guard was removed and both docs now say which conditions go unsensed. This plan closes that gap.

---

## Getting Started

1. **Read the sweep and its consumer:** the [Containment Population Drift sweep section](../../../lambda/diagnostics/AGENT.md#containment-population-drift-sweep-presence-binding-shape-diagnostics) of `lambda/diagnostics/AGENT.md`; [`containmentPopulationDriftSweep/`](../../../lambda/diagnostics/containmentPopulationDriftSweep/); [`healContainmentPopulation.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/healContainmentPopulation.ts), which reruns population only for a parent's `PartOf` Room and Feature children.
2. **Read what population repairs:** `containmentPopulationSteps` and `rootStep` (same file), and [`populateContainmentAtCache.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/containment/populateContainmentAtCache.ts). Note the live-host rule (`:96`): a placed authored Object is skipped, because a player move is the authority over authored placement.
3. **Read the neighbouring sweeps,** so a condition isn't sensed twice: [`presenceCoverDriftSweep/`](../../../lambda/diagnostics/presenceCoverDriftSweep/) (pointer versus cover, `noBase`) and [`ludicGraphStaleStructureSweep/`](../../../lambda/diagnostics/ludicGraphStaleStructureSweep/) (shapes the guard rejects).

**Test orientation.** Command authority: [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md); for ephemera-side changes, [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow those. Baseline, which must pass before edits:

```bash
cd lambda/diagnostics && npx jest containmentPopulationDriftSweep && npx tsc --noEmit
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/manipulation/containment/
```

## What is deliberately out of scope

- **Discovering authored children that were never populated.** `healContainmentPopulation` heals what an earlier population left on the parent's graph; an authored child with no edge there is reached only by a `Component Updated` diff.
- **Pointer-versus-cover drift and the cover rebuild.** That is `PresenceCoverDriftSweep`'s.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **(a) The repair conditions.** List every condition under which `rootStep` and `containmentPopulationSteps` emit a step, by child kind (Room, Feature, Object) and parent kind. For each, say which sweep senses it today (this one, cover drift, stale structure, or none).
  - [ ] **(b) What each unsensed condition reads.** For each condition (a) finds unsensed, name the rows needed to detect it. The sweep already loads every Room, Feature and Area row in one pass, so a cross-row check within that set may need no new read; a parent that is an Object is not loaded.
  - [ ] **(c) Objects.** A placed authored Object is skipped by the live-host rule, and `healContainmentPopulation` never revisits `In` children. Say whether any condition in (a) can hold for an Object child that population would actually repair. If none can, an Object child needs no sensing here, and the reason is the live-host rule, not its kind.
  - [ ] **(d) Why the classifier is one row at a time.** Ask the user before researching history.
- [ ] **Slice 1. Sense the cross-row conditions.** For each condition Slice 0 finds unsensed and repairable, classify it across the loaded rows and report the parent. Unit tests per condition in `containmentPopulationDriftSweep/index.test.ts`.
- [ ] **Slice 2. Payoff test.** For each new condition: a drifted stored state, the sweep's finding, the ephemera consumer's heal, and a second sweep reading `emittedCount: 0`. Follow the cross-lambda integration convention (a real-serializer round trip into the real consumer, mocked at the leaves).
- [ ] **Slice 3. Docs and deletion.** Rewrite the sweep's Evaluation paragraph in `lambda/diagnostics/AGENT.md` and the classifier's doc comment to list what is sensed. Update the `Component Updated` ingress bullet in `positions/AGENT.contract.md` if Slice 0(c) changes its Object sentence. Then delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **CD-1** | **A condition population would not repair.** If Slice 0 finds an unsensed drift that population skips (for instance on a placed authored Object), choose: (a) report-only from this sweep, (b) leave it to another sweep, or (c) out of scope. Opened only if Slice 0 finds such a case. | 1 | Open (pending Slice 0) |

## Verification

1. `cd lambda/diagnostics && npx jest && npx tsc --noEmit`.
2. `cd lambda/ephemera && npm run test -- --watchAll=false` (the whole suite, because `*.integration.test.ts` files sit outside `tsconfig`).
3. Every `](...#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Ready |
| 1. Cross-row conditions | Not started |
| 2. Payoff test | Not started |
| 3. Docs and deletion | Not started |
