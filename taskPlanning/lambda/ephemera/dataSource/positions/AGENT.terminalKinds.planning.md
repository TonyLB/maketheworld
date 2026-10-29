# Terminal kinds: name every kind a ludic terminal can be

**Status:** opened 2026-10-29. TK-1 and TK-2 decided 2026-10-29. Slice 0 (inventory) done 2026-10-29. Slice 1 (named kinds and guards) done 2026-10-29. Slice 2 (sites ask by name) done 2026-10-29. TK-3 decided 2026-10-29. Slice 2b (crossing port id prefix) done 2026-10-29; dev-data reset after deploy is pending (user). Slice 3 (cache terminal type) done 2026-10-29. **Next step: Slice 4.** [`AGENT.edgeTerminals.planning.md`](AGENT.edgeTerminals.planning.md) is paused on this plan. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Goal

Give each kind of `EphemeraLudicTerminalId` its own named type and guard. Then every site that asks "what kind of terminal is this" asks it by name, rather than by `typeof === 'string'`, an `'owner' in` test, or a prefix sniff on a value typed only as `string`. **The stored and wire shapes do not change,** with one exception (TK-3): new crossing port ids carry a `PORT-` prefix. The bare presence spelling is a deliberate optimization that roughly halves the data and bandwidth for a very common pattern (user, 2026-10-29), and it stays.

**Payoff:** the edge arm (edgeTerminals ET-1) can be added as one more named kind, and a reader can tell from the types alone which kinds a site handles. That is checkable in two ways. (1) Outside the guards in `ephemeraMeta.ts`, no site discriminates a terminal by representation (the Slice 0 grep comes back empty). (2) Putting a bare presence id on a cache edge is a compile error (TK-2).

## What exists today (checked 2026-10-29)

`EphemeraLudicTerminalId = EphemeraLudicTerminalPrimitive | EphemeraLudicPortAddress` ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) states two arms and carries four kinds:

| Kind | Spelling | Named type today | Told apart by |
| --- | --- | --- | --- |
| Component | `OBJECT#x` (bare) | `EphemeraMembershipHostId` | `isEphemeraLudicNodeTerminal`, then not an own binding (Slice 2) |
| Own binding (a binding named from inside its own graph) | `PRESENCE#x` (bare) | `EphemeraPresenceNodeId` | `isEphemeraLudicNodeTerminal`, then `isEphemeraPresenceNodeId` (Slice 2) |
| Crossing port address | `{ owner, port: <uuid or STUB-...> }` | `EphemeraLudicCrossingPortAddress` (Slice 1) | `isEphemeraLudicCrossingPortAddress` (Slice 2) |
| Binding address (a binding named from outside) | `{ owner, port: 'PRESENCE#x' }` | `EphemeraLudicBindingAddress` (Slice 1) | `isEphemeraLudicBindingAddress` (Slice 2) |

The node arm (component or own binding) is `EphemeraLudicNodeTerminal`, with `isEphemeraLudicNodeTerminal` (Slice 1). Slice 2 renamed every use of the old spelling-name `EphemeraLudicTerminalPrimitive` and deleted it.

Consequences:

- **The address arm's two kinds were unnamed until Slice 1.** The PN-24 comment says the tag "is on the value rather than on a record", because `port` is an opaque `string`. `EphemeraLudicPortAddress` is now the union of the two named kinds, and since Slice 2 every site asks by name. Until Slice 2b, `port` was an unbranded `string`, so a binding address was structurally a crossing port address and a failed crossing check narrowed the binding kind away. Slice 2b (TK-3) made crossing port ids `PORT-`/`STUB-`-prefixed, so the two kinds are disjoint and guard order no longer matters.
- **Cross-kind equality was done by casting until Slice 2.** `ephemeraLudicTerminalsEqual` treats an own binding and a binding address with the same port as equal, scoped by `bareOwner` because `PRESENCE#Base` and `PRESENCE#Unplaced` are not globally unique. It now states that rule as cases over the named kinds, with no casts.
- **The cache's rule is in the type (Slice 3).** The contract makes a bare `PRESENCE#` terminal on a cache edge corruption. `EphemeraLudicCacheEdge` is now `EphemeraLudicRelationalEdgeData<EphemeraLudicCacheTerminalId>` ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)), which excludes the own-binding kind, so a bare presence id there is a compile error. `isEphemeraLudicCacheEdge` keeps the runtime check for stored rows, and `liftPresenceTerminal` ([`mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts)) returns the cache terminal type.
- **Representation tests across the packages** were listed in the [Slice 0 inventory](#slice-0-inventory-plan-only) and replaced in Slice 2.
- **The wire already names the own-binding kind** (`{ presence }`, `mtw-wml` `StandardLudicTerminalData`). Its address arm is as opaque as the ephemera one.

## Design

- **Four named kinds, one union.** Names are provisional; correct them freely:
    - Component terminal: `EphemeraMembershipHostId`, reused.
    - Own-binding terminal: `EphemeraPresenceNodeId`, reused.
    - `EphemeraLudicCrossingPortAddress`: `{ owner; port: EphemeraCrossingPortId }`, where `EphemeraCrossingPortId` is `PORT-${string}` or `STUB-${string}` (TK-3, recorded in the type's comment and the contract). No brand (TK-1); the prefix makes the two address kinds disjoint as types.
    - `EphemeraLudicBindingAddress`: `{ owner; port: EphemeraPresenceNodeId }`.

  `EphemeraLudicPortAddress` stays as the union of the two address kinds, for sites that only need `owner`. The node arm (component or own binding) is `EphemeraLudicNodeTerminal` (inventory finding 1). The node-arm and address guards accept `unknown`, so untyped rows (diagnostics, heal) can use them, and never throw on a stub port id. The component and own-binding guards are the existing `string`-typed id guards, applied after the node-arm guard has narrowed; no site holds an untyped value it needs to sort into those two. `isEphemeraLudicPortAddress` now checks that `owner` is a string, so a malformed row returns false instead of throwing.
- **Representation tests live only inside the guards.** `typeof`, `'owner' in` and the `PRESENCE#` prefix test are the guards' business. Every other site asks for a kind by name and narrows without casts.
- **Equality is a stated rule between named kinds.** Two terminals of the same kind are equal when their fields are equal. An own binding equals a binding address with the same id, and when `bareOwner` is given, only if the address's owner is `bareOwner`. No other pair of kinds is ever equal. This is the existing behavior, spelled as cases rather than casts.
- **No change to stored, cache or wire bytes,** except TK-3's `PORT-` prefix on newly minted crossing port ids. Otherwise only types, guards and how sites branch change. Existing dev rows with bare-uuid crossing ports are not migrated: dev data is reset after Slice 2b deploys (user, 2026-10-29).
- **The edge arm comes afterwards, as a fifth named kind** (`{ edgeId }`, edgeTerminals ET-1), when that plan resumes.

## Relationship to other plans

- **[`AGENT.edgeTerminals.planning.md`](AGENT.edgeTerminals.planning.md)** is paused on this plan ([Paused: terminal representation](AGENT.edgeTerminals.planning.md#paused-terminal-representation)) and re-derives its Slices 1--3 on the named kinds. Its kept pieces (`ephemeraLudicTerminalKey`, the `EphemeraLudicRootId` alias) are inputs here.
- **[`AGENT.securedTo.planning.md`](AGENT.securedTo.planning.md)** waits on edgeTerminals, so it waits on this plan too.

## Getting Started

1. **Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **Graph model:** [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), section 2 (external addressing: ports and legs) and section 4 (presence: a cover, indexed by binding).
3. **The terminal types:** the "Ludic graph edge/port terminals" block in [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), from `EphemeraLudicTerminalPrimitive` through `ephemeraLudicTerminalRefersTo`, including the PN-24 comment on `EphemeraLudicPortAddress` and the `isPresenceTaggedPortId` comment.
4. **The rule being typed:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path), the bullet "Every reference to a binding names its owner, and exterior addressing carries a `PRESENCE#` tag", and the "Base and Unplaced" rules that make fixed ids non-unique.
5. **Immer trap:** `MultiKeyUpdate` reducers run under `produce()`; anything retained past the reducer's return must be a plain copy.
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` sit outside `tsconfig`. Ephemera's ts-jest type-checks tests. `mtw-interfaces`' `tsc -p .` does not include test files, so check any `@ts-expect-error` written there with a standalone `tsc`. Other packages: `npm --prefix packages/mtw-interfaces run test`, `npm --prefix packages/mtw-gateways run test`, `npm --prefix lambda/diagnostics run test`.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`, plus the three package suites. As of 2026-10-29: ephemera 4027 (9 skipped), interfaces 805, gateways 308, diagnostics 161 (after Slice 3).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

No open rows. TK-2 shipped in Slice 3 and is recorded in the contract ("Every reference to a binding names its owner") and `positions/AGENT.implementation.md`.

## Slice 0 inventory (plan only)

Checked 2026-10-29. Swept every non-test file that uses a terminal type (31 files) in `lambda/ephemera`, `lambda/diagnostics`, `packages/mtw-interfaces`, `packages/mtw-gateways` and `packages/mtw-wml`. The sweep read each file's terminal code and also grepped for `typeof ... === 'string'`, `'owner' in`, `isPresenceTaggedPortId(`, `isEphemeraLudicTerminalPrimitive(`, `isEphemeraLudicPortAddress(`, `as EphemeraLudicPortAddress`, `.owner` and `.port`. Kinds: **C** component, **B** own binding, **X** crossing port address, **A** binding address. "Node arm" means C or B.

**R. Representation tests to replace (Slice 2 unless noted).** All replaced in Slice 2 (2026-10-29); the table stays as the record. The re-run grep leaves only the guards in `ephemeraMeta.ts` and the wire-side tests in `wireProjection.ts` (row W).

| Site | Kinds it handles | Test today | Asks instead |
| --- | --- | --- | --- |
| `ephemeraMeta.ts` `ephemeraLudicTerminalOwner` | node arm; X and A alike | `typeof` | node-arm guard, else address |
| `ephemeraMeta.ts` `ephemeraLudicTerminalsEqual` | all four; B vs A is the cross-kind rule | `typeof`, two casts | cases over the four guards (Design) |
| `ephemeraMeta.ts` `ephemeraLudicTerminalKey` | node arm; X and A alike | bare-spelling guard | node-arm guard |
| `wireProjection.ts` `ephemeraTerminalToWire` | C, B, then X and A alike | `typeof`, then `isEphemeraPresenceNodeId` | own-binding guard, component guard, address |
| `connectedToLegality.ts` `describeTerminal` | node arm; X and A alike | `typeof` | `ephemeraLudicTerminalKey` (message text only) |
| `connectedToLegality.ts` `endpointViolation` | C (whole or part); X and A both treated as "a binding" | `typeof` | component guard, binding-address guard; **behavior: finding 3** |
| `findRelationalChain.ts` `resolveEndpoint` | node arm; A; X | bare-spelling guard, then `isPresenceTaggedPortId(terminal.port)` | node-arm, binding-address, crossing guards; already split by kind, only the tests change |
| `findRelationalChainsForRemoval.ts:71` (visit set) | X and A alike (adds the owner's graph) | bare-spelling guard, then `.owner` | address guard |
| `presenceSubGraph.ts:359` (`referencedPortIds`) | X (an A id never matches a port record) | `typeof !== 'string'` | crossing guard; same behavior |
| `presenceParent.ts:112` `connectedToPairsOf` | A owned by the host | address guard and `.owner` | binding-address guard; same behavior once finding 3 refuses X on `ConnectedTo` |
| `lambda/diagnostics` `presenceCoverDriftSweep/classification.ts:37` `ownBindingOf` | A owned by the host, over an untyped row | destructures `owner`/`port` | binding-address guard; it needs the guard to accept `unknown` (Slice 1) |
| `healLudicGraphStructure.ts:84` | any terminal, from an untyped row | `typeof` choosing one arm guard per branch | `isEphemeraLudicTerminalId` |
| `applyStepSequenceCore.ts:40` `hostsOf` | node arm; X and A alike (the owner) | `typeof` | node-arm guard, else address |
| `applyStepSequenceCore.ts:89,94` | node arm | `typeof === 'string'` | node-arm guard |
| `mergeReducer.ts:151` `liftPresenceTerminal` | B | `typeof` plus prefix | own-binding guard; return type narrows in Slice 3 |
| `ludicCache/types.ts:175` `isNotBarePresenceTerminal` | B | `typeof` plus prefix | own-binding guard |
| `expandBoundaryChallenges.ts:24` (a third private terminal key) | node arm; X and A alike, typed `unknown` | `typeof`, then `JSON.stringify` | `ephemeraLudicTerminalKey`. Challenge ids for address terminals change format once, which strands at most an in-flight stored answer (pre-rollout) |
| Seven step-id sites using the bare-spelling guard: `commitAttempt.ts:565`, `computeStepSequenceFootprint.ts:94`, `factsForStep.ts:98`, `repairAdministrativeChainDissolve.ts:47`, `clearCoyoteGameImprovisationObjects.ts:172`, `publishedEvents.ts:147`, `compilePositionKernelOp.ts:58` | node arm vs "a crossing leg"; A falls on the crossing side | `isEphemeraLudicTerminalPrimitive`, plus casts after the test at `:94` and `:58` | node-arm guard, with no casts; comments say "address", not "crossing" (finding 2) |

**Accessors, which are fine as they are.** These go through `ephemeraLudicTerminalOwner`, `Key`, `Equal` or `RefersTo` and never ask for a kind:
- `ludicGraph/index.ts`: 378, 405, 437, 457, 460, 590, 698
- `baseClasses.ts`: 203, 212
- `presenceSubGraph.ts`: 68, 146, 269–316
- `mergeReducer.ts`: 117, the `rewrite`/`outerTerminal` equality calls, 412
- `findRelationalChainsForRemoval.ts:115`
- `expandBoundaryChallenges.ts`: 149, 181
- `healLudicGraphStructure.ts:87`
- gateways `classifyLudicGraphPortMismatch.ts:79`
- `ephemeraMeta.ts`: `isEphemeraLudicTerminalId`, `isEphemeraLudicRelationalEdgeData`, `isEphemeraLudicGraphFieldPayload`'s root check

The remaining terminal-typed files carry types only:
- `buildCrossingLegs.ts`
- `executorTypes.ts`
- `manipulation/types.ts`
- `buildObjectRelationalFact.ts`
- `dryRunStepSequence.ts`
- `commitStepSequence.ts`
- `interactionUnderTransfer.ts`
- `fold.ts`

**Not terminals.** These `typeof node === 'string'` tests are on graph *nodes*, not terminals: gateways `project.ts:51,65`, diagnostics `classification.ts:17`, and `testFixtures.ts`. `wireProjection.ts:65` is on a wire reference.

**W. The wire type (`mtw-wml`), no change needed.** `ludicEdge.ts` already has a named guard per wire arm (`isPortQualifiedTerminal`, `isPresenceTerminal`). Its address arm `{ owner, port: string }` carries X and A, but every site on it (`toJSON`, `clone`, `toFormat`, `lookup`, equality) copies `port` through without asking which kind it is. `wireProjection.ts` `wireTerminalToEphemera` tests the wire union with `'presence' in` and `'owner' in`. That tests the wire type, not `EphemeraLudicTerminalId`. Slice 2 may make it use the wml guards if they are exported, and leaves it alone otherwise.

**TK-2 blast radius.**
- **Producers of cache-edge terminals:**
    - `mergeReducer.ts`: `foldSameHostBuckets`, which lifts both ends; `collapseCrossingPorts`, which lifts the child's outer end only; `collapseSameHostStubs`; `dedupeEdgesByIdentity`; `collapsedEdgeIdentityKey`
    - `fold.ts`, which concatenates and dedupes
- **Consumers:**
    - `ludicCache/types.ts` `isEphemeraLudicCacheEdge`, the guard
    - `store.ts`, which persists
- **No production code reads cache edges.** `catalogHandles.ts` deliberately never reads `edges`, and `roomObjectContents.ts` reads nodes only. Narrowing the type therefore costs nothing at the read side.
- **Seams that need the generic:**
    - `HostRelationalEdge` (`ludicGraph/baseClasses.ts`), the third copy of the edge shape
    - `toStoredRelationalEdge`, through which every collapse builds its output
    - the local `rewrite` and `outerTerminal` helpers, which return `EphemeraLudicTerminalId`
- **The type exposed two producers that did not lift (finding 4), fixed in Slice 3.**

**Findings.**

1. **The node arm needs a name.** The two-arm union is honest at one level: a node named directly versus a slot named through an owner. Only the bare-spelling guard's name hides that. Slice 1 adds a node-arm guard (`isEphemeraLudicNodeTerminal`: component or own binding) beside the address union. **Resolved in Slice 2:** every site uses it, and the old name is gone.
2. **A binding address falls into "crossing" branches.** `extendSteps.ts` writes an `establishRelation` step whose two ends are binding addresses (a `ConnectedTo` between two of the object's own bindings). At the step sites that step is handled as a crossing leg:
    - `computeStepSequenceFootprint` locks `step.hostId`. That is correct, because the owner is the host.
    - `factsForStep` yields **no fact**.
    - `commitAttempt` records no host for it.
    - `compilePositionKernelOp` would skip it, but no producer passes `dissolvedEdges` today.

   Slice 2 keeps this behavior: it uses the address guard (X or A) and corrects the comments. **Resolved in Slice 2** (comments say "address end"). Whether these edges should yield a fact is not a terminal question; it is shelved in [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) "Shelved: a whole's own topology edges emit no relation fact".
3. **`endpointViolation` disagrees with its stated rule** (contract: an endpoint is "the whole itself, one of its bindings, or a part of it"):
    - It accepts **any** address owned by the host, including a crossing port address, as "a binding".
    - It refuses an own binding spelled bare, because `hostingKindOf('PRESENCE#x')` is undefined, so the binding is reported as "not a part".

   Naming the kinds forces both cases into the open. Slice 2 follows the stated rule: it refuses X, accepts B and A, and tests each. This is forkless, because the rule already decides it. `extendSteps` writes A, so no current producer changes. **Resolved in Slice 2:** `endpointViolation` refuses X and accepts B and A, with tests; `connectedToPairsOf` and diagnostics' `ownBindingOf` read only A, so both sides of the drift comparison agree.
4. **Two collapses mint cache edges they do not lift.**
    - `collapseCrossingPorts` lifts the child leg's outer end, but passes the parent leg's other end through unchanged. If that end is the parent's own binding spelled bare, it reaches the cache bare. Today only the runtime guard catches that.
    - `collapseSameHostStubs` (a test-only probe; production uses `mergeSameHostBucket` through `foldSameHostBuckets`) lifts neither end.

   Under TK-2 (a), both become compile errors. Slice 3 lifts the parent end with the parent's host as owner, and either lifts in `collapseSameHostStubs` or deletes that function if it has no remaining caller. This is a forkless consequence of TK-2. **Resolved in Slice 3:** `collapseCrossingPorts` lifts the parent leg's other end (owner `parentGraph.hostId`), with a test that fails on the old code. `collapseSameHostStubs` had only test callers and was deleted; its disagreeing-legs and unmatched-stub cases moved to `mergeSameHostBucket`'s tests.

## Progress

| Slice | State |
| --- | --- |
| 0. Inventory (no code) | Done 2026-10-29. 18 R rows (7 of them as one step-id group), 4 findings, no wire change, cache edges have no production reader. |
| 1. Named kinds and guards (types only, no site changes) | Done 2026-10-29. `EphemeraLudicNodeTerminal` / `isEphemeraLudicNodeTerminal`, `EphemeraLudicCrossingPortAddress` / `isEphemeraLudicCrossingPortAddress`, `EphemeraLudicBindingAddress` / `isEphemeraLudicBindingAddress`; `EphemeraLudicPortAddress` is their union. Interfaces 776 → 805 (guard tests and a partition test); ephemera, gateways and diagnostics unchanged. TK-1 shipped. |
| 2. Sites ask by name; equality as cases | Done 2026-10-29. Every R row migrated; equality and owner are cases over the kinds; `endpointViolation` follows its rule (finding 3); `EphemeraLudicTerminalPrimitive` renamed at every site and deleted; address-ended challenge ids now use `ephemeraLudicTerminalKey`. Ephemera 4018 → 4023 (9 skipped; `endpointViolation`, `connectedToPairsOf` and challenge-key tests); interfaces 805 → 797 (a duplicate node-guard describe merged); gateways 308 and diagnostics 161 unchanged (diagnostics' existing test gained a crossing-port edge). |
| 2b. Crossing port id prefix (TK-3) | Done 2026-10-29; **dev-data reset after deploy pending (user)**. `EphemeraCrossingPortId` and `isEphemeraCrossingPortId`; `isEphemeraLudicPortAddress` is exactly crossing or binding, so an unprefixed port id is no terminal; `buildCrossingLegs` mints `PORT-${uuid}`; `wireProjection.ts` sorts wire port ids and throws on any other kind; `removeCrossingPort.portId` and `removePort` take the new type. The type caught one real mistyping: `resolvePresenceMoves` built binding addresses from `ConnectedToPair`'s plain strings, so the contraction types in mtw-gateways `siblingContraction.ts` became generic over the binding key (`string` default). Ephemera 4023 → 4026 (wire bare-port test, type-level disjointness tests); interfaces 797 → 805 (legacy-shape, `isEphemeraCrossingPortId` and port-record tests); gateways 308 and diagnostics 161 unchanged. About 230 fixture literals moved to `PORT-…`. |
| 3. Cache terminal type (TK-2) | Done 2026-10-29. `EphemeraLudicCacheTerminalId` / `isEphemeraLudicCacheTerminalId`; `EphemeraLudicRelationalEdgeData<T>` and `HostRelationalEdge<T>` generic over the terminal type (default: every kind), `toStoredRelationalEdge` generic; `EphemeraLudicCacheEdge` on the cache terminal type; `liftPresenceTerminal` returns it; `isNotBarePresenceTerminal` deleted. Finding 4 fixed: `collapseCrossingPorts` lifts the parent leg's other end. `collapseSameHostStubs` deleted (test-only caller); two of its cases ported to `mergeSameHostBucket`. Compile-time test (`@ts-expect-error`) that a bare presence id is refused on a cache edge. Ephemera 4026 → 4027 (5 removed with `collapseSameHostStubs`, 6 added); interfaces 805, gateways 308 and diagnostics 161 unchanged. |
| 4. Durable docs; edgeTerminals resumes; plan deleted | |

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0. Inventory, no code.**
    - [X] Grep `lambda/ephemera`, `lambda/diagnostics`, `packages/mtw-interfaces`, `packages/mtw-gateways` (non-test) for representation tests on terminals: `typeof .* === 'string'` on a terminal, `'owner' in`, `isPresenceTaggedPortId(`, `isEphemeraPresenceNodeId(` on a terminal or port, `as EphemeraLudicPortAddress`, and `.port` reads. For each site, record which kinds it handles and which named guard replaces its test.
    - [X] List the producers and consumers of cache-edge terminals (TK-2's blast radius).
    - [X] Settle TK-1 with the user (2026-10-29: named runtime guards, no brand).
    - [X] Settle TK-2 with the user (2026-10-29: a cache terminal type, edge types generic over it).
- [X] **Slice 1. Named kinds and guards.** In `ephemeraMeta.ts`: the two address types, one guard per kind (the address guards test the `PRESENCE#` tag, TK-1), `EphemeraLudicPortAddress` as their union, and a node-arm guard (component or own binding, finding 1). The guards accept `unknown`, as `isEphemeraLudicPortAddress` does, so untyped rows (diagnostics, heal) can use them. Fix the stale `isEphemeraPresenceNodeId(port)` comment. Unit tests for each guard, including stub ids and fixed presence ids. No site changes; the suite stays green unaltered.
- [X] **Slice 2. Sites ask by name.**
    - [X] `ephemeraLudicTerminalsEqual` and `ephemeraLudicTerminalOwner` as cases over named kinds, with no casts. The existing equality tests pass unchanged.
    - [X] Migrate every Slice 0 R row to the named guards; the step-id group drops its casts and its "crossing" comments (finding 2, behavior kept). `ephemeraLudicTerminalKey` stays byte-identical, and `expandBoundaryChallenges.ts`'s private key is replaced by it.
    - [X] `endpointViolation` follows its stated rule: refuse a crossing port address, accept an own binding in either spelling, with a test for each (finding 3).
    - [X] Rename `EphemeraLudicTerminalPrimitive` / `isEphemeraLudicTerminalPrimitive` to `EphemeraLudicNodeTerminal` / `isEphemeraLudicNodeTerminal` at every site and test (71 type uses in 24 files, 40 guard calls), then delete the two aliases.
    - [X] Re-run the Slice 0 grep: it comes back empty outside the guards.
- [ ] **Slice 2b. Crossing port id prefix** (TK-3). Code done 2026-10-29; only the dev-data reset remains.
    - [X] `EphemeraCrossingPortId` and its prefix guard in `ephemeraMeta.ts`; `EphemeraLudicCrossingPortAddress.port` and `EphemeraCrossingPort.portId` use it; `isEphemeraLudicCrossingPortAddress` and `isEphemeraLudicGraphPort` test the prefix.
    - [X] Mint through one function in `buildCrossingLegs`; `stubPortIdFromEdge` declares its return type; `wireTerminalToEphemera` classifies the wire port by prefix.
    - [X] A type-level test (in ephemera) that the two address kinds are disjoint: after a failed crossing check, the binding kind survives.
    - [X] Test fixtures: fake crossing ids become `PORT-...` (string edits, no helper or cast).
    - [X] Contract line ~642 and the PN-24 comment: a crossing port carries a `PORT-`-prefixed minted uuid; TK-1's "unbranded `string`" wording becomes the pattern type.
    - [ ] After deploy: reset dev data (no migration). The user does this; until then, legacy bare-uuid rows fail the payload guard.
- [X] **Slice 3. Cache terminal type** (TK-2).
    - [X] `EphemeraLudicCacheTerminalId` and its guard; `EphemeraLudicCacheEdge` on it; the edge types and `toStoredRelationalEdge` generic over the terminal type; `liftPresenceTerminal` returns it.
    - [X] Lift the parent leg's other end in `collapseCrossingPorts` (finding 4), with a test.
    - [X] Delete `collapseSameHostStubs` (test-only caller), porting its uncovered cases to `mergeSameHostBucket`.
    - [X] Compile-time test (in ephemera, whose tests are type-checked) that a bare presence id is refused on a cache edge.
    - [X] Contract bullet, `positions/AGENT.implementation.md` and `ludicGraph/AGENT.md` updated.
- [ ] **Slice 4. Durable docs, then delete this plan.**
    - [ ] Update the terminal comment block in `ephemeraMeta.ts` to describe the four named kinds.
    - [ ] Add a rule to `positions/AGENT.contract.md`: discriminate terminals only through the named guards.
    - [ ] Update the vocabulary table in `AGENT.ludicNetwork.md` if the kind names are new vocabulary there.
    - [ ] Update `ludicGraph/AGENT.md`.
    - [ ] Move edgeTerminals' status off Paused.
    - [ ] Grep for inbound links to this plan, then delete it.

## Verification

- From `lambda/ephemera/`: `npm run test -- --watchAll=false` (the full suite, because integration tests sit outside `tsconfig`), and `npx tsc --noEmit`.
- `npm --prefix packages/mtw-interfaces run test` and `npx tsc --noEmit -p .` there; `npm --prefix packages/mtw-gateways run test`; `npm --prefix lambda/diagnostics run test`.
- After Slice 2: the Slice 0 grep is empty outside the guards in `ephemeraMeta.ts`.
