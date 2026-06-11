# Positions DataSource Planning (`mtw.ephemera.positions`)

**Status:** In progress. **Slice 0 shipped.** **Durable docs landed.** Next: **slice 1** --- localize **all character room-membership execution** behind one persistence boundary (still writing legacy `activeCharacters` / `RoomId` fields). **Slice 2** swaps that boundary to `Meta::Room` play `positionGraph` (+ projection). See [Migration strategy](#migration-strategy-routing-first).

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

Full boundaries: [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), [`positions/AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md).

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
| **1** | Localize membership **execution**: `Character Navigate`, shared persistence API, orchestration; retire imperative `MoveCharacter` from actions; **refactor disconnect** onto same API | Contract + implementation |
| **2** | **`Meta::Room` play `positionGraph`** schema; swap persistence API to graph (+ projection / dual-write to `activeCharacters`) | Contract; concepts Target -> Shipped for room play graph (character nodes) |
| **3** | Unify **connect** through membership API (retire `CheckLocation` bridge) | Contract + implementation |
| **4** | Retire `disconnectMessage` / legacy `Disconnect Character` | Contract; slim parent event docs |
| **5+** | In-room edges, object placement in graph, container graphs, stream outbounds | Concepts + contract as each lands |

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making **in order to implement** the next slice(s). Do **not** copy into [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md). When a decision ships, record it in [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) / [`AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and **remove** the row here. Convention: [`taskPlanning/AGENT.md`](../../../../AGENT.md#open-decisions-implementation--plan-only).

### Slice 1

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| S1-1 | On navigate execute: **trust** actions exit resolution (`toRoomId`) vs **re-validate** topology in positions | 1 | Open |
| S1-2 | Cross-room move side effects: keep **`PerceptionThreads` / `characterMove`** vs conversations fragment handoff ([`conversations/AGENT.planning.md`](../../../../../../lambda/ephemera/conversations/AGENT.planning.md)) | 1 | Open |
| S1-3 | Slice 1 egress: **bus-only** vs positions **stream outbound** for navigate | 1 | Open |
| S1-4 | Module layout for **membership persistence boundary** (e.g. `applyCharacterRoomMembership` vs split orchestration / persistence files) | 1 | Open |
| S1-5 | **`mtw-gateways` positions read surface** (roster projection from play state): land in **slice 1** (v1 projects `activeCharacters`; wire [`AffordanceRoomDeliverable`](../../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) via `internalCache`) vs **slice 2** (paired with `positionGraph` storage swap only) | 1 | Open |

**S1-5 context:** Today affordance compose reads roster via [`RoomCharacterList`](../../../../../../lambda/ephemera/internalCache/roomCharacterLists.ts) (direct `ephemeraDB` `activeCharacters` on miss), while exits use gateway-backed [`AffordanceCache`](../../../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) + [`ComponentTopology`](../../../../../../packages/mtw-gateways/ts/assets/components/componentTopology/). A positions read handler mirrors that pattern: **authoritative writer** = positions persistence API; **steady-state readers** = `create*CacheHandler` on `internalCache` ([`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md), [`internalCache/AGENT.md`](../../../../../../lambda/ephemera/internalCache/AGENT.md)). Slice 1 gateway is optional for parity but reduces slice 2 blast radius if affordance already depends on the read surface.

### Slice 2 (decide before slice 2 PR; may spike during slice 1)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| S2-1 | **Play-only** `positionGraph` on `Meta::Room` (ephemera Dynamo) vs also **WML `StandardRoom.positionGraph`** in same slice | 2 | Open |
| S2-2 | **Dual-write** (`positionGraph` + `activeCharacters`) vs **graph-primary** with synchronous projection to `activeCharacters` for affordance readers | 2 | Open |
| S2-3 | Slice 2 graph **v1**: character **nodes only** (no in-room edges) vs wait for edge types | 2 | Open |

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

- [ ] **Slice 1 --- localize membership execution (legacy storage)**
  - [ ] Resolve **Open decisions** S1-1 through S1-5
  - [ ] Introduce **membership persistence boundary** (single API; slice 1 impl still writes `activeCharacters` / `RoomId` / `RoomStack`)
  - [ ] Refactor **disconnect** handler to call persistence API (not inline `optimisticUpdate`)
  - [ ] Extract move **orchestration** from `moveCharacter`; wire navigate through persistence API
  - [ ] Subscribe positions to `Character Navigate`; remove imperative `MoveCharacter` from actions
  - [ ] Grep: no new direct `Meta::Room.activeCharacters` writes outside persistence API + documented exceptions
  - [ ] If **S1-5 = slice 1**: add `mtw-gateways/ts/ephemera/positions/` read surface (v1: project `activeCharacters`); register on `internalCache`; point **`AffordanceRoomDeliverable`** (and memo `set`/`invalidate` from persistence API) at handler --- not raw `ephemeraDB` in compose path
  - [ ] Graduate docs: contract + implementation; clear resolved Open decision rows
  - [ ] Parity tests (actions, moveCharacter, positions disconnect + navigate; affordance deliverable if S1-5 = slice 1)

- [ ] **Slice 2 --- `Meta::Room` play `positionGraph` (storage swap)**
  - [ ] Resolve **Open decisions** S2-1 through S2-3
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

**Slice 1 gate:** navigate -> positions tests; actions tests without imperative `MoveCharacter`; disconnect tests still pass after persistence API refactor.

**Slice 2 gate:** persistence API tests against `positionGraph` + projection invariants; affordance/roster smoke paths unchanged for players.

---

## Progress

| Milestone | Status |
| --- | --- |
| Slice 0 code | Done |
| Phase 0 durable docs | Done |
| Slice 1: localize execution (legacy storage) | Not started |
| Slice 2: `Meta::Room` play graph storage swap | Not started |
| Slice 3--4: connect unify + legacy retirement | Not started |
| Initiative close | Not started |
