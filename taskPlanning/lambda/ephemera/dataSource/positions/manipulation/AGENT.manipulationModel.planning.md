# Positions manipulation model - planning

**Status:** In progress. **Next:** Close Phase 1 archaeology review; start Phase 2 kernel spec (parallel with actions parse plan Phase 1).

**Upstream gate:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- atomic vs complex enrich refinement (ownership **M6** = actions sub-plan).

Framework: [`taskPlanning/AGENT.md`](../../../../../AGENT.md). This plan converges **storage authority**, **apply planning**, and **operator-facing APIs** so future graph manipulation (relational edges, nested hosts) does not accumulate per-operator diff models.

**Delete criterion:** When Phases 1--4 are complete and durable docs answer "how does positions manipulation work?" without reading this file, slim or delete this plan (git retains history).

---

## Purpose

Shipped container moves (`navigate`, object room placement, **`takeHold`**) exposed a **membership-shaped operator API** (`froms[]` / `to` on membership hosts) while storage remains **graph-primary** (`positionGraph` on hosts + adjacency reverse index; graph wins on conflict). That layering was expedient for **`takeHold`** but created:

- Vocabulary drift ("graph-diff" facts vs container-host deltas)
- Apply pre-read via **`getMembershipContainers`** (adjacency) while repair/drift paths are graph-forward
- Per-operator diff computers (`computeTakeHoldDiff`) that will multiply for **`drop`** and relational verbs

This initiative **documents the tension**, **decides a small manipulation kernel**, **graduates steady-state prose** into package `AGENT*.md`, and **aligns code incrementally**.

**Cross-lane dependency:** Object manipulation **parse** (actions) must classify **atomic vs complex** before positions apply runs. Detail and implementation live in [**`AGENT.objectManipulationParse.planning.md`**](../../actions/AGENT.objectManipulationParse.planning.md); summary below.

**Non-goals (this plan):** Slice 5+ relational edge implementation; **`drop`** operator vertical (separate plan may fork from this kernel); full graph structural diff algebra; **actions** enrich/parse pipeline spec (separate plan).

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

Three lenses coexist; they are related but not the same object.

| Lens | Question | Steady-state today |
| --- | --- | --- |
| **Storage** | What nodes are on which host graph? | `Meta::*`.positionGraph + adjacency rows; **graph wins** on conflict |
| **Apply planning** | What containers to scrub/add? | Pre-read **`getMembershipContainers`**; dual-write graph + adjacency in one transact |
| **Operator / fact** | What hosts did this verb move between? | `MembershipDiff` / `ObjectMembershipDiff` on bus (`Character Moved`, `Object Moved`) |

**Operator API shape:** Ingress calls membership apply coordinators (`applyCharacterRoomMembership`, `applyObjectRoomMembership`, `applyObjectTakeHold`) --- not host-graph patch objects. Graph mutation is an implementation detail behind transact item builders.

**Two apply policies already shipped:**

| Policy | Used by | Prior-state observation | `froms` semantics |
| --- | --- | --- | --- |
| **End-state** | Navigate, connect, disconnect, object room placement | Adjacency pre-read; scrub all priors `!== target` | All distinct prior hosts removed |
| **Operator-bounded** | **`takeHold`** | Adjacency pre-read + trusted intent `roomId` | Only trusted source room if present on adjacency |

**Folder layout:**

- [`membership/`](../../../../../../lambda/ephemera/dataSource/positions/membership/) --- homogenous host membership persist + coordinators
- [`manipulation/membership/`](../../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/) --- cross-host diegetic operators composing homogenous primitives

---

## Cross-lane dependency: object parse (actions sub-plan)

**Owner:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) --- membership-aware **atomic vs complex** discriminator and fall-through in **`enrich/objectManipulation/`**.

**Summary:** Shipped v1 uses one enrich LLM hop + deterministic catalog resolve without reverse membership observation. Next iteration adds identity -> **`getMembershipContainers`** -> complexity assessment (deterministic pre-gates + enrich) on **`Parse Requested`**.

| Parse outcome | Positions expectation (this plan) |
| --- | --- |
| **Atomic** | Bounded **membership host transfer**; trusted ingress ids; apply-mode explicit (**M2**) |
| **Complex** | No stream / no apply until a follow-on planner exists |

### Gates (this plan waits on actions sub-plan)

| This plan phase | Gate |
| --- | --- |
| **Phase 2** (kernel spec, **M2** contract text) | Actions parse plan **Phase 1** decided + **Phase 2** shipped (membership observation + deterministic multi-parent pre-gates) --- align atomic eligibility vocabulary before locking **M2** |
| **Phase 4** (positions apply code, **M2** / **M5**) | Actions parse plan **Phase 3--5** shipped (enrich refactor + wiring + tests) --- do not change atomic object apply semantics until parse routes multi-parent to complex reliably |

---

## Target steady-state (to graduate)

### Vocabulary ( -> `positions/AGENT.concepts.md`)

| Term | Meaning |
| --- | --- |
| **Manipulation kernel** | Small set of persist primitives operators compose; not one diff type per verb |
| **Membership host transfer** | Move contained entity between eligible hosts (`ROOM#`, `CHARACTER#` in v1); operator/fact shape `froms[]` / `to` |
| **Host-local relational patch** | Add/remove edges (or nested structure) on a fixed host graph without changing membership host (future slice 5+) |
| **Apply mode: end-state** | Scrub all prior membership hosts, place at target |
| **Apply mode: bounded** | Apply only hosts named by trusted operator intent (plus drift hygiene rules TBD) |

### Authority ( -> `positions/AGENT.contract.md` + gateway `AGENT.md`)

Decide and record (see Open decisions):

- **Conflict / repair:** graph wins (unchanged intent)
- **Apply pre-read:** reconciled membership view (graph-primary) vs adjacency-first with repair as safety net
- **Facts:** container-host deltas are **membership facts**; reserve separate fact shapes for relational patches when they ship

### Implementation ( -> `positions/AGENT.implementation.md`)

- Shared cross-host apply composer (replace per-operator `update*PositionGraphs` duplication where safe)
- Explicit apply-mode parameter on membership transfer primitive
- Relational patch stub module path (document only until slice 5)

### Diegetic logic (link only)

Operators remain intent/fact/presentation shaped per [`diegeticLogic/AGENT.implementation.md`](../../../../../../lambda/ephemera/diegeticLogic/AGENT.implementation.md). This plan does not duplicate operator fiction.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **M1** | Apply pre-read policy (**positions**, end-state membership transfer): **graph-reconciled** vs **adjacency-first** --- scoped to character end-state apply and object room placement; not object atomic parse | Phase 4 code alignment | Open |
| **M2** | Bounded **`takeHold`** drift: on pick-up, scrub **only** trusted `roomId` (current) vs scrub **all** room hosts (end-state hygiene) | Phase 4; **`takeHold`** tests | Open |
| **M3** | Retire "graph-diff" vocabulary for container `froms`/`to` facts; use **membership-diff** or **membership fact** in docs | Phase 3 doc graduation | Open |
| **M4** | Manipulation kernel v1 primitives: confirm **membership host transfer** only; document **host-local relational patch** as second primitive (no impl) | Phase 2 kernel spec | Open |
| **M5** | Shared `applyCrossHostMembershipChange` location: `membership/` vs `manipulation/` vs new `manipulation/kernel/` | Phase 4 | Open |
| ~~**M6**~~ | ~~Plan ownership~~ | --- | **Decided:** [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) |

Large option comparisons for **M1** may use a root temporary analysis doc per [`AGENT.md` temporary working documents](../../../../../../AGENT.md); link from the decision row if created.

---

## Graduation map

| Plan section | When done, move to |
| --- | --- |
| Vocabulary table (Target steady-state) | [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- new subsection under graph roles or shipped mental model |
| Authority rules (decided M1--M3) | [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) |
| Module paths, apply composer | [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) |
| Operator playbooks | Unchanged; add link from implementation playbook to manipulation kernel |
| Object parse pipeline | [`../../actions/AGENT.objectManipulationParse.planning.md`](../../actions/AGENT.objectManipulationParse.planning.md) -> [`actions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) |
| Archaeology / session notes | Delete from this plan |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 1 | As-is archaeology (this doc) | In progress |
| 1b | Fork actions parse sub-plan (**M6** decided) | Done |
| 2 | Manipulation kernel spec + decide M4 | Not started |
| 3 | Graduate docs (M3; decided M1--M2 as contract prose) | Not started |
| 4 | Code alignment (pre-read, shared cross-host composer; M5) | Not started |
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
  - [ ] Write manipulation kernel section (membership transfer + relational patch boundary)
  - [ ] Decide **M4**; document compose rules (operator -> effect list -> persist)
  - [ ] Decide **M1**; draft **M2** aligned with actions atomic eligibility (see parse sub-plan **O4**)
- [ ] **Phase 3 --- Doc graduation**
  - [ ] Update `positions/AGENT.concepts.md` (vocabulary; Target -> Shipped where applicable)
  - [ ] Update `positions/AGENT.contract.md` (pre-read, apply modes, fact naming)
  - [ ] Align gateway `positions/AGENT.md` conflict + read surfaces with contract
  - [ ] Resolve **M3** ("graph-diff" -> "membership fact" where container-only)
  - [ ] Remove decided rows from Open decisions
- [ ] **Phase 4 --- Code alignment (incremental)** ( **gate:** actions parse plan Phase 3--5 shipped )
  - [ ] Introduce reconciled prior-host helper if **M1** graph-reconciled (or document adjacency-first as explicit contract choice)
  - [ ] Extract shared cross-host membership apply (**M5**); migrate **`takeHold`**; prep **`drop`**
  - [ ] Adjust **`takeHold`** drift behavior if **M2** changes
  - [ ] Update tests under `membership/` and `manipulation/membership/`
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

**After code alignment (Phase 4):**

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/membership/
```

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
