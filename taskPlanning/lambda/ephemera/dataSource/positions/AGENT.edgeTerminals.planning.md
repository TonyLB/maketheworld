# Edges as terminals: an edge-reference arm of `EphemeraLudicTerminalId`

**Status:** opened 2026-10-29. Nothing of the arm is built. ET-1 to ET-5 decided with the user 2026-10-29. Slice 0 (inventory) done 2026-10-29; Slice 1's fold was built and reverted the same day (see Progress). (ET-6 decided 2026-10-29; ET-7 retired 2026-10-29). **Paused 2026-10-29** until the terminal representation is settled; see [Paused: terminal representation](#paused-terminal-representation). Slice 2 does not start before then. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

Let a stored relational edge name **another edge in the same graph** as one of its terminals, by that edge's `edgeId`. Today a terminal is a component or a port on one; after this plan it may also be an edge. This changes what every terminal-reading site may meet, which is why it is its own plan rather than a slice of its first consumer.

The first consumer is `SecuredTo` v1 ([`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)), whose `Custom(tied to) -[Justifies]-> SecuredTo` edges name a support and a secured edge. The licence is **one producer, same graph, single legs** ([What is licensed now](AGENT.edgeAbstractions.planning.md#what-is-licensed-now-and-only-in-this-scope)). The capable version (edge occurrences across graphs, an abstraction as the source, crossing supports) is booked in [Owed by the capable version](AGENT.edgeAbstractions.planning.md#owed-by-the-capable-version) and is not this plan.

**Payoff, stated at the observable output:** a graph holding edge A (with an `edgeId`) and edge B whose terminal names A round-trips through the stored row, the room's `ludicCache` and the wire graph with B's terminal intact; dissolving A by structure alone leaves no edge naming a missing id.

## Paused: terminal representation

`EphemeraLudicTerminalId` claims two arms but carries four kinds: a component id, a bare presence id (a binding addressed from inside), a crossing port `{ owner, port: <uuid> }` and a presence exterior address `{ owner, port: 'PRESENCE#...' }`. The kind is told apart by prefix sniffing (`isEphemeraPresenceNodeId`, `isPresenceTaggedPortId`) on values typed only as `string`, in six non-test files. One binding has two spellings, so `ephemeraLudicTerminalsEqual` needs a cross-arm rule, and `PRESENCE#Base` makes that rule depend on a `bareOwner` parameter. Representation tests (`typeof === 'string'`) let this go unnoticed, because they make no claim about what an arm holds.

**The two spellings are deliberate** (user, 2026-10-29): the bare presence id is an early optimization that roughly halves the data and bandwidth for a very common pattern. So the fix is not one canonical spelling. It is naming each kind, both presence spellings included, as its own type with its own guard, so the cross-spelling equality is a stated rule between named kinds rather than prefix sniffing inside a two-arm test.

Adding the edge arm on top of this would make a 4-kind union a 5-kind one with the same problem. Settle the representation first, in [`AGENT.terminalKinds.planning.md`](AGENT.terminalKinds.planning.md), then re-derive Slices 1--3 on the result.

**Correction to "What exists today":** a new object arm would *not* fall silently into `.owner`/`.port` reads; the else branch widens and those reads stop compiling. The silent sites were the casts (`b as EphemeraLudicPortAddress` in equality) and structural or shape-agnostic code. Slice 1's `matchEphemeraLudicTerminal` fold was built on the stronger premise and was **reverted 2026-10-29**; `ephemeraLudicTerminalKey` (the two `terminalKey` copies collapsed) and the `EphemeraLudicRootId` alias were kept.

## What exists today (checked 2026-10-29)

- **The union has two arms, and sites tell them apart by `typeof`.** `EphemeraLudicTerminalId = EphemeraLudicTerminalPrimitive | EphemeraLudicPortAddress` ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)). `ephemeraLudicTerminalOwner` is `typeof terminal === 'string' ? terminal : terminal.owner`, and `ephemeraLudicTerminalsEqual` casts the non-string side to a port address. A third object arm would make `.owner`/`.port` reads in those else-branches fail to compile; only the casts (equality's `as EphemeraLudicPortAddress`) and structural or shape-agnostic code would take it silently (corrected 2026-10-29; see [Paused](#paused-terminal-representation)). Slice 0 made the list exact: 14 sites must change and about 12 need no change ([Slice 0 inventory](#slice-0-inventory-plan-only)); `mtw-wml`'s wire terminal type is a fourth place the arm must reach.
- **Every terminal has an owner component today.** `ephemeraLudicTerminalOwner` and `ephemeraLudicTerminalRefersTo` are total. Readers that rely on it include the incident-edge guards (`removeObject` refuses rather than prunes; dissolving happens in the removal steps), `presenceSubGraph`'s cut, `connectedToLegality` and the wire projection. The footprint and published events filter steps by `isEphemeraLudicTerminalPrimitive` and are unaffected. An edge has no owning component, so each of these must say what it does with one (ET-2).
- **`edgeId` minting has shipped** (rules in [`AGENT.contract.md` "Edge persist shape"](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#edge-persist-shape)): caller-minted, single legs only, survives the row, the cache and the wire. `edgesMatch` ignores `edgeId`, and nothing yet looks an edge up *by* id.
- **The `ephemeraMeta.ts` comment already states the shape constraint:** `edgeId` is deliberately not an arm of `EphemeraId`, and "whether an edge may stand where a terminal stands is a separate question (EA-10)". This plan answers that question for one producer.
- **No `Justifies` kind exists.** `STORED_RELATIONAL_EDGE_KINDS` is `Custom`, `ConnectedTo`; adding a member is adding to the named union and the set (the hosting-kind work left it that way).

## Design

- **Make the discrimination exhaustive before adding the arm.** To be re-derived after the representation is settled ([Paused](#paused-terminal-representation)). A `matchTerminal` fold was tried and reverted: it obscured the code and fixed nothing the compiler does not already catch.
- **The arm names a relationship, by `edgeId`.** `edgeId` is the relationship; `chainId` is one route realizing it; legs are that route's per-graph pieces ([`AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) Identity LG-10; [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports)). A terminal resolves by `edgeId` alone, so nothing downstream (the cut, the fold, the dangling-id guard) may depend on how a route was chopped into legs. **v1 limit, temporary:** the relationship occurs once, as a single leg in the same graph (no `chainId`). That limit lives in **one write-time legality check** (Slice 2), so lifting it for the capable version deletes that check and nothing else. The referrer itself never sits on a crossing port or a chain leg.
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
8. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the three package suites. As of 2026-10-29: ephemera 4018 (9 skipped), interfaces 776; gateways 308 and diagnostics 161 as of 2026-10-28.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| ET-1 | **The arm's shape.** Proposed: a tagged object, `{ edgeId: string }`, distinguishable from a port address by its key. The alternative, a prefixed string (`EDGE#<uuid>`), would land in the `string` branch at every site and in `EphemeraId`'s territory, which the `ephemeraMeta.ts` comment rules out. Open: the key name, and whether the arm carries anything besides the id. | 2 | **Decided 2026-10-29:** a tagged object `{ edgeId: string }`, carrying only the id. |
| ET-2 | **What an edge terminal's owner is.** `ephemeraLudicTerminalOwner` is total today. Options: (a) an edge terminal has no owner, the helper narrows to component-and-port terminals, and each owner-reading site states its edge case (prune, skip, or refuse); (b) resolve through the referenced edge's endpoints in the same graph. (a) keeps the helpers pure; (b) needs the graph at every call. Slice 0's site list says which sites care. | 2 | **Decided 2026-10-29: (a)**, no owner; the helpers narrow and each site states its edge case. |
| ET-3 | **Dangling policy.** When the referenced edge is dissolved or pruned, its referrers are (a) removed in the same apply, or (b) refused, making the dissolve `repairable` until the referrer goes first. The payoff names (a). The guard and `healLudicGraphStructure` treat a referrer naming a missing id as corruption either way. | 3 | **Decided 2026-10-29: (a)**, referrers removed in the same apply. |
| ET-4 | **Which kinds may carry an edge terminal, and where `Justifies` is added.** The licence is one producer (`Justifies`). Options: add `Justifies` here with a legality rule restricting the arm to it, so the payoff is built on the real kind; or leave the kind to SecuredTo and test the arm on `Custom` behind a test-only allowance. The user's call. | 2 | **Decided 2026-10-29:** `Justifies` is added here, with a legality rule restricting the arm to it. |
| ET-5 | **Self-reference and cycles.** Whether an edge may name itself, and whether A names B names A is refused at write time. Proposed: refuse self-reference; allow cycles, since lapse is SecuredTo's and nothing here walks references. | 2 | **Decided 2026-10-29:** self-reference refused; cycles allowed. |
| ET-6 | **The wire arm.** `StandardLudicTerminalData` (`mtw-wml`) has three arms and `ephemeraTerminalToWire` has no home for an edge terminal, yet the payoff reads B back from the wire graph. Proposed: mirror ET-1, a fourth arm `{ edgeId: string }`, with `toJSON`/`clone`/`toFormat`/`lookup` passing it through unchanged (an edge id is not a component reference, so `lookup`/`toFormat` have nothing to remap). WML printing stays out of scope. | 3 | **Decided 2026-10-29:** a fourth wire arm `{ edgeId: string }`, passed through unchanged by `toJSON`/`clone`/`toFormat`/`lookup`; WML printing stays out of scope. |

## Slice 0 inventory (plan only)

Checked 2026-10-29 by grep over `lambda/ephemera`, `lambda/diagnostics`, `packages/mtw-interfaces`, `packages/mtw-gateways` and `packages/mtw-wml`, non-test files. Read it with one fact in mind: the **step** types (`subjectId`/`targetId`) also say `EphemeraLudicTerminalId`, but no step ever carries an edge terminal (ET-4 puts the arm on `Justifies` edges only, and nothing steps a `Justifies` edge). Sites that already filter steps with `isEphemeraLudicTerminalPrimitive` stay correct untouched.

**A. Sites that must change (Slice 2 writes the edge branch).**

| Site | What it does today | Edge terminal should |
| --- | --- | --- |
| `ephemeraMeta.ts` `ephemeraLudicTerminalOwner` | `typeof === 'string' ? t : t.owner` | not exist: overload narrows to component and port terminals (ET-2) |
| `ephemeraMeta.ts` `ephemeraLudicTerminalsEqual` | casts the non-string side to a port address | equal iff ids equal; never equal to component or port |
| `ephemeraMeta.ts` `ephemeraLudicTerminalRefersTo` | owner compare | return false |
| `ephemeraMeta.ts` `isEphemeraLudicTerminalId`, `isEphemeraLudicRelationalEdgeData` | accept two arms | accept the third; `Justifies` only (ET-4) |
| `presenceSubGraph.ts:145` and `mergeReducer.ts:116` `terminalKey` (two copies) | string, else `owner#port` | key `edge:<id>`. **Unfixed it yields `undefined#undefined` and every edge terminal collides.** Slice 1 collapses the two copies into one helper |
| `presenceSubGraph.ts:272-318` `endpointStatus` and `:360` | `ephemeraLudicTerminalOwner` then node-membership, **throws** if owner is not a node | status follows the referenced edge (see B) |
| `connectedToLegality.ts:7,17` | `describeTerminal` and `endpointViolation` read `.owner` | refuse: only `Justifies` carries the arm |
| `ludicGraph/index.ts:589`, `baseClasses.ts:203,212` (`assertNoRelationalEdgesReferencing`, `nodeHasRelationalEdge`, `edgeReferencesObjectId`) | `RefersTo` on both terminals | false (an edge terminal references no node) |
| `ludicGraph/index.ts:697` `bothObjectsOnGraph` (used by `applyRelationalPatch`) | owner in `nodeIds` | the id names a stored edge of this graph (Slice 2 legality) |
| `findRelationalChain.ts:81-89` `resolveEndpoint` | primitive branch, else `terminal.port` unconditionally | decline: an edge terminal is never a chain endpoint |
| `findRelationalChainsForRemoval.ts:71-72` | adds `terminal.owner` to the visit set | skip (adds `undefined` unfixed) |
| `wireProjection.ts:72-81` `ephemeraTerminalToWire` / `wireTerminalToEphemera` | string, else port address | needs a wire arm (ET-6) |
| `mtw-wml` `ludicEdge.ts:161-235`, `dataTypes/ludicEdge.ts:69` `StandardLudicTerminalData` | three arms (`'owner' in`, `'presence' in`, reference) with `toJSON`/`clone`/`toFormat`/`lookup` | a fourth arm (ET-6); **not in the original site list** |
| `healLudicGraphStructure.ts:84` | root id only | no change for the arm; Slice 3 adds a dangling-id finding (see C) |

**B. Sites that need no change (confirmed, so Slice 1 need not touch them).** Step-id filters (`commitAttempt.ts:565`, `computeStepSequenceFootprint.ts:94`, `factsForStep.ts:98`, `repairAdministrativeChainDissolve.ts:47`, `clearCoyoteGameImprovisationObjects.ts:172`, `publishedEvents.ts:147`, `compilePositionKernelOp.ts:58-63`'s filter-then-cast, `applyStepSequenceCore.ts:94`); `presenceParent.ts:112` (a guard that already excludes anything not an address); `mergeReducer.ts` `liftPresenceTerminal`/`rewrite` and `ludicCache/types.ts:174` (string-only tests the arm passes through); `expandBoundaryChallenges.ts:24` (`JSON.stringify` key, already generic); `interactionUnderTransfer.ts:59` (`=== moverId`); `mtw-gateways` `classifyLudicGraphPortMismatch.ts:79` (equality only); `lambda/diagnostics` (no terminal read: it consumes `healLudicGraphStructure`, the guard and the gateway classifier). `ludicGraph/index.ts` 377-459 read `rootId`'s owner and compare roots: the root is never an edge, so **Slice 1 should narrow `rootId`'s type to component and port terminals** rather than handle the arm there.

**C. Owner readers (ET-2).** Need a real owner: `presenceSubGraph` cut, `mergeReducer.ts:414` (root), `findRelationalChain.ts:89`, `ludicGraph/index.ts` root reads, `findRelationalChainsForRemoval.ts:115` (touches-removal-set: an edge terminal is "not a component", so false). Everything else can treat an edge terminal as "not a component".

**D. Where a referenced edge and its referrer can separate.**

- **`presenceSubGraph` cut.** Buckets are cut by node; an edge with one disqualified endpoint is rewritten into a stub leg (`{...edge, from: stubTerminal}`), a transient piece of one route that keeps its `edgeId`. A referrer names the relationship, so it needs no special case for a straddling edge: its status follows the edge it names, resolved by `edgeId` alone. Slice 3 tests that a referrer survives cut then fold unchanged.
- **`mergeReducer`** (`subGraphFromNodes`, `mergeSameHostBucket`, `foldSameHostBuckets`, `dedupeEdgesByIdentity`): the fold keeps whole interior edges, so the pair travels together *if* both survive `touchesRemainingPort`; the referenced edge has no port, so it passes. Dedupe is by identity including `edgeId`; a referrer duplicated across buckets dedupes to one. Needs a test, not a design.
- **`removeObject` does not prune.** It calls `assertNoRelationalEdgesReferencing` and **throws** `RelationalEdgeStillReferencedError`; dissolving incident edges happens upstream, in `findRelationalChainsTouching` and the removal steps. So ET-3's "referrers removed in the same apply" belongs to the **kernel step that dissolves an edge**, not to `removeObject`. The plan's "What exists today" bullet is corrected below.
- **`removeRelationalEdge`** removes by `edgesMatch` alone and knows nothing of referrers: Slice 3 either makes it remove referrers or makes the kernel step do so (the second, since `removeRelationalEdge` is a leaf and the step already owns the "same apply").
- **`findRelationalChain`**: never reaches a referrer (decline above), so no separation.
- **The cache guard** (`ludicCache/types.ts` referential-integrity pass) and `fromFieldPayload` are where a dangling id is detected (Slice 3).

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | **Done 2026-10-29.** Inventory above; baseline re-run green (ephemera 4018, interfaces 775, gateways 308, diagnostics 161). One new row, ET-6 (decided). |
| 1. Exhaustive terminal discrimination (refactor, no behavior change) | **Reopened 2026-10-29.** The `matchEphemeraLudicTerminal` fold landed in `fe476218e` and was reverted; kept: `ephemeraLudicTerminalKey` (both `terminalKey` copies collapsed) and the `EphemeraLudicRootId` alias. Re-derive after the representation is settled. |
| 2. The arm: type, guards, equality, same-graph legality | |
| 3. Lifecycle: dissolve, cut, merge, fold, wire; payoff | |
| 4. Durable docs; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0. Inventory, no code.** (Done 2026-10-29: [Slice 0 inventory](#slice-0-inventory-plan-only).)
    - [X] The exact list of sites that discriminate terminal arms (`typeof` on a terminal, `isEphemeraLudicPortAddress`, `.owner`/`.port` reads, `ephemeraLudicTerminalOwner`/`RefersTo`/`TerminalsEqual` callers), in ephemera, `mtw-interfaces`, `mtw-gateways` and `lambda/diagnostics`. For each, what it would do with an edge terminal.
    - [X] Which readers need an owner (ET-2), and which could treat an edge terminal as "not a component".
    - [X] Where a referenced edge and its referrer could be separated: `presenceSubGraph`, `mergeReducer`, the cache fold, `removeObject` pruning, `removeRelationalEdge`, `findRelationalChain`.
    - [X] Settle ET-1 to ET-5 with the user (2026-10-29).
- [ ] **Slice 1. Exhaustive terminal discrimination.** Re-derive after the representation is settled ([Paused](#paused-terminal-representation)).
    - [X] Collapse the two `terminalKey` copies into `ephemeraLudicTerminalKey` (`ephemeraMeta.ts`), output unchanged (2026-10-29).
    - [X] `EphemeraLudicRootId` alias on `rootId` (`ephemeraMeta.ts`, `ludicGraph/index.ts`); Slice 2 redefines it as component | port (2026-10-29).
    - [ ] The remaining discrimination work, on the settled representation. (A `matchEphemeraLudicTerminal` fold was built and reverted 2026-10-29.)
    - **`mtw-wml` wire arms:** the class already isolates each arm in small helpers in `keys/edges/ludicEdge.ts` (`terminalFromJSON/ToJSON/Clone/SameKey/ToFormat/Lookup`); adding an arm there is Slice 3 work.
- [ ] **Slice 2. The arm.**
    - [ ] The type and guard (ET-1); `isEphemeraLudicTerminalId` and the edge payload guard accept it.
    - [ ] Equality: two edge terminals are equal iff their ids are; never equal to a component or port.
    - [ ] Add `Justifies` to `HostRelationalEdgeKind` and `STORED_RELATIONAL_EDGE_KINDS`, directional, no label; fix any site that lists kinds by hand (`grep -rn "'ConnectedTo'"`).
    - [ ] Same-graph legality: both `Justifies` terminals are edge terminals; the id is on a stored edge of the same graph, **with no `chainId` (the one temporary v1 check; see Design)**; no other kind may carry an edge terminal; self-reference refused, cycles allowed. Refused at the graph method, with unit tests.
    - [ ] Each Slice 1 site's edge branch, per ET-2.
- [ ] **Slice 3. Lifecycle and payoff.**
    - [ ] Dissolve and prune of a referenced edge remove its referrers in the same apply (ET-3); `healLudicGraphStructure` and the drift sweeps flag a referrer naming a missing id.
    - [ ] Cut, merge and fold keep a referrer with the edge it names, resolved by `edgeId` alone (test: a referrer survives cut then fold unchanged, including when the named edge straddles a bucket).
    - [ ] **Payoff test** (in `invalidationCompleteness.integration.test.ts`, reusing its harness): edge A with an id, a `Justifies` edge B naming A; read B back from the stored row, the cache and the wire graph; dissolve A by structure alone; no edge names a missing id.
- [ ] **Slice 4. Durable docs, then delete this plan.** The terminal comment in `ephemeraMeta.ts`; `positions/AGENT.contract.md` "Edge persist shape"; `ludicGraph/AGENT.md`; `AGENT.implementation.md`; the licence paragraph in `AGENT.edgeAbstractions.planning.md` and SecuredTo's status line; grep inbound links, then delete.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`).
- `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
- After Slice 1: re-run Slice 0's site grep and confirm no terminal is discriminated by a cast or a structural test.
