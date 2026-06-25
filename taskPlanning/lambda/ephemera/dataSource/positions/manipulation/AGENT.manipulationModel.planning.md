# Positions manipulation model - planning

**Status:** In progress. **Next:** Phase 2 --- kernel + shared adapter spec (actions parse Phase 2 shipped; gate cleared).

**Upstream gate:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- atomic vs complex enrich refinement (ownership **M6** = actions sub-plan).

Framework: [`taskPlanning/AGENT.md`](../../../../../AGENT.md). This plan converges **storage authority**, a **graph-first manipulation kernel**, a **shared membership adapter layer** for `froms`/`to` planning, and **per-operator intent coordinators** so future verbs do not accumulate parallel persist paths.

**Delete criterion:** When Phases 1--4c are complete and durable docs answer "how does positions manipulation work?" without reading this file, slim or delete this plan (git retains history).

---

## Purpose

Shipped container moves (`navigate`, object room placement, **`takeHold`**) exposed a **membership-shaped operator API** (`froms[]` / `to` on membership hosts) while storage remains **graph-primary** (`positionGraph` on hosts + adjacency reverse index; graph wins on conflict). That layering was expedient for **`takeHold`** but created:

- Vocabulary drift: **"graph-diff"** on bus facts and **membership-first** naming on kernel docs conflate two layers that should stay distinct
- Apply pre-read via **`getMembershipContainers`** (adjacency) while repair/drift paths are graph-forward
- Per-operator diff computers (`computeTakeHoldDiff`) that will multiply for **`drop`** and relational verbs

This initiative **documents the tension**, **specs a graph-first manipulation kernel**, **keeps operator ingress membership-shaped**, **graduates steady-state prose** into package `AGENT*.md`, and **migrates persist code incrementally** through the kernel.

**Target layering (steady state):**

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Shared membership adapter       froms/to planning, apply mode, membership observation -> HostEffect[]
        |                     (reusable across navigate, object place, takeHold, drop, ...)
        v
Manipulation kernel             validate + apply HostEffect[] on affected positionGraphs only
        |
        v
Per-operator coordinators       membership fact projection, stream/cache/bus bundles
```

**Invariant:** **One kernel path** for graph-grounded persist. Kernel accepts **explicit `HostEffect[]`** --- it does **not** independently discover priors via **`getMembershipContainers`**. **Shared membership adapter** owns transfer planning (`froms`/`to`, end-state vs bounded); per-operator ingress calls the adapter, then the kernel.

**Anti-pattern:** new `update*PositionGraphs` modules, per-verb diff computers outside the shared adapter, or parallel transact builders per ingress.

**Cross-lane dependency:** Object manipulation **parse** (actions) must classify **atomic vs complex** before positions apply runs. Atomic egress calls an **operator adapter** that routes through the **same kernel** --- not a parse-local persist fork. Detail: [**`AGENT.objectManipulationParse.planning.md`**](../../actions/AGENT.objectManipulationParse.planning.md); summary below.

**Non-goals (this plan):** Slice 5+ relational edge implementation; **`drop`** operator vertical (separate plan may fork an adapter only); full graph structural diff algebra; **actions** enrich/parse pipeline spec (separate plan).

---

## Getting Started

Read in order before editing durable docs or apply code:

| Order | Doc | Why |
| --- | --- | --- |
| 1 | [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) | Graph roles, membership vs eviction ladder |
| 2 | [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Normative apply, facts, drift repair |
| 3 | [`lambda/ephemera/dataSource/positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) | Code map (`membership/` vs `manipulation/membership/`) |
| 4 | [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Storage schema, conflict policy, read surfaces |
| 5 | [`lambda/ephemera/diegeticLogic/AGENT.concepts.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.concepts.md) | Local edits, intent/fact/presentation |
| 6 | [`lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.operators.concepts.md) | Shipped **`takeHold`** fiction |

**Code anchors (expedient paths today):**

- End-state membership: [`membership/updatePositionGraphs.ts`](../../../../../../lambda/ephemera/dataSource/positions/membership/updatePositionGraphs.ts), [`membership/computeMembershipDiff`](../../../../../../lambda/ephemera/dataSource/positions/membership/updatePositionGraphs.ts) (exported)
- Cross-host operator: [`manipulation/membership/updateTakeHoldPositionGraphs.ts`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/updateTakeHoldPositionGraphs.ts)
- Graph merge primitives: [`membership/positionGraphMerge.ts`](../../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts)

**Tests (baseline before edits):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/updatePositionGraphs.test.ts \
  dataSource/positions/manipulation/membership/updateTakeHoldPositionGraphs.test.ts
```

If commands conflict, follow the nearest area testing doc under `lambda/ephemera/`.

---

## Current state (as-is archaeology)

Three lenses coexist today; the target splits **transfer planning** (shared adapter + upstream ingress) from **graph persist** (kernel).

| Lens | Question | Today (as-is) | Target (steady state) |
| --- | --- | --- | --- |
| **Storage** | What nodes are on which host graph? | `Meta::*`.positionGraph + adjacency rows; **graph wins** on conflict | Unchanged |
| **Transfer planning** | Which hosts to add/remove? | Inside persist engines: **`getMembershipContainers`** + per-verb diff computers | **Shared membership adapter**: membership observation + apply mode -> **`HostEffect[]`** |
| **Kernel persist** | How are graph rows updated? | Planner + transact bundled in `update*PositionGraphs` | Kernel: validate + apply supplied **`HostEffect[]`** on affected hosts only |
| **Operator / fact** | What hosts did this verb move between? | `MembershipDiff` / `ObjectMembershipDiff` on bus | Coordinators project adapter/kernel outcome to membership host transfer facts |

**Operator API shape (unchanged at ingress):** Coordinators (`applyCharacterRoomMembership`, `applyObjectRoomMembership`, `applyObjectTakeHold`) remain the public apply surface --- **not** raw `HostEffect[]` at ingress. Membership-shaped args are the **ingress** contract; **`HostEffect[]`** is the **adapter -> kernel** contract.

**Two apply policies already shipped:**

| Policy | Used by | Planning owner (target) | `froms` semantics |
| --- | --- | --- | --- |
| **End-state** | Navigate, connect, disconnect, object room placement | Shared adapter: observe priors, scrub all `!== target` | All distinct prior hosts removed |
| **Operator-bounded** | **`takeHold`** | Shared adapter: scrub **only** trusted ingress `roomId` (if present), add at character | Only passed `roomId` if object was on that room |

**Folder layout (decided M5 / M8):**

- [`membership/`](../../../../../../lambda/ephemera/dataSource/positions/membership/) --- per-operator coordinators (thin over shared adapter + kernel)
- [`manipulation/membership/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/) --- cross-host diegetic coordinators
- [`manipulation/adapters/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/) --- shared membership transfer planning (**M8**)
- [`manipulation/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/) --- manipulation kernel (`applyHostEffects`, etc.; top-level of package, sibling to `adapters/` and `membership/`; **M5**)

---

## Cross-lane dependency: object parse (actions sub-plan)

**Owner:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- membership-aware **atomic vs complex** discriminator and fall-through in **`enrich/objectManipulation/`**.

**Summary:** Shipped v1 uses one enrich LLM hop + deterministic catalog resolve without reverse membership observation. Next iteration (actions parse plan **Phase 1--4** done): per-span identity groundings (room + held catalogs merged) -> unary collapse -> **`getMembershipContainers`** -> complexity pre-gates (**`multiPresent`**, edge-touch, LLM fall-through) on **`Parse Requested`**. See [**Pipeline step I/O**](../../actions/AGENT.objectManipulationParse.planning.md#pipeline-step-io).

| Parse outcome | Positions expectation (this plan) |
| --- | --- |
| **Atomic** | Egress -> per-operator coordinator -> **shared membership adapter** -> **kernel**; bounded apply mode explicit (**M2**); trusted ingress ids |
| **Complex** | No stream / no apply until a follow-on planner exists |

**Membership observation by lane:**

| Lane | Role |
| --- | --- |
| **Actions parse** | **`getMembershipContainers(OBJECT#)`** for complexity pre-gates (**`multiPresent`** when `containers.length > 1`); **`getPositionGraph`** on sole host for edge-touch check. Identity stage merges room + held catalogs (held catalog fetched at parse ingress per **O5**); unary atomic path supplies one trusted `objectId` + ingress `roomId` for bounded **`takeHold`** (**M2**). |
| **Shared membership adapter** | **`getMembershipContainers`** (or graph-forward reads where repair already observed) to **plan** `froms`/`to` -> **`HostEffect[]`**. Same helpers for navigate, object place, **`takeHold`**, future **`drop`**. |
| **Manipulation kernel** | Reads **`positionGraph` only on hosts in the supplied effect list** --- validate, apply, dual-write adjacency. **Does not** plan transfers. |

### Gates (this plan waits on actions sub-plan)

| This plan phase | Gate |
| --- | --- |
| **Phase 2** (kernel + adapter spec) | **Ungated (2026-06-25):** actions parse plan Phase 2 shipped --- parse routes **`multiPresent`** and zero-host objects to terminal Error before egress; align atomic eligibility with **M2** in spec |
| **Phase 4a** (kernel scaffold) | None required; may run parallel to actions parse Phase 2--3 |
| **Phase 4b** (migrate persist through kernel; **M2** / **M5**) | Actions parse plan **Phase 5** shipped --- Phase 3--4 enrich stage split + held catalog wiring live; do not change atomic **`takeHold`** apply until parse graduates to durable docs and complex routing remains reliable |

---

## Target steady-state (to graduate)

### Vocabulary ( -> `positions/AGENT.concepts.md`)

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Graph-grounded persist executor: accept **`HostEffect[]`**, read affected hosts' `positionGraph`, validate, transact, dual-write adjacency; derive `changed` from graph state |
| **Host effect** | One alteration on a fixed host: add/remove identity node on `positionGraph` + matching adjacency dual-write (v1); add/remove edge (future slice 5+) |
| **Shared membership adapter** | Reusable **transfer planner**: membership observation + apply mode (`end-state` / `bounded`) -> **`HostEffect[]`** + projected `froms`/`to`; shared by multiple operators |
| **Per-operator coordinator** | Verb-specific ingress wrapper: calls shared adapter, then kernel; owns fact/cache/bus bundle |
| **Membership host transfer** | Semantic move between eligible hosts (`ROOM#`, `CHARACTER#` in v1); planned by shared adapter; projected to bus facts as `froms[]` / `to` |
| **Host-local relational patch** | Add/remove edges on a fixed host without changing membership host (future slice 5+; second kernel primitive) |
| **Apply mode: end-state** | Planner scrubs all prior membership hosts, places at target |
| **Apply mode: bounded** | Planner scrubs **only** hosts named by trusted ingress (v1 **`takeHold`**: passed `roomId` only --- not end-state multi-room scrub) |
| **Layered vocabulary** | **Kernel** docs: host effects, graph-grounded persist. **Adapter** docs: transfer planning, apply modes. **Bus facts** docs: membership host transfer projection. Retire ambiguous **"graph-diff"** on fact prose |

### Authority ( -> `positions/AGENT.contract.md` + gateway `AGENT.md`)

Decided (graduate at Phase 3; see Open decisions):

- **Conflict / repair:** graph wins (unchanged intent)
- **Transfer planning (**M1**):** shared membership adapter upstream of kernel; kernel does **not** call **`getMembershipContainers`** to discover priors
- **Kernel input:** explicit **`HostEffect[]`** only; kernel validates against `positionGraph` on affected hosts
- **Facts:** membership host transfer on the bus (`froms`/`to`) --- projection of adapter/kernel outcome
- **Doc vocabulary (**M3**):** layered terms per **Layered vocabulary** above
- **Bounded `takeHold` (**M2**):** shared adapter scrubs **only** the trusted ingress `roomId` (when object is on that room); does **not** end-state scrub all room hosts
- **Kernel v1 (**M4**):** **`applyHostEffects`** (membership-node add/remove) only; **host-local relational patch** documented as second primitive (no impl until slice 5)
- **No parallel persist paths:** all membership transfer ingress routes adapter -> kernel

### Implementation ( -> `positions/AGENT.implementation.md`)

- **`manipulation/adapters/`** (**M8**): shared membership transfer planner: apply mode, membership observation, **`HostEffect[]`** + `froms`/`to` projection
- **`manipulation/`** top-level (**M5**): **`applyHostEffects`** --- validate + transact; wrap `positionGraphMerge`, `*TransactItems` builders
- Per-operator coordinators in [`membership/`](../../../../../../lambda/ephemera/dataSource/positions/membership/) and [`manipulation/membership/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/) --- thin: adapter + kernel + fact bundle
- Character navigate: **character-row effects** (`RoomStack`) bundled in kernel transact when effect plan includes navigate (sibling to room-graph effects)
- Relational patch stub module path (document only until slice 5)

### Diegetic logic (link only)

Operators remain intent/fact/presentation shaped per [`diegeticLogic/AGENT.implementation.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md). This plan does not duplicate operator fiction.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships to durable docs, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

**Phase 1:** all rows below **Decided** (2026-06-24 archaeology review). Rows remain until Phase 3 graduation.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **M1** | **Kernel boundary:** accept explicit **`HostEffect[]`** only; validate + apply on affected `positionGraph`s; **no** independent **`getMembershipContainers`** prior-read in kernel. Transfer planning lives in **shared membership adapter** upstream | Phase 2 spec; Phase 4a--4b | **Decided** (Option A; see **Target layering**) |
| **M2** | Bounded **`takeHold`**: shared adapter scrubs **only** trusted ingress **`roomId`** (when present on that room) --- **not** end-state scrub of all room hosts | Phase 4b; **`takeHold`** tests | **Decided** (retain shipped bounded semantics) |
| **M3** | **Layered doc vocabulary:** kernel = host effects / graph-grounded persist; adapter = transfer planning; bus facts = membership host transfer projection; retire **"graph-diff"** on fact prose | Phase 3 doc graduation | **Decided** (see **Layered vocabulary** above) |
| **M4** | Manipulation kernel v1 primitives: **`applyHostEffects`** (membership-node add/remove) only; **host-local relational patch** as second primitive (doc stub, no impl) | Phase 2 kernel spec | **Decided** |
| **M5** | Kernel module location: under **`manipulation/`** (top-level, sibling to `adapters/` and `membership/`) --- not `membership/` | Phase 4a | **Decided:** [`manipulation/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/) |
| **M8** | Shared membership adapter location | Phase 4a | **Decided:** [`manipulation/adapters/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/adapters/) |
| **M7** | Migration order: scaffold adapter + kernel -> object room -> character (+ `RoomStack`) -> **`takeHold`** cross-host (incremental, not big-bang) | Phase 4b | **Decided** |
| ~~**M6**~~ | ~~Plan ownership~~ | --- | **Decided:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) |

---

## Graduation map

| Plan section | When done, move to |
| --- | --- |
| Vocabulary table (Target steady-state) | [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- new subsection under graph roles or shipped mental model |
| Authority rules (decided M1--M4, M2, M5, M7, M8) | [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) |
| Module paths, shared adapter + kernel + coordinators | [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) |
| Operator playbooks | Unchanged; add link from implementation playbook to manipulation kernel |
| Object parse pipeline | [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) -> [`actions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) |
| Archaeology / session notes | Delete from this plan |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | As-is archaeology (this doc) | Done |
| 1b | Fork actions parse sub-plan (**M6** decided) | Done |
| 2 | Kernel + shared adapter spec (HostEffect; record M4--M8, M2 in spec prose) | Not started |
| 3 | Graduate docs (M3; M1--M2, M4--M5, M7--M8 as contract prose) | Not started |
| 4a | Shared adapter + kernel scaffold (M5, M8) | Not started |
| 4b | Migrate through adapter + kernel (M7 incremental order) | Not started |
| 4c | Ingress audit; prep **`drop`** as adapter-only | Not started |
| 5 | Relational patch hook (doc stub only) | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

- [X] **Phase 1 --- Archaeology**
  - [X] Create this planning doc
  - [X] Capture cross-lane object parse-pipeline question (high level)
  - [X] Decide **M6** --- promote to [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md)
  - [X] Review archaeology with owner; all **M1**--**M8** decided (rows remain until Phase 3 graduation)
  - [X] Link this plan from [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (one line under `manipulation/membership/`)
- [ ] **Phase 2 --- Kernel + adapter spec** ( **gate:** actions parse plan Phase 1--2; align eligibility with **M2** )
  - [ ] Write kernel section: **`HostEffect`** shape, **`applyHostEffects`** contract (validate + transact on affected hosts only)
  - [ ] Write shared adapter section: **`froms`/`to` planning**, apply modes (**M2** bounded = ingress `roomId` only), membership observation -> **`HostEffect[]`**
  - [ ] Document compose rules: ingress -> shared adapter -> **`HostEffect[]`** -> kernel -> fact projection
  - [ ] Record **M4**, **M5**, **M8**, **M7** in spec (decided)
  - [ ] Document **character-row effects** (`RoomStack`) bundled with kernel transact on navigate
- [ ] **Phase 3 --- Doc graduation** (may overlap Phase 4b)
  - [ ] Update `positions/AGENT.concepts.md` (vocabulary; Target -> Shipped where applicable)
  - [ ] Update `positions/AGENT.contract.md` (M1 adapter/kernel split, **M2** bounded `takeHold`, module paths, fact naming)
  - [ ] Align gateway `positions/AGENT.md` conflict + read surfaces with contract
  - [ ] Resolve **M3** in durable docs: layered vocabulary
  - [ ] Remove decided rows from Open decisions
- [ ] **Phase 4a --- Shared adapter + kernel scaffold** (may run parallel to actions parse Phase 2--3)
  - [ ] Introduce **`manipulation/adapters/`** (**M8**): transfer planner (end-state / bounded per **M2**)
  - [ ] Introduce kernel at **`manipulation/`** top-level (**M5**): `applyHostEffects`; wrap `positionGraphMerge`, `*TransactItems`
  - [ ] Unit tests: planner modes -> effect list; effect list -> transact items; graph validation / `changed`
- [ ] **Phase 4b --- Migrate through adapter + kernel** ( **gate:** actions parse plan Phase 3--5 shipped for object atomic paths; order per **M7** )
  - [ ] **M7** step 1: object room --- move `computeMembershipDiff` into shared adapter; route `updateObjectPositionGraphs` through adapter + kernel
  - [ ] **M7** step 2: character (+ `RoomStack`) --- route `updatePositionGraphs` through adapter + kernel
  - [ ] **M7** step 3: **`takeHold`** cross-host --- move `computeTakeHoldDiff` into shared adapter; route `updateTakeHoldPositionGraphs` through adapter + kernel (**M2** bounded scrub)
  - [ ] Thin coordinators to adapter + kernel + fact bundle; update tests
- [ ] **Phase 4c --- Ingress audit**
  - [ ] Verify no transfer planning or transact builders outside shared adapter + kernel (`rg` audit)
  - [ ] Document **`drop`** as future coordinator + shared adapter only (no new `update*PositionGraphs` fork)
- [ ] **Phase 5 --- Relational hook**
  - [ ] Add implementation map stub for host-local relational patch (no slice 5 code)
  - [ ] Link from [`diegeticLogic/AGENT.concepts.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.concepts.md) future containment section
- [ ] **Close plan**
  - [ ] Verify graduation map complete
  - [ ] Slim or delete this file

---

## Verification

**After doc graduation (Phase 3):**

```bash
# Kernel vs fact vocabulary in positions contract (M3)
rg -n "graph-diff|host effect|membership host transfer|graph-grounded" \
  lambda/ephemera/dataSource/positions/AGENT.contract.md \
  packages/mtw-gateways/ts/ephemera/positions/AGENT.md
```

**After shared adapter + kernel scaffold (Phase 4a):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/adapters/
```

**After persist migration (Phase 4b--4c):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/
```

**No parallel planning or persist paths (Phase 4c):**

```bash
rg -n "getMembershipContainers" \
  lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts 2>/dev/null || true

rg -n "computeTakeHoldDiff|computeMembershipDiff|updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal after migration: transfer planners live in **shared adapter**; kernel has no **`getMembershipContainers`**; legacy `update*PositionGraphs` are thin wrappers or removed.

**Drift repair still graph-forward:**

```bash
rg -n "graph-forward|getPositionGraph" \
  lambda/ephemera/dataSource/positions/membership/repairRoomOccupancyDrift.ts \
  lambda/ephemera/dataSource/positions/AGENT.contract.md
```

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../../AGENT.md) | Durability ladder, open decisions litmus tests |
| [`positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md) | Positions package entry |
| [`diegeticLogic/AGENT.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.md) | Operator semantics hub |
| [`diegeticLogic/AGENT.implementation.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md) | Four-lane operator playbooks |
| [`actions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) | Adding atomic position-manipulation operator |
| [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) | Atomic vs complex parse/enrich (upstream) |
