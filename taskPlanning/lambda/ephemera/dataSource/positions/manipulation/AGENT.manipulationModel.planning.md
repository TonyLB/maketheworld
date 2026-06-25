# Positions manipulation model - planning

**Status:** In progress. **Next:** Close Phase 1 archaeology review; start Phase 2 kernel spec (parallel with actions parse plan Phase 1).

**Upstream gate:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- atomic vs complex enrich refinement (ownership **M6** = actions sub-plan).

Framework: [`taskPlanning/AGENT.md`](../../../../../AGENT.md). This plan converges **storage authority**, a **graph-first manipulation kernel**, and **membership-shaped operator adapters** so future verbs (relational edges, **`drop`**, nested hosts) do not accumulate parallel persist paths.

**Delete criterion:** When Phases 1--4c are complete and durable docs answer "how does positions manipulation work?" without reading this file, slim or delete this plan (git retains history).

---

## Purpose

Shipped container moves (`navigate`, object room placement, **`takeHold`**) exposed a **membership-shaped operator API** (`froms[]` / `to` on membership hosts) while storage remains **graph-primary** (`positionGraph` on hosts + adjacency reverse index; graph wins on conflict). That layering was expedient for **`takeHold`** but created:

- Vocabulary drift ("graph-diff" facts vs container-host deltas)
- Apply pre-read via **`getMembershipContainers`** (adjacency) while repair/drift paths are graph-forward
- Per-operator diff computers (`computeTakeHoldDiff`) that will multiply for **`drop`** and relational verbs

This initiative **documents the tension**, **specs a graph-first manipulation kernel**, **keeps operator ingress membership-shaped**, **graduates steady-state prose** into package `AGENT*.md`, and **migrates persist code incrementally** through the kernel.

**Target layering (steady state):**

```text
Ingress / intent adapters     membership-shaped args, trusted ids, apply mode
        |                     (apply*Membership, applyObjectTakeHold, drift repair)
        v
Manipulation kernel           graph-reconciled prior read -> host effects -> transact
        |
        v
Facts / side effects          membership diff + stream/cache/bus bundles
```

**Invariant:** **One kernel path** for graph-grounded persist. Operator adapters **translate intent into kernel operations**; they **must not** own bespoke graph persist or per-verb diff computers outside the kernel.

**Anti-pattern:** new `update*PositionGraphs` modules or parallel transact builders per ingress --- only new **adapters** over the shared kernel.

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

Three lenses coexist today; the target collapses **apply planning** into a graph-first kernel while keeping **operator / fact** membership-shaped.

| Lens | Question | Today (as-is) | Target (steady state) |
| --- | --- | --- | --- |
| **Storage** | What nodes are on which host graph? | `Meta::*`.positionGraph + adjacency rows; **graph wins** on conflict | Unchanged |
| **Kernel planning** | What host graph alterations to apply? | Pre-read **`getMembershipContainers`** (adjacency); per-verb diff computers; dual-write in transact | **Graph-reconciled** prior read -> **host effects** -> single kernel persist path |
| **Operator / fact** | What hosts did this verb move between? | `MembershipDiff` / `ObjectMembershipDiff` on bus | **Intent adapters** in; membership fact out (projection of kernel outcome) |

**Operator API shape (unchanged at ingress):** Coordinators (`applyCharacterRoomMembership`, `applyObjectRoomMembership`, `applyObjectTakeHold`) remain the public apply surface --- **not** host-graph patch objects at ingress. Graph effects are the **kernel's** contract; membership args are the **adapter's** contract.

**Two apply policies already shipped:**

| Policy | Used by | Prior-state observation | `froms` semantics |
| --- | --- | --- | --- |
| **End-state** | Navigate, connect, disconnect, object room placement | Adjacency pre-read; scrub all priors `!== target` | All distinct prior hosts removed |
| **Operator-bounded** | **`takeHold`** | Adjacency pre-read + trusted intent `roomId` | Only trusted source room if present on adjacency |

**Folder layout (today; kernel path TBD in M5):**

- [`membership/`](../../../../../../lambda/ephemera/dataSource/positions/membership/) --- homogenous host intent adapters + coordinators (target: thin over kernel)
- [`manipulation/membership/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/) --- cross-host diegetic intent adapters (target: thin over kernel)
- [`manipulation/kernel/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/) --- **target** graph-first manipulation kernel (Phase 4a; location per **M5**)

---

## Cross-lane dependency: object parse (actions sub-plan)

**Owner:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- membership-aware **atomic vs complex** discriminator and fall-through in **`enrich/objectManipulation/`**.

**Summary:** Shipped v1 uses one enrich LLM hop + deterministic catalog resolve without reverse membership observation. Next iteration adds identity -> **`getMembershipContainers`** -> complexity assessment (deterministic pre-gates + enrich) on **`Parse Requested`**.

| Parse outcome | Positions expectation (this plan) |
| --- | --- |
| **Atomic** | Egress -> **operator adapter** (`applyObjectTakeHold`, future atomic paths) -> **shared manipulation kernel**; bounded apply mode explicit (**M2**); trusted ingress ids |
| **Complex** | No stream / no apply until a follow-on planner exists |

**Two uses of membership (do not conflate):**

| Lane | Role of membership observation |
| --- | --- |
| **Actions parse** | **`getMembershipContainers`** for **eligibility / complexity** (e.g. multi-parent -> complex). Adjacency-shaped read is appropriate here. |
| **Positions kernel** | **Graph-reconciled priors** for apply planning (**M1**). Parse does not implement kernel planning. |

### Gates (this plan waits on actions sub-plan)

| This plan phase | Gate |
| --- | --- |
| **Phase 2** (kernel spec, **M2** contract text) | Actions parse plan **Phase 1** decided + **Phase 2** shipped (membership observation + deterministic multi-parent pre-gates) --- align atomic eligibility vocabulary before locking **M2** |
| **Phase 4a** (kernel scaffold) | None required; may run parallel to actions parse Phase 2--3 |
| **Phase 4b** (migrate persist through kernel; **M2** / **M5**) | Actions parse plan **Phase 3--5** shipped --- do not change atomic object apply semantics until parse routes multi-parent to complex reliably |

---

## Target steady-state (to graduate)

### Vocabulary ( -> `positions/AGENT.concepts.md`)

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Graph-grounded persist primitive: prior read -> **host effects** -> transact; single code path for membership-node changes |
| **Host effect** | One alteration on a fixed host: add/remove identity node on `positionGraph` + matching adjacency dual-write (v1); add/remove edge (future slice 5+) |
| **Intent adapter** | Operator ingress that translates membership-shaped args + apply mode into kernel operation(s); owns fact/cache/bus bundle, not bespoke persist |
| **Membership host transfer** | Kernel operation: move contained entity between eligible hosts (`ROOM#`, `CHARACTER#` in v1); projects to operator/fact shape `froms[]` / `to` |
| **Host-local relational patch** | Add/remove edges (or nested structure) on a fixed host graph without changing membership host (future slice 5+; second kernel primitive) |
| **Apply mode: end-state** | Scrub all prior membership hosts, place at target |
| **Apply mode: bounded** | Apply only hosts named by trusted operator intent (plus drift hygiene rules TBD) |

### Authority ( -> `positions/AGENT.contract.md` + gateway `AGENT.md`)

Decide and record (see Open decisions):

- **Conflict / repair:** graph wins (unchanged intent)
- **Kernel prior-read:** graph-reconciled priors vs adjacency-first with repair as safety net (**M1**)
- **Facts:** container-host deltas are **membership facts** (projection of kernel outcome); reserve separate fact shapes for relational patches when they ship
- **No parallel persist paths:** all membership transfer ingress routes through the kernel

### Implementation ( -> `positions/AGENT.implementation.md`)

- **`manipulation/kernel/`** (or decided **M5** path): host-effect transact composer, membership host transfer planner, graph-reconciled prior-read helper
- Intent adapters remain in [`membership/`](../../../../../../lambda/ephemera/dataSource/positions/membership/) and [`manipulation/membership/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/) --- thin coordinators over kernel
- Character navigate: document **character-row effects** (`RoomStack`) as sibling channel bundled with kernel transact (not subsumed by room-graph effects alone)
- Explicit apply-mode parameter on kernel membership-transfer operation
- Relational patch stub module path (document only until slice 5)

### Diegetic logic (link only)

Operators remain intent/fact/presentation shaped per [`diegeticLogic/AGENT.implementation.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md). This plan does not duplicate operator fiction.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **M1** | **Kernel prior-read** policy (end-state membership transfer): **graph-reconciled** vs **adjacency-first** --- scoped to kernel planning for character end-state apply and object room placement; not actions parse eligibility | Phase 4a--4b | Open |
| **M2** | Bounded **`takeHold`** drift: on pick-up, scrub **only** trusted `roomId` (current) vs scrub **all** room hosts (end-state hygiene) | Phase 4b; **`takeHold`** tests | Open |
| **M3** | Retire "graph-diff" vocabulary for container `froms`/`to` facts; use **membership-diff** or **membership fact** in docs | Phase 3 doc graduation | Open |
| **M4** | Manipulation kernel v1 primitives: confirm **host membership-node effects** (transfer) only; document **host-local relational patch** as second primitive (no impl) | Phase 2 kernel spec | Open |
| **M5** | Kernel module location: `membership/` vs `manipulation/` vs new `manipulation/kernel/`; adapters stay in coordinator folders | Phase 4a | Open |
| **M7** | Kernel migration order: object room -> character (+ `RoomStack`) -> **`takeHold`** cross-host vs big-bang | Phase 4b | Open |
| ~~**M6**~~ | ~~Plan ownership~~ | --- | **Decided:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) |

Large option comparisons for **M1** may use a root temporary analysis doc per [`AGENT.md` temporary working documents](../../../../../../AGENT.md); link from the decision row if created.

---

## Graduation map

| Plan section | When done, move to |
| --- | --- |
| Vocabulary table (Target steady-state) | [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- new subsection under graph roles or shipped mental model |
| Authority rules (decided M1--M3) | [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) |
| Module paths, kernel + adapters | [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) |
| Operator playbooks | Unchanged; add link from implementation playbook to manipulation kernel |
| Object parse pipeline | [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) -> [`actions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) |
| Archaeology / session notes | Delete from this plan |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | As-is archaeology (this doc) | In progress |
| 1b | Fork actions parse sub-plan (**M6** decided) | Done |
| 2 | Manipulation kernel spec (host effects, intent adapters; decide M4, M1 draft, M2 draft) | Not started |
| 3 | Graduate docs (M3; decided M1--M2 as contract prose) | Not started |
| 4a | Kernel scaffold (M5, M1 helper; no ingress change) | Not started |
| 4b | Migrate persist engines through kernel (M7, M2) | Not started |
| 4c | Ingress audit; prep **`drop`** as adapter-only | Not started |
| 5 | Relational patch hook (doc stub only) | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

- [ ] **Phase 1 --- Archaeology**
  - [X] Create this planning doc
  - [X] Capture cross-lane object parse-pipeline question (high level)
  - [X] Decide **M6** --- promote to [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md)
  - [ ] Review archaeology with owner; adjust Open decisions table
  - [X] Link this plan from [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (one line under `manipulation/membership/`)
- [ ] **Phase 2 --- Kernel spec** ( **gate:** actions parse plan Phase 1--2 before finalizing **M2** text )
  - [ ] Write manipulation kernel section: **host effect** shape, **intent adapter** pattern, membership transfer + relational patch boundary
  - [ ] Document compose rules: intent adapter -> kernel op(s) -> host effects -> transact -> membership fact projection
  - [ ] Decide **M4**; decide **M5** (kernel module path)
  - [ ] Decide **M1** (kernel prior-read); draft **M2** aligned with actions atomic eligibility (see parse sub-plan **O4**)
  - [ ] Document **character-row effects** (`RoomStack`) as bundled sibling to host-graph effects on navigate
- [ ] **Phase 3 --- Doc graduation** (may overlap Phase 4b once **M1** / **M2** decided)
  - [ ] Update `positions/AGENT.concepts.md` (vocabulary; Target -> Shipped where applicable)
  - [ ] Update `positions/AGENT.contract.md` (kernel prior-read, apply modes, fact naming, no parallel persist paths)
  - [ ] Align gateway `positions/AGENT.md` conflict + read surfaces with contract
  - [ ] Resolve **M3** ("graph-diff" -> "membership fact" where container-only)
  - [ ] Remove decided rows from Open decisions
- [ ] **Phase 4a --- Kernel scaffold** (may run parallel to actions parse Phase 2--3)
  - [ ] Introduce kernel module per **M5** (wrap `positionGraphMerge`, `*TransactItems` builders)
  - [ ] Implement host-effect transact composer + membership host transfer planner (`end-state` / `bounded` apply modes)
  - [ ] Introduce graph-reconciled prior-host helper if **M1** graph-reconciled (or document adjacency-first as explicit contract choice)
  - [ ] Unit tests: effect list -> transact items; transfer planner modes
- [ ] **Phase 4b --- Migrate persist through kernel** ( **gate:** actions parse plan Phase 3--5 shipped for object atomic paths )
  - [ ] Decide **M7** migration order; route `updateObjectPositionGraphs` through kernel (homogenous case first)
  - [ ] Route `updatePositionGraphs` through kernel (include `RoomStack` character-row channel)
  - [ ] Route `updateTakeHoldPositionGraphs` through kernel cross-host composer; remove duplicated diff logic
  - [ ] Adjust **`takeHold`** drift behavior if **M2** changes
  - [ ] Thin coordinators to fact/cache/bus only; update tests under `membership/` and `manipulation/membership/`
- [ ] **Phase 4c --- Ingress audit**
  - [ ] Verify no new direct transact builders outside kernel for membership transfer (`rg` audit)
  - [ ] Document **`drop`** as future intent adapter only (no new `update*PositionGraphs` fork)
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
# Container facts should use membership vocabulary in positions contract
rg -n "graph-diff|membership fact|membership-diff" \
  lambda/ephemera/dataSource/positions/AGENT.contract.md \
  packages/mtw-gateways/ts/ephemera/positions/AGENT.md
```

**After kernel scaffold (Phase 4a):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/
```

**After persist migration (Phase 4b--4c):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/membership/ \
  dataSource/positions/manipulation/kernel/
```

**No parallel persist paths (Phase 4c):**

```bash
rg -n "computeTakeHoldDiff|computeMembershipDiff|updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal after migration: diff planners live in kernel; legacy `update*PositionGraphs` are thin wrappers or removed.

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
