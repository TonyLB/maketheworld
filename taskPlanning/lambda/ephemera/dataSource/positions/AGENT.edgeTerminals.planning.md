# Edges as terminals: an edge-reference arm of `EphemeraLudicTerminalId`

**Status:** opened 2026-10-29. Nothing is built. ET-1 to ET-5 decided with the user 2026-10-29. **Next step: Slice 0** (inventory, no code). An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

Let a stored relational edge name **another edge in the same graph** as one of its terminals, by that edge's `edgeId`. Today a terminal is a component or a port on one; after this plan it may also be an edge. This changes what every terminal-reading site may meet, which is why it is its own plan rather than a slice of its first consumer.

The first consumer is `SecuredTo` v1 ([`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)), whose `Custom(tied to) -[Justifies]-> SecuredTo` edges name a support and a secured edge. The licence is **one producer, same graph, single legs** ([What is licensed now](AGENT.edgeAbstractions.planning.md#what-is-licensed-now-and-only-in-this-scope)). The capable version (edge occurrences across graphs, an abstraction as the source, crossing supports) is booked in [Owed by the capable version](AGENT.edgeAbstractions.planning.md#owed-by-the-capable-version) and is not this plan.

**Payoff, stated at the observable output:** a graph holding edge A (with an `edgeId`) and edge B whose terminal names A round-trips through the stored row, the room's `ludicCache` and the wire graph with B's terminal intact; dissolving A by structure alone leaves no edge naming a missing id.

## What exists today (checked 2026-10-29)

- **The union has two arms, and sites tell them apart by `typeof`.** `EphemeraLudicTerminalId = EphemeraLudicTerminalPrimitive | EphemeraLudicPortAddress` ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)). `ephemeraLudicTerminalOwner` is `typeof terminal === 'string' ? terminal : terminal.owner`, and `ephemeraLudicTerminalsEqual` casts the non-string side to a port address. **A third object arm would fall into every else-branch as if it were a port address, and the compiler would not say so.** A heuristic grep (`typeof ….(from|to|terminal) === 'string'`, `isEphemeraLudicPortAddress(`) finds about 28 sites in 14 non-test files across `positions/`, `actions/`, `ludicCache/` and `mtw-interfaces`; Slice 0 makes the list exact.
- **Every terminal has an owner component today.** `ephemeraLudicTerminalOwner` and `ephemeraLudicTerminalRefersTo` are total. Readers that rely on it include `removeObject`'s incident-edge pruning, the footprint, `presenceSubGraph`'s cut, `connectedToLegality`, the wire projection and published events. An edge has no owning component, so each of these must say what it does with one (ET-2).
- **`edgeId` minting has shipped** (rules in [`AGENT.contract.md` "Edge persist shape"](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#edge-persist-shape)): caller-minted, single legs only, survives the row, the cache and the wire. `edgesMatch` ignores `edgeId`, and nothing yet looks an edge up *by* id.
- **The `ephemeraMeta.ts` comment already states the shape constraint:** `edgeId` is deliberately not an arm of `EphemeraId`, and "whether an edge may stand where a terminal stands is a separate question (EA-10)". This plan answers that question for one producer.
- **No `Justifies` kind exists.** `STORED_RELATIONAL_EDGE_KINDS` is `Custom`, `ConnectedTo`; adding a member is adding to the named union and the set (the hosting-kind work left it that way).

## Design

- **Make the discrimination exhaustive before adding the arm.** Route every site through one helper that switches on the terminal's arm (a `terminalArm`-style accessor, or a `matchTerminal(terminal, { component, port })` fold), so that adding the edge arm is a compile error at each site. This is a pure refactor and lands first, on a green suite.
- **Same graph, single legs.** The referenced edge must be a stored edge of the same graph carrying that `edgeId`, and carry no `chainId`. An edge terminal never appears on a crossing port or a chain leg.
- **The referenced edge and its referrers travel together.** Any cut, merge or fold that keeps a referrer keeps the edge it names, or drops the referrer.
- **The arm is `{ edgeId: string }`** (ET-1), told apart from a port address by its key.
- **An edge terminal has no owner** (ET-2). `ephemeraLudicTerminalOwner` and `ephemeraLudicTerminalRefersTo` narrow to component and port terminals, and each owner-reading site states its edge case (prune, skip, or refuse).
- **Dissolving or pruning a referenced edge removes its referrers in the same apply** (ET-3). A referrer naming a missing id is corruption to the guard and to `healLudicGraphStructure`.
- **`Justifies` is added here, and is the only kind that may carry an edge terminal** (ET-4). Both its terminals are edges in the same graph.
- **An edge may not name itself; cycles are allowed** (ET-5), since nothing here walks references.
- **No lapse logic here.** Whether `SecuredTo` survives losing a justifier is SecuredTo's. This plan only guarantees no edge names a missing id.

## Relationship to other plans

- **[`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)** is the first consumer and waits on this plan. The `Justifies` kind and its legality are built here (ET-4); the `SecuredTo` kind and the lapse are SecuredTo's.
- **[`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md#reopened-in-part-support-between-edges-2026-10-28)** licenses the arm and records the capable version.
- **[CE2/CE2a](AGENT.abstractionLayers.planning.md#recommended-order)** owns the Edge record and reverse index. When built, its record lists the edge-terminal references pointing at an edge; nothing here pre-builds that index.
- **WML.** The wire drops non-`Navigation` relational edges at print ([`AGENT.wmlRelationalEdges.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md)), so authoring an edge terminal in WML is out of scope.

## Getting Started

1. **Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1--4 (legs, chains, ports) and the external-addressing section.
3. **The terminal types:** the "Ludic graph edge/port terminals" block in [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), from `EphemeraLudicTerminalPrimitive` through `ephemeraLudicTerminalRefersTo`, and the `edgeId`/`chainId` comment on `EphemeraLudicRelationalEdgeBase`.
4. **Rules this extends:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) "Edge persist shape".
5. **The licence and its limits:** [Reopened in part](AGENT.edgeAbstractions.planning.md#reopened-in-part-support-between-edges-2026-10-28) through "Owed by the capable version".
6. **Immer trap:** `MultiKeyUpdate` reducers run under `produce()`; anything retained past the reducer's return must be a plain copy.
7. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Other packages: `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
8. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the three package suites. As of 2026-10-29: ephemera 4018 (9 skipped), interfaces 775; gateways 308 and diagnostics 161 as of 2026-10-28.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| ET-1 | **The arm's shape.** Proposed: a tagged object, `{ edgeId: string }`, distinguishable from a port address by its key. The alternative, a prefixed string (`EDGE#<uuid>`), would land in the `string` branch at every site and in `EphemeraId`'s territory, which the `ephemeraMeta.ts` comment rules out. Open: the key name, and whether the arm carries anything besides the id. | 2 | **Decided 2026-10-29:** a tagged object `{ edgeId: string }`, carrying only the id. |
| ET-2 | **What an edge terminal's owner is.** `ephemeraLudicTerminalOwner` is total today. Options: (a) an edge terminal has no owner, the helper narrows to component-and-port terminals, and each owner-reading site states its edge case (prune, skip, or refuse); (b) resolve through the referenced edge's endpoints in the same graph. (a) keeps the helpers pure; (b) needs the graph at every call. Slice 0's site list says which sites care. | 1 | **Decided 2026-10-29: (a)**, no owner; the helpers narrow and each site states its edge case. |
| ET-3 | **Dangling policy.** When the referenced edge is dissolved or pruned, its referrers are (a) removed in the same apply, or (b) refused, making the dissolve `repairable` until the referrer goes first. The payoff names (a). The guard and `healLudicGraphStructure` treat a referrer naming a missing id as corruption either way. | 3 | **Decided 2026-10-29: (a)**, referrers removed in the same apply. |
| ET-4 | **Which kinds may carry an edge terminal, and where `Justifies` is added.** The licence is one producer (`Justifies`). Options: add `Justifies` here with a legality rule restricting the arm to it, so the payoff is built on the real kind; or leave the kind to SecuredTo and test the arm on `Custom` behind a test-only allowance. The user's call. | 2 | **Decided 2026-10-29:** `Justifies` is added here, with a legality rule restricting the arm to it. |
| ET-5 | **Self-reference and cycles.** Whether an edge may name itself, and whether A names B names A is refused at write time. Proposed: refuse self-reference; allow cycles, since lapse is SecuredTo's and nothing here walks references. | 2 | **Decided 2026-10-29:** self-reference refused; cycles allowed. |

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | |
| 1. Exhaustive terminal discrimination (refactor, no behavior change) | |
| 2. The arm: type, guards, equality, same-graph legality | |
| 3. Lifecycle: dissolve, cut, merge, fold, wire; payoff | |
| 4. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0. Inventory, no code.**
    - [ ] The exact list of sites that discriminate terminal arms (`typeof` on a terminal, `isEphemeraLudicPortAddress`, `.owner`/`.port` reads, `ephemeraLudicTerminalOwner`/`RefersTo`/`TerminalsEqual` callers), in ephemera, `mtw-interfaces`, `mtw-gateways` and `lambda/diagnostics`. For each, what it would do with an edge terminal.
    - [ ] Which readers need an owner (ET-2), and which could treat an edge terminal as "not a component".
    - [ ] Where a referenced edge and its referrer could be separated: `presenceSubGraph`, `mergeReducer`, the cache fold, `removeObject` pruning, `removeRelationalEdge`, `findRelationalChain`.
    - [X] Settle ET-1 to ET-5 with the user (2026-10-29).
- [ ] **Slice 1. Exhaustive terminal discrimination.** One helper that switches on the arm; migrate every Slice 0 site to it. No new arm and no behavior change: the suite stays green unaltered.
- [ ] **Slice 2. The arm.**
    - [ ] The type and guard (ET-1); `isEphemeraLudicTerminalId` and the edge payload guard accept it.
    - [ ] Equality: two edge terminals are equal iff their ids are; never equal to a component or port.
    - [ ] Add `Justifies` to `HostRelationalEdgeKind` and `STORED_RELATIONAL_EDGE_KINDS`, directional, no label; fix any site that lists kinds by hand (`grep -rn "'ConnectedTo'"`).
    - [ ] Same-graph legality: both `Justifies` terminals are edge terminals; the id is on a stored single-leg edge of the same graph; no other kind may carry an edge terminal; self-reference refused, cycles allowed. Refused at the graph method, with unit tests.
    - [ ] Each Slice 1 site's edge branch, per ET-2.
- [ ] **Slice 3. Lifecycle and payoff.**
    - [ ] Dissolve and prune of a referenced edge remove its referrers in the same apply (ET-3); `healLudicGraphStructure` and the drift sweeps flag a referrer naming a missing id.
    - [ ] Cut, merge and fold keep a referrer with the edge it names.
    - [ ] **Payoff test** (in `invalidationCompleteness.integration.test.ts`, reusing its harness): edge A with an id, a `Justifies` edge B naming A; read B back from the stored row, the cache and the wire graph; dissolve A by structure alone; no edge names a missing id.
- [ ] **Slice 4. Durable docs, then delete this plan.** The terminal comment in `ephemeraMeta.ts`; `positions/AGENT.contract.md` "Edge persist shape"; `ludicGraph/AGENT.md`; `AGENT.implementation.md`; the licence paragraph in `AGENT.edgeAbstractions.planning.md` and SecuredTo's status line; grep inbound links, then delete.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
- After Slice 1: re-run Slice 0's site grep and confirm every hit goes through the helper.
