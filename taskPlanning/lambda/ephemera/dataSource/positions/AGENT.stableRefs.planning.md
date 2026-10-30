# StableRefs: ids bound by compile-time analysis, not by bespoke operations

**Status:** drafted 2026-10-30, alongside the SecuredTo prototype that supplies its evidence. Nothing is built. **Next step: Slice 0, which can start: [SecuredTo](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds) Slice 2 shipped the prototype on 2026-10-30** and filled each row's evidence below from working code. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md). Slices after Slice 1 are a sketch: Slice 1's decisions reshape them.

## Goal

Today every operation that needs a fresh id mints it by hand and plumbs it to each place it is used. The spread template mints a `presenceUuid` and writes it both into `extend` and into the moved referent's `view`. The crossing legs mint their port ids. SecuredTo's prototype will mint two edge ids and plug them into a `Justifies`. Each of those is a closed, bespoke piece of logic tied to one operation.

The aim is the opposite arrangement. An instruction set names the components and edges it needs by **ref variables** (`tyingEdge`, `secureEdge`), and the compile phase binds each ref **through analysis**. A ref used only where a new id fits, with nothing existing associated with it, is minted before first use. A ref associated with something already present binds to that id. Operations such as `assignEdgeRelations` then lower without knowing that minting exists: the mints fall out of ref binding, and the operation's own entries pass straight through.

**Payoff, at the observable output:** the SecuredTo prototype's ad-hoc ref function is deleted and `tie`/`untie` behave identically (same three edges, same commands, same transcripts), and a second consumer with a hand-minted id (the spread template's `presenceUuid` is the candidate) moves onto refs with its own tests unchanged. One consumer would prove the refactor; two prove the generality.

## What exists today (checked 2026-10-30)

- **The prototype this replaces** ([actions `AGENT.implementation.md` "Edge-relations primitives"](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#edge-relations-primitives-prototype-tie-and-untie)): `assignEdgeRelations` / `dissolveEdgeRelations` with an `edgeRef` field, and one labelled file, [`edgeRefs.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/edgeRefs.ts), applying a hardcoded rule. An assign's refs are all minted at Plan time and carried as `mintedEdgeIds`; a dissolve's refs bind to the stored id of the edge their entry matches. The payload is the interface this plan keeps.
- **Hand-minted ids elsewhere** (candidates for refs, and evidence for SR-3): the spread template's `presenceUuid` ([`matchSpreadTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchSpreadTemplate.ts), minted at template time with `mintActionId`); crossing port ids ([`buildCrossingLegs.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/buildCrossingLegs.ts)); `addPresenceBinding`'s caller-minted `presenceUuid`; `assignEdgeId`'s caller-minted id; the containment population steps. The compiler's capture ids are structural, not minted ([`compilePositionKernelOp.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts)).
- **A name already in use.** Plan referents carry a `stableRefKey` ([`planStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planStep.ts)): the key a span occurrence has in every fill, which the attempt's prose and narration units read. About 125 non-test uses in `actions/`. It names a *phrase's referent*, not an id to mint (SR-5).
- **How stability works today.** Ids minted at Plan time ride the attempt, and the actions contract treats Plan-minted ids as stable across reruns of a frozen root; challenge ids are structural for the same reason (`expandBoundaryChallenges.ts`). Whatever mints a ref's id must keep that property between dry run and commit (SR-1).
- **The compiler is pure.** `compilePositionKernelOp` reads no graph; graph reads stay in the planner (the presence-op vocabulary aspiration). Binding a ref to an *existing* id needs a graph read, so it cannot simply move into that compiler (SR-6).

## Relationship to other plans

- **SecuredTo** ([SecuredTo contract rules](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds)) builds the prototype and writes its findings here (its Slice 0's primitive item and Slice 2's last item). That plan shipped and was deleted 2026-10-30; this one stays open.
- **Edge abstractions** ([`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md)): the capable version of `Justifies` (a component as the source, edges across graphs) will need refs to more than edges. Not this plan's scope, but SR-3 should not close the door on it.
- **Presence-op vocabulary aspiration:** a rich op language where the planner decides semantics and the compiler expands deterministically. Refs are one of its prerequisites; this plan does not build the language.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **The prototype and why it exists:** [actions `AGENT.implementation.md` "Edge-relations primitives"](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#edge-relations-primitives-prototype-tie-and-untie), and the ad-hoc ref file [`edgeRefs.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/edgeRefs.ts).
3. **Graph model:** primer [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4; [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) *Edge persist shape* (`assignEdgeId`, `Justifies`).
4. **The pipeline a ref crosses:** the actions contract ([`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md)) on Plan, grounding and attempt stability; `planStep.ts` -> `groundChange.ts` -> `synthesize/executor.ts` -> kernel steps; and [`compilePositionKernelOp.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts).
5. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`); `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`.
6. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`. Record the count at Slice 0 (it will have moved since SecuredTo's baseline).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

Each row names the prototype evidence that informs it; SecuredTo Slice 2 fills that evidence in.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SR-1 | **Where binding happens, and how a minted id stays the same in dry run and commit.** Plan time (frozen with the attempt, as `extend` does), grounding, or a compile phase. *Evidence: where the prototype mints its edge ids, and whether dry run and commit agreed without extra work.* *(SecuredTo Slice 0 sizing: `extend` mints `presenceUuid` in the template (`matchSpreadTemplate.ts`) and the attempt freezes it, so dry run and commit agree by construction; commit builds its steps once in `commitAttempt`'s fragment builders and the kernel dry-runs that list. Minting inside the fragment builder would also be self-consistent within one commit but not stable across a rebuilt attempt.)* *(SecuredTo Slice 2: minted at Plan time by `mintEdgeRefs`, carried on the change as `mintedEdgeIds`; the payoff test finds the committed edges carrying exactly the attempt's ids, with no extra work. The ids are minted per template build; dry run and commit agree because commit receives the attempt the dry run judged.)* | 1 | Open |
| SR-2 | **When a ref binds to an existing id, and what analysis decides it.** The motivating rule: a ref used only where an edgeId fits, with nothing existing associated, is minted. The converse (a ref that names something present, such as `untie` naming the tying edge by ref instead of by structure) needs a lookup rule. *Evidence: whether `dissolveEdgeRelations` matching by structure was ever insufficient.* *(SecuredTo Slice 0: `edgesMatch` ignores `edgeId`, so `Custom` and `SecuredTo` match structurally. A `Justifies` has edge-terminal endpoints, so naming it needs the minted ids from the graph; that is the first case where structure is insufficient. The prototype's `untie` reads those ids from the graph in the fragment builder and dissolves the `Justifies` first, ahead of the dissolve fixpoint.)* *(SecuredTo Slice 2: structure was enough for every node-ended entry (`Custom`, `SecuredTo`); it was not enough only for the edge-ended `Justifies`, which needed the refs. The dissolve's binding (a ref binds to the stored id of the edge its entry matches) is that lookup rule in its narrowest form. A ref declared on an edge-ended entry is refused as a programming error: it would need the binding to order three layers.)* | 1 | Open |
| SR-3 | **Which ids a ref can stand for.** Edge ids only, or also presence binding ids (`presenceUuid`), crossing port ids and component ids. *Evidence: the hand-minted sites above, and whether the prototype wanted a ref anywhere other than an edge.* *(SecuredTo Slice 2: the prototype wanted refs for edges only.)* | 1 | Open |
| SR-4 | **What a binding failure is.** A ref that should bind to something present but cannot, a minted id that conflicts (`edgeIdConflict`), a missing edge (`edgeMissing`), and `mustBePresent`: `stale` verdicts, refusals, or programming errors. *Evidence: how the prototype's `mustBePresent` handling and its `assignEdgeId` steps behaved under the existing stale verdicts.* *(SecuredTo Slice 2: `assignEdgeId`'s `edgeMissing` / `edgeIdConflict` were never reached, since the refs are fresh and the edges are established earlier in the same sequence. `mustBePresent` and "none present" are judged in the builder against the graph it read, before the kernel, and come back as refusal codes the dry run words for the player; a world that changes between that read and commit would meet the kernel's own staleness, which was not exercised.)* | 2 | Open |
| SR-5 | **One namespace or two with `stableRefKey`.** Referents already carry a `stableRefKey` naming a phrase's referent; ref variables name ids an operation needs. Whether they unify (a span's key is just a ref that binds to an existing component) or stay distinct. | 1 | Open |
| SR-6 | **Where the graph read for binding lives,** given the op compiler reads no graph: binding before the compiler (the planner or grounding resolves refs and hands the compiler concrete ids plus "mint" markers), or a read context passed to it. *Evidence: where the prototype's optional-dissolve filtering had to read the graph.* *(SecuredTo Slice 0: the kernel throws on an absent edge, so the filter must precede it; the only graph-reading point in the extend-style path is the `commitAttempt` fragment builder, which already holds `getGraph`.)* *(SecuredTo Slice 2: the graph read is the builder's caller's. `edgeRelationsHost` and `edgeRelationSteps` are pure over graphs they are handed; the dry run hands them `env.getGraph` and commit hands them graphs it fetched for the things' live hosts. So binding before the compiler, with a graph read alongside, was enough here.)* | 1 | Open |

## Progress

| Slice | State |
| --- | --- |
| 0. Evidence: prototype findings and the minting inventory (no code) | Not started; can start (SecuredTo Slice 2 shipped 2026-10-30, and each row's evidence is filled). |
| 1. Decide SR-1, SR-2, SR-3, SR-5, SR-6; design ref binding | |
| 2. Build ref binding; move `assignEdgeRelations` / `dissolveEdgeRelations` onto it; delete the ad-hoc function | |
| 3. The second consumer (spread's `presenceUuid` or what SR-3 picks), and the payoff | |
| 4. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Evidence, no code.** After SecuredTo Slice 2 ships.
    - [ ] Confirm each row's *Evidence* clause was filled from the prototype; fill any gap by reading the prototype's code and tests.
    - [ ] Inventory every hand-minted id in `actions/` and `positions/` (start from the `mintActionId()` / uuid call sites), and for each record what it is plumbed into and whether a ref would replace it. Grows SR-3's list.
    - [ ] Note every place a `stableRefKey` is read, by job, for SR-5.
- [ ] **Slice 1. Decide and design** (SR-1, SR-2, SR-3, SR-5, SR-6).
    - [ ] Settle the rows with the user; write the binding design (the analysis, its inputs, where it runs) into this plan, briefly.
    - [ ] Re-cut Slices 2--4 against the decisions.
- [ ] **Slice 2. Build ref binding** (per Slice 1, SR-4).
    - [ ] The binding pass and its tests: mint when only a new id fits and nothing is associated; bind to an existing id per SR-2; failures per SR-4; dry run and commit agree.
    - [ ] Move the two SecuredTo primitives onto it and delete the ad-hoc function; SecuredTo's tests pass unchanged.
- [ ] **Slice 3. The second consumer.**
    - [ ] Move spread's `presenceUuid` (or SR-3's pick) onto refs; its template and payoff tests pass unchanged.
- [ ] **Slice 4. Durable docs, then delete this plan.** The actions contract (refs in an instruction set, binding rules), positions contract if the compiler's purity rule changes, concepts vocabulary (ref variable, binding), `AGENT.implementation.md`; grep inbound links (the SecuredTo shelf in `AGENT.implementation.md`, the edge-abstractions plan) and delete.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- After Slice 2: `grep -rn "edgeRef" --include='*.ts' lambda/ephemera | grep -v test` finds no hardcoded mint rule outside the binding pass.
