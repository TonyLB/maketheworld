# Positions DataSource Planning (`mtw.ephemera.positions`)

**Status:** In progress. **Slice 0 shipped.** **Durable docs landed.** Fan-in **Phase 0 shipped** (framework in `mtw-lambda-patterns`). **Next:** **slice 1a** --- membership persistence boundary (unblocked). **Slice 1b** --- membership **emission** (blocked on fan-in **Phase 1** only). Model A **beat orchestration** may land in **1a** without fan-in. **Slice 2** swaps persistence to `Meta::Room` play `positionGraph`. See [Migration strategy](#migration-strategy-routing-first).

## Purpose

Track the initiative to grow `mtw.ephemera.positions` into ephemera's authority for **positions in play**, from slice 0 presence ingress through localized execution, graph-shaped storage, and long-term nested placement.

**Dispose this file** when the initiative completes. Steady-state truth lives in [`lambda/ephemera/dataSource/positions/`](../../../../../../lambda/ephemera/dataSource/positions/) siblings (not here).

**Open implementation decisions** stay in [**Open decisions**](#open-decisions-implementation--plan-only) below until merged; do not copy forks into [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) ([`taskPlanning/AGENT.md`](../../../../AGENT.md#open-decisions-implementation--plan-only)).

## Durable documentation (read first)

| Doc | Role |
| --- | --- |
| [`positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md) | Package entry |
| [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) | Shipped vs **target** mental models (domain vocabulary only) |
| [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Normative rules **enforced today** |
| [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) | Slice 0 code map |
| [`positions/AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md) | Cross-area links |

**Do not** duplicate concepts or contracts in this task plan --- link and track **graduation** (concepts: Target -> Shipped for **mental models** only; contract + implementation when a slice ships; remove rows from **Open decisions**).

## Getting started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- durability ladder; task plan vs package docs
2. [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- domain mental models (fractal graphs, membership vs topology)
3. [Migration strategy](#migration-strategy-routing-first) below --- **membership persistence boundary**, storage swap, read surfaces
4. [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- what is binding now
5. [`lambda/ephemera/dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md) --- DataSource index

## Initiative scope (summary)

| In scope | Out of scope (separate tracks) |
| --- | --- |
| Character play position; localized execution; `Meta::Room` play graph; graph-shaped storage over time | WML Position facet x/y overhaul ([`AGENT.positionSubsystemOverhaul.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)) |
| Graduating concepts into contract as slices land | Area **authored** topology authoring UI (Workbench AreaEdit) |
| Slice **1a** persistence boundary (may use legacy PerceptionThreads for header render; Model A beat anchor optional here) | Generic DataSource fan-in framework ([`AGENT.fanInPattern.planning.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md) --- Phase 0 shipped; slice **1b emission** depends on Phase 1) |

Full boundaries: [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), [`positions/AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md).

## Cross-initiative dependencies

**Two presentation concerns (decoupled):** see [Presentation model](#presentation-model-beat-vs-emission) and [`AGENT.fanInPattern.planning.md` --- Beat orchestration vs emission correlation](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md#beat-orchestration-vs-emission-correlation). Transcript vocabulary: [`AGENT.narrativeTranscript.concepts.md`](../../../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md).

**Slice 1a (persistence boundary) is not blocked by fan-in** --- but **preferred order** (per **S1-2**): complete fan-in Phase 0 + Phase 1 first, then land slice 1 **without** interim imperative leave/arrive (persistence + `Character Moved` + fan-in emission together). Header render stays on legacy [`PerceptionThreads`](../../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) / [`moveCharacter`](../../../../../../lambda/ephemera/moveCharacter/index.ts) targeting through fan-in Phase 2. **Model A**: stamp **`beatAnchorTime`** at position-move **fact** time (persistence apply; fan-in **F1-4**) --- independent of fan-in framework.

**Slice 1b (emission)** --- positions streams membership **fact** (authoritative **`characterId` / `from` / `to`** per fan-in **F1-1**; **legal exits** on fact for exit-aware copy per **S1-1**); **`mtw.ephemera.actions`** streams navigate/home/teleport **intent**; **`mtw.connections.characters`** streams connect/disconnect **intent** (**F1-5**); **[`mtw.ephemera.perception`](../../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** fan-in consumer (**F1-6**) builds emission plan and publishes **after** correlation --- **blocked** until fan-in **Phase 1** (Phase 0 framework shipped). With **S1-2** ordering, 1b ships in the **same slice 1 PR** as persistence, not a follow-on. Does **not** own header Generating/terminal lifecycle.

## Presentation model (beat vs emission)

| Layer | When | What |
| --- | --- | --- |
| **Beat orchestration (Model A)** | Position-move **fact** at persistence apply | **`beatAnchorTime`** = fact recorded time (**F1-4**); header **`MessageId`**, targets; leave at `anchor - epsilon`, header at `anchor`, arrive at `anchor + epsilon`; header publish async when render ready |
| **Emission correlation (fan-in)** | After intent + fact correlate (or fact-only at settle) | Partial clusters + **unify**; fact-authoritative identity (**F1-1**). **Shape:** leave+arrive vs arrive-only (connect) vs leave-only (disconnect). **Copy:** exit-aware / home / connect / generic. Intent: actions (**F1-2**) + connections connect/disconnect (**F1-5**). Consumer: **[`mtw.ephemera.perception`](../../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** (**F1-6**). Then **`PublishMessage`** world lines --- not before correlation |

Connect/disconnect: usually **singleton** world line (no three-part beat); session orientation header on connect stays on existing Character Registered path.

**Post-move side effects (decoupled from fan-in; see fan-in **F3-2**):**

| Concern | Audience | This initiative |
| --- | --- | --- |
| Mover arrival **render header** | Mover only | Slim **`characterMove`** PerceptionThread + render kick (optional UUID **`requestId`** for orchestrate match) |
| **Affordance refresh** ("who is here?", exits, ...) | All occupants in affected room(s) | Keep separate affordance kick (today **`RoomUpdate`** from persistence apply). **Deferred:** general **`Object Moved`** (or similar) consumer on **`mtw.ephemera.positions`** |

## Migration strategy (routing-first)

**Option B (chosen):** localize **processing** first on **legacy storage**, then swap the persistence implementation to room play `positionGraph`.

| Phase | Slice | What changes | What stays stable |
| --- | --- | --- | --- |
| **Localize execution** | **1** (+ finish **0** disconnect alignment) | Ingress (`Character Navigate`), orchestration (perception threads, `RoomUpdate`, caches), **single membership persistence API**; optional **`mtw-gateways` read surface** (see S1-5) | Dynamo still uses `activeCharacters`, `RoomId`, `RoomStack`; readers may stay on `RoomCharacterList` until S1-5 / slice 2 |
| **Storage swap** | **2** | `Meta::Room.positionGraph` (play graph), persistence API implementation, dual-write or graph + `activeCharacters` projection; **swap read gateway** projection if not done in slice 1 | Orchestration and ingress paths from slice 1 |
| **Unify ingress** | **3** | Connect path through same API (retire `CheckLocation` bridge) | --- |
| **Legacy cleanup** | **4** | `disconnectMessage`, `Disconnect Character` ingress | --- |
| **Richer graphs** | **5+** | In-room edges, objects in graph, inventory subgraphs, stream outbounds | --- |

**Slice 1 success criterion (not optional):** every character **room-membership** mutation (disconnect today; navigate after slice 1; connect after slice 3) goes through **one** positions-owned **membership persistence boundary** --- even though slice 1 still writes flat fields. Slice 2 then rewrites **only that module**, not every `optimisticUpdate` caller across the lambda.

Thin routing (`subscribe -> publish MoveCharacter` to legacy handler) **does not** satisfy slice 1.

## Slice sequence (implementation)

| Slice | Goal | Doc graduation |
| --- | --- | --- |
| **0** (done) | `mtw.connections.characters` presence ingress | Contract + implementation + concepts Shipped |
| **1a** | Localize membership **execution**: persistence API, `Character Navigate` -> positions, disconnect refactor; optional Model A beat anchor; legacy header render + imperative world copy OK | Contract + implementation |
| **1b** | Membership **emission**: intent + fact fan-in (shape + copy); stream **`Character Moved`** (and connect/disconnect facts); publish world lines after correlation; retire imperative suppress/copy on `MoveCharacter` | Contract + implementation; coordinates with fan-in Phase 1--2 |
| **2** | **`Meta::Room` play `positionGraph`** schema; swap persistence API to graph (+ projection / dual-write to `activeCharacters`) | Contract; concepts Target -> Shipped for room play graph (character nodes) |
| **3** | Unify **connect** through membership API (retire `CheckLocation` bridge) | Contract + implementation |
| **4** | Retire `disconnectMessage` / legacy `Disconnect Character` | Contract; slim parent event docs |
| **5+** | In-room edges, object placement in graph, container graphs, stream outbounds | Concepts + contract as each lands |

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making **in order to implement** the next slice(s). Do **not** copy into [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md). When a decision ships, record it in [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) / [`AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and **remove** the row here. Convention: [`taskPlanning/AGENT.md`](../../../../AGENT.md#open-decisions-implementation--plan-only).

### Slice 1

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| S1-1 | On navigate execute: **trust** actions exit resolution (`toRoomId`) vs **re-validate** topology in positions | 1 | **Decided:** trust --- positions applies the validated `toRoomId`; no topology re-check at persistence apply. Fan-in exit-aware copy still uses **legal exits on the `Character Moved` fact** (read at emit time), not a second gate on the move. |
| S1-2 | Cross-room side effects: **1a** --- legacy header render (`PerceptionThreads` / kick render) + optional **Model A** `beatAnchorTime`; imperative leave/arrive until **1b** fan-in emission. **1b** --- fan-in emission policy ([`AGENT.fanInPattern.planning.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md)). Conversations fragment handoff: [`conversations/AGENT.planning.md`](../../../../../../lambda/ephemera/conversations/AGENT.planning.md) | 1a / 1b | **Decided:** sequencing milestones, not an either/or fork. **Beat/header (Model A + slim `characterMove` targeting)** stays independent of fan-in. With **fan-in Phase 0 + 1 before positions slice 1**, skip building interim imperative leave/arrive --- land persistence boundary together with `Character Moved` + fan-in emission (no separate 1a-then-1b copy path). Header render remains legacy PerceptionThreads through fan-in Phase 2. |
| S1-3 | Slice 1 egress: **bus-only** vs positions **stream outbound** for navigate | 1 | **Decided:** positions **`streamEvent`** outbound on `mtw.ephemera.positions` (`publisherStrategy: 'busOnly'`); types in [`publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts). Same net delivery as bus-only today --- difference is **scope-of-authority** (positions owns the stream contract). |
| S1-4 | Module layout for **membership persistence boundary** (e.g. `applyCharacterRoomMembership` vs split orchestration / persistence files) | 1 | Open |
| S1-5 | **`mtw-gateways` positions read surface** (roster projection from play state): land in **slice 1** (v1 projects `activeCharacters`; wire [`AffordanceRoomDeliverable`](../../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) via `internalCache`) vs **slice 2** (paired with `positionGraph` storage swap only) | 1 | **Decided:** first read surface returns **`positionGraph` for a component** (Room or Character v1; future Features/Objects). Land in **slice 1** with a **projection adapter** from legacy flat fields until slice 2 storage swap; register on `internalCache`; point affordance roster reads at the handler (not raw `ephemeraDB`). Roster is a **projection** of the graph, not the primary gateway shape. |

**S1-5 context:** Today affordance compose reads roster via [`RoomCharacterList`](../../../../../../lambda/ephemera/internalCache/roomCharacterLists.ts) (direct `ephemeraDB` `activeCharacters` on miss), while exits use gateway-backed [`AffordanceCache`](../../../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) + [`ComponentTopology`](../../../../../../packages/mtw-gateways/ts/assets/components/componentTopology/). Target: **`createPositionsCacheHandler`** (name TBD) returns graph-shaped play state per component id; slice 1 implementation **projects** character nodes from `RoomId` / `activeCharacters`; slice 2 swaps the backing read to stored `Meta::Room.positionGraph` without changing the handler API. **Authoritative writer** = positions persistence API; **steady-state readers** = `internalCache` ([`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md), [`internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)).

### Slice 2 (decide before slice 2 PR; may spike during slice 1)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| S2-1 | **Play-only** `positionGraph` on `Meta::Room` (ephemera Dynamo) vs also **WML `StandardRoom.positionGraph`** in same slice | 2 | **Decided:** slice 2 adds **play-only** `Meta::Room.positionGraph` only. WML / asset **blueprint** placement (e.g. Objects, Characters assigned to rooms) is a **starting position** to prime play; in-play positions are expected to **diverge**. Reconciling a later blueprint change against current play --- **deferred** to later iterations. |
| S2-2 | **Dual-write** (`positionGraph` + `activeCharacters`) vs **graph-primary** with synchronous projection to `activeCharacters` for affordance readers | 2 | **Decided:** **graph-primary**; synchronous projection to `activeCharacters` (or gateway-derived roster projection) as a **migration bridge** until readers migrate off the stored roster field. |
| S2-3 | Slice 2 graph **v1**: character **nodes only** (no in-room edges) vs wait for edge types | 2 | **Decided:** character **nodes only** in slice 2 v1 (no in-room edges). |

For a long option comparison on any row, add a root [**temporary analysis**](../../../../../../AGENT.md#temporary-working-documents) doc and link it from the table (do not bloat concepts).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [X] **Phase 0 --- document before further implementation**
  - [X] Create [`positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md) entry + sibling links
  - [X] Draft [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (Shipped vs Target; graduation rule)
  - [X] Draft [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (slice 0 only)
  - [X] Draft [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) + [`AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md)
  - [X] Slim this task plan to process + slices (link out architecture)
  - [X] Point parent [`dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md) and [`lambda/ephemera/AGENT.md`](../../../../../../lambda/ephemera/AGENT.md) at package docs

- [X] **Slice 0 --- presence ingress (code)**
  - [X] DataSource skeleton + `mtw.connections.characters` subscribe
  - [X] Disconnect handler + connect bridge
  - [X] Unit tests

- [ ] **Slice 1a --- persistence boundary (legacy storage; unblocked)**
  - [X] Resolve **Open decisions** S1-1, S1-2, S1-3, S1-5 (**S1-4** still open)
  - [ ] Introduce **membership persistence boundary** (single API; slice 1 impl still writes `activeCharacters` / `RoomId` / `RoomStack`)
  - [ ] Refactor **disconnect** handler to call persistence API (not inline `optimisticUpdate`)
  - [ ] Extract move **orchestration** from `moveCharacter`; wire navigate through persistence API
  - [ ] Optional **Model A**: at persistence apply, stamp **`beatAnchorTime`** from **fact** recorded time + header **`MessageId`**; publish with explicit **`createdTime`** (leave/arrive via fan-in emission per **S1-2**)
  - [ ] Subscribe positions to `Character Navigate`; remove imperative `MoveCharacter` from actions
  - [ ] Grep: no new direct `Meta::Room.activeCharacters` writes outside persistence API + documented exceptions
  - [ ] Add `mtw-gateways/ts/ephemera/positions/` read surface (v1: **`positionGraph`** API; slice 1 adapter projects from flat fields); register on `internalCache`; point **`AffordanceRoomDeliverable`** roster path (and memo `set`/`invalidate` from persistence API) at handler --- not raw `ephemeraDB` in compose path
  - [ ] Graduate docs: contract + implementation for persistence path; clear resolved Open decision rows
  - [ ] Parity tests (actions, moveCharacter, positions disconnect + navigate; affordance deliverable if S1-5 = slice 1a)

- [ ] **Slice 1b --- membership emission (prefer fan-in Phase 1 **before** slice 1a; then ship with slice 1 per **S1-2**)**
  - [ ] [`AGENT.fanInPattern.planning.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md) Phase 1 complete in **[`mtw.ephemera.perception`](../../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** (Phase 0 framework shipped; may use synthetic legs in tests before persistence API exists)
  - [ ] Positions stream **`Character Moved`** after persistence API apply (navigate, connect, disconnect; authoritative `from`/`to` per **F1-1**; **legal exits** on fact for emission; payload in **`publishedEvents.ts`** per **F1-3**)
  - [ ] Perception: **`MembershipPresentationFanInCluster`** + **`FanInClusterStore`** on **`ephemeraPerceptionDataSource`** (**F1-6**); subscribe to actions + connections intent legs
  - [ ] Fan-in **`onComplete`**: emission plan (leave+arrive vs singleton) + copy; publish world lines **after** correlation with Model A times
  - [ ] Fan-in **`onDeferredIncomplete`**: shape from fact endpoints + generic copy
  - [ ] Cross-room: register slim **`characterMove`** header targeting (mover); affordance kick for room occupants separately (**F3-2**; keep **`RoomUpdate`** path for now)
  - [ ] Retire imperative `suppressDeparture` / `suppressArrival` / pre-baked messages on `MoveCharacter`; retire `characterMove` leave/arrive gating on render events (fan-in Phase 2)
  - [ ] Graduate docs + tests: cross-room, connect, disconnect, exit-aware, deferral generic

- [ ] **Slice 2 --- `Meta::Room` play `positionGraph` (storage swap)**
  - [X] Resolve **Open decisions** S2-1 through S2-3
  - [ ] Add `positionGraph` (or agreed shape) to [`EphemeraMetaRoom`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)
  - [ ] Reimplement persistence API against play graph (+ projection / dual-write per S2-2)
  - [ ] If **S1-5 = slice 2**: add positions read gateway + affordance wire-up here; else **swap gateway projection** to read graph / project roster
  - [ ] Graduate concepts (room play graph, character-as-node) + contract + implementation

- [ ] **Slice 3 --- unify connect**
  - [ ] Route `Character Connected` through membership API (retire `CheckLocation` bridge)
  - [ ] Graduate contract + implementation

- [ ] **Slice 4 --- legacy disconnect retirement**
  - [ ] Remove `disconnectMessage` overlap; retire `Disconnect Character` ingress
  - [ ] Integration test for positions receive paths

- [ ] **Slice 5+ --- richer graphs** (track in plan when slice 4 nears completion)
  - [ ] In-room edges, object nodes, container graphs (separate planning rows as needed)

- [ ] **Close initiative**
  - [ ] Run verification matrix
  - [ ] Slim bridge notes in [`actions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
  - [ ] Delete this planning file

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/actions/index.test.ts \
  moveCharacter/index.test.ts
```

**Slice 1a gate:** navigate -> positions tests; actions tests without imperative `MoveCharacter`; disconnect tests still pass after persistence API refactor.

**Slice 1b gate:** fan-in emission tests --- cross-room leave+arrive with exit-aware copy when intent correlates; connect arrive-only; disconnect leave-only; generic copy at deferral when intent absent; world lines use Model A anchor times.

**Slice 2 gate:** persistence API tests against `positionGraph` + projection invariants; affordance/roster smoke paths unchanged for players.

---

## Progress

| Milestone | Status |
| --- | --- |
| Slice 0 code | Done |
| Phase 0 durable docs | Done |
| Slice 1a: persistence boundary | Not started |
| Slice 1b: membership emission (fan-in) | Blocked on fan-in Phase 1 |
| Slice 2: `Meta::Room` play graph storage swap | Not started |
| Slice 3--4: connect unify + legacy retirement | Not started |
| Initiative close | Not started |
