# Positions DataSource Planning (`mtw.ephemera.positions`)

**Status:** In progress. **Slice 0 shipped.** **Slice 1a shipped** (membership API, navigate ingress, S1-5 read surface, disconnect refactor, `moveCharacter` split, Model A anchor). **Slice 1b shipped** (`Character Moved` emit + fan-in publish for navigate + disconnect). **Next:** slice **2** swaps persistence to `Meta::Room` play `positionGraph`. See [Migration strategy](#migration-strategy-routing-first).

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
3. [Migration strategy](#migration-strategy-routing-first) below --- **membership persistence boundary**, slice 1 TEMP vs slice 2 graph-diff fact emit (**S1-14** / **F1-8**), storage swap, read surfaces
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

**Slice 1b (emission)** --- positions streams **`Character Moved`** at persistence apply using **slice 1 TEMP intent-assisted emit (**S1-14**)** until slice **2** graph-diff; fan-in **F1-8** steady state deferred to slice **2** cutover bundle. **`mtw.ephemera.actions`** / **`mtw.connections.characters`** stream **intent**; **[`mtw.ephemera.perception`](../../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** fan-in (**F1-6**) publishes after correlation. Ships with slice 1 per **S1-2** for **navigate + disconnect**; connect end-to-end deferred to slice **3** (**S1-12**). See [Fact emission: slice 1 vs slice 2](#fact-emission-slice-1-temporary-vs-slice-2-steady-state).

### Checklist ownership (coordination with fan-in)

Track **positions-owned** work in [Recommended order](#recommended-order) below. Track **fan-in consumer** work (cluster publish, **`exitName`** policy wiring in perception/actions) in [`AGENT.fanInPattern.planning.md` --- Phase 1](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md#recommended-order) --- do not duplicate those rows here.

| Concern | Authoritative plan |
| --- | --- |
| **`positions/membership/`** persist + coordinator (**S1-4**, **S1-13**, **S1-11**) | Positions slice **1a** |
| **`Character Moved`** stream + **`beatAnchorTime`** (**S1-14**, **F1-4**) | Positions slice **1b** |
| Fan-in **`publishMembershipPresentation`**, integration tests | Fan-in Phase **1** |
| **`exitName`** on **`Character Navigate`** + perception policy (**S1-10**, **F1-9**) | Fan-in Phase **1** (shipped: actions stream + perception policy; positions fact side still omits **`legalExits`** at slice **1b**) |

## Presentation model (beat vs emission)

| Layer | When | What |
| --- | --- | --- |
| **Beat orchestration (Model A)** | Position-move **fact** at persistence apply | **`beatAnchorTime`** = fact recorded time (**F1-4**); header **`MessageId`**, targets; leave at `anchor - epsilon`, header at `anchor`, arrive at `anchor + epsilon`; header publish async when render ready |
| **Emission correlation (fan-in)** | After intent + fact correlate (or fact-only at settle) | Partial clusters + **unify**; fact-authoritative identity (**F1-1**). **Shape:** leave+arrive vs arrive-only (connect) vs leave-only (disconnect). **Copy:** exit-aware when navigate intent has **`exitName`** (**F1-9** / **S1-10**); home / connect / generic otherwise. Intent: actions (**F1-2**) + connections connect/disconnect (**F1-5**). Consumer: **[`mtw.ephemera.perception`](../../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** (**F1-6**). Then **`PublishMessage`** world lines --- not before correlation |

Connect/disconnect: usually **singleton** world line (no three-part beat); session orientation header on connect stays on existing Character Registered path. **Slice 1** fan-in emission covers **disconnect** + **navigate**; **connect** facts deferred to slice **3** (**S1-12**) --- connect intent adapters may ship earlier but positions does not emit connect **`Character Moved`** until connect routes through membership API.

**Post-move side effects (decoupled from fan-in; see fan-in **F3-2**):**

| Concern | Audience | This initiative |
| --- | --- | --- |
| Mover arrival **render header** | Mover only | Slim **`characterMove`** PerceptionThread + render kick (optional UUID **`requestId`** for orchestrate match) |
| **Affordance refresh** ("who is here?", exits, ...) | All occupants in affected room(s) | Keep separate affordance kick (today **`RoomUpdate`** from persistence apply). **Deferred:** general **`Object Moved`** (or similar) consumer on **`mtw.ephemera.positions`** |

## Fact emission: slice 1 (temporary) vs slice 2 (steady state)

Cross-initiative contract: fan-in **F1-8** ([`AGENT.fanInPattern.planning.md` --- Fact producer contract](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md#fact-producer-contract----descriptive-emission-at-persistence-apply-f1-8)).

### Steady-state target (slice 2+; **F1-8**)

**`Character Moved`** is a **descriptive fact** from **graph membership diff**, not ingress type. The membership persistence API owns **persist** and **fact stream**:

```text
Caller (any ingress)          updatePositionGraphs (slice 2)           Downstream
--------------------          ------------------------------           ----------
navigate / disconnect /  -->  immer update on loaded play graphs  -->  MembershipDiff
connect (when unified)        transact per-room + denorm projections      streamEvent if from !== to
                              diff before/after holistically
```

Ship **`updatePositionGraphs`** and diff-derived emit **together** in slice **2** (same PR as stored **`Meta::Room.positionGraph`**). See [Slice 2 cutover bundle](#slice-2-cutover-bundle) below.

Precedent: [`mergePersistMetaRoomObjects`](../../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) + [`Objects Changed`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts).

### Slice 1 temporary (**S1-14**)

Until slice **2**, the persistence boundary still streams **`Character Moved`** for fan-in Phase 1, using **flat-field** storage and an **intent-assisted** fact builder (not full graph-diff):

```text
Caller (any ingress)          Membership persistence API (slice 1)     Downstream
--------------------          ------------------------------------     ----------
navigate / disconnect    -->  1. pre-read CharacterMeta.RoomId   -->   streamEvent Character Moved
connect (when unified)        2. transact flat fields                  (only if from !== to)
                              3. to = successful apply target
                              4. TEMP slice 1 comments at emit seam
                              (orchestration: header kick, etc. stays in callers)
```

**Rules (slice 1):**

- **Apply before emit** --- same membership boundary as steady state; no emit-from-intent without persist.
- **`from`** = pre-read authoritative room endpoint (`null` = out of play).
- **`to`** = apply outcome (target room or `null` on disconnect) --- not navigate stream **`fromRoomId`/`toRoomId`** copied without pre-read/apply.
- **No-op gate (**S1-8**):** no stream when `from === to` after apply.
- **Anti-pattern (still reject):** positions handlers that branch **`streamEvent`** on "this was navigate vs disconnect"; perception copy branching stays on **intent** legs only.

**Code:** mark the fact-builder function / block with **`TEMP slice 1 --- replace with MembershipDiff from updatePositionGraphs in slice 2`**. Removal is a slice **2** checklist item (not optional cleanup).

### What the fact carries (decided)

Shipped contract [`publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts): **`characterId`**, **`from`** / **`to`** (`null` = out of play, **F1-7**), **`beatAnchorTime`** (**F1-4**), optional **`characterName`**. Fan-in **F1-1** uses fact endpoints as authoritative cluster identity. Optional **`legalExits`** remains on the type guard for forward compatibility but is **not populated slice 1** (**S1-10**); revisit after slice **2** only if a consumer needs fact-time exit snapshots.

### Slice 2 cutover bundle

One PR (do not split):

1. **`Meta::Room.positionGraph`** schema (S2-1--S2-3)
2. **`updatePositionGraphs`** helper (immer draft over parent component graphs, holistic diff, decomposed **`transactWrite`** + denorm projections per S2-2)
3. Replace slice 1 TEMP fact builder with **diff-only** emit
4. Delete **`TEMP slice 1`** comments; graduate **F1-8** rules to [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md)
5. Swap gateway read adapter from flat projection to stored graph (S1-5)

### Module layout (**S1-4**)

Split by **concern** (not by ingress event type). Precedent: [`objects/mergePersistMetaRoomObjects.ts`](../../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) (persist) + [`objects/handleApiObjectsChange.ts`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) (apply + stream).

Target under **`positions/membership/`** (names may adjust at implementation):

| Module | Role | Slice |
| --- | --- | --- |
| **`types.ts`** | **`MembershipApplyArgs`**, **`MembershipApplyResult`** / **`MembershipDiff`** (**S1-7**, **S1-8**) | 1 + 2 |
| **`applyCharacterMembershipFlat.ts`** | Flat-field transact (`activeCharacters`, `RoomId`, `RoomStack`); returns endpoint before/after | 1 (slice 2 replaces with **`updatePositionGraphs.ts`**) |
| **`buildCharacterMovedFact.ts`** | TEMP slice 1 fact payload from apply result (**S1-14**); **`TEMP slice 1`** comments | 1 (removed/replaced in slice 2 cutover) |
| **`streamMembershipFact.ts`** | **`streamEvent`** **`Character Moved`**; no-op gate (**S1-8**); do **not** populate **`legalExits`** slice 1 (**S1-10**) | 1 + 2 |
| **`applyCharacterRoomMembership.ts`** | **Thin coordinator** --- persist, fact build, cache / **`RoomUpdate`** (S1-11); stable API for all ingress | 1 + 2 |
| Ingress handlers (e.g. navigate, disconnect refactor) | Call **`applyCharacterRoomMembership`** only | 1 |

**Not in positions `membership/` (orchestration --- **S1-13**):** PerceptionThreads header registration, passive render kick, **`MapUpdate`**, imperative leave/arrive **`PublishMessage`** (until fan-in **1b** retires them), **`OrchestrateMessages`** beat grouping for header path. Slim navigate orchestration (extracted from [`moveCharacter`](../../../../../../lambda/ephemera/moveCharacter/index.ts)) calls **`applyCharacterRoomMembership`** first, then kicks orchestration. Slice **2** swaps **`applyCharacterMembershipFlat`** for **`updatePositionGraphs`** inside the coordinator; orchestration callers unchanged.

#### Apply API shape (**S1-7**) and no-op gate (**S1-8**)

**Ingress-facing (stable slice 1 through slice 2+):** **`applyCharacterRoomMembership(args)`** accepts end-state room membership only:

```typescript
// membership/types.ts (conceptual)
type MembershipApplyArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId | null;  // null = out of play (disconnect)
};

type MembershipApplyResult = {
    from: EphemeraRoomId | null;
    to: EphemeraRoomId | null;
    changed: boolean;  // S1-8: true iff from !== to after apply
};
```

| Caller | `targetRoomId` |
| --- | --- |
| Navigate (after actions validates exit) | `toRoomId` |
| Disconnect | `null` |
| Connect | resolved in-play room --- **deferred** to slice **3** through this API (**S1-12**); slice 1 keeps `CheckLocation` / `moveCharacter` bridge |

**Not on public args:** ingress event type, intent **`fromRoomId`/`toRoomId`**, or graph edit callbacks --- those stay on intent streams (fan-in) or inside the module.

**Internal slice 2:** coordinator translates **`MembershipApplyArgs`** into an **`updatePositionGraphs`** immer draft (parent room ids + character node moves). **`updatePositionGraphs`** is **not** the ingress API; it is the swappable persist engine behind **`applyCharacterRoomMembership`**.

**`RoomStack`:** not part of **`MembershipApplyArgs`** (**S1-9**). Flat persist impl may still update **`RoomStack`** when the room endpoint changes (legacy parity); that is an implementation detail of **`applyCharacterMembershipFlat`**, not a richer public command. Richer graph commands (in-room edges, objects) deferred to slice **5+**.

**No-op gate (**S1-8**):** **`streamMembershipFact`** runs only when **`MembershipApplyResult.changed`** is true (equivalently **`from !== to`**). Slice 1: set from flat apply result. Slice 2: set from **`MembershipDiff`** / graph membership slice of **`updatePositionGraphs`** output. Same gate, different persist backend.

#### Exit-aware copy (**S1-10** / fan-in **F1-9**)

Slice **1** consolidates exit-aware presentation on **intent**, extending the same **trust action-parse** posture as **S1-1**:

| Concern | Owner | Slice 1 |
| --- | --- | --- |
| **Move allowed?** (`toRoomId` valid) | **Actions parse** | Positions trusts at apply (**S1-1**) |
| **Exit label for copy** ("north", etc.) | **`Character Navigate`** intent | Add optional **`exitName`** to stream payload when parse matched an exit (**F1-9**) |
| **Exit-aware world copy** | **Fan-in** (`buildMembershipEmissionPlan`) | **`copyKind: 'exitAware'`** when navigate intent includes **`exitName`** --- trust parse; **do not** require **`factLeg.legalExits`** |

**Dropped for slice 1:** positions does **not** read topology to populate **`legalExits`** on **`Character Moved`**. No departure-room gateway read at fact emit; no second gate beyond parse.

**Implementation (slice 1 bundle):**

1. **Actions:** extend [`Character Navigate`](../../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) with optional **`exitName`**; emit from parse when navigation matched a named exit ([`actions/index.ts`](../../../../../../lambda/ephemera/dataSource/actions/index.ts)). **Shipped** (fan-in Phase 1).
2. **Perception:** map **`exitName`** in [`membershipPresentationLegAdapters.ts`](../../../../../../lambda/ephemera/dataSource/perception/membershipPresentationLegAdapters.ts); simplify [`membershipPresentationFanIn.ts`](../../../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) --- exit-aware when **`intentKind === 'navigate' && intentLeg.exitName`** (remove **`legalExits?.includes`** check). **Shipped** (fan-in Phase 1).
3. **Positions:** omit **`legalExits`** on emitted facts (slice **1b**).

**After slice 2:** optional spike whether stored play graphs warrant reintroducing **`legalExits`** on the fact for leg-only fan-in or other consumers --- not a slice 1 blocker.

#### Persistence vs orchestration (**S1-13**)

Slice **1a** extracts from [`moveCharacter`](../../../../../../lambda/ephemera/moveCharacter/index.ts) everything that **`updatePositionGraphs`** will own in slice **2** --- into **`applyCharacterMembershipFlat`** + **`applyCharacterRoomMembership`** coordinator (flat storage is **temporary**; API and side-effect ownership stay stable across the slice **2** swap).

| Concern | Slice 1 owner | Notes |
| --- | --- | --- |
| **`Meta::Character`** `RoomId` / `RoomStack` transact | **`applyCharacterMembershipFlat`** | Same rows slice **2** mutates via graph draft |
| **`Meta::Room.activeCharacters`** departure removal + arrival add/update | **`applyCharacterMembershipFlat`** | Slice **2:** projection from **`positionGraph`** (**S2-2**) |
| Pre-read **`from`** / apply **`to`** / **`changed`** gate | **Coordinator** | Slice **2:** from **`MembershipDiff`** |
| Cache memo: **`RoomCharacterList`**, **`ComponentEphemeraMeta`**, **`AffordanceRoomDeliverable`**, positions read handler (**S1-5**) | **Coordinator** when **`changed`** (**S1-11**) | Same bundle as fact emit; not on same-room / no-op applies |
| **`RoomUpdate`** (affordance refresh path) | **Coordinator** when **`changed`** (**S1-11**) | Affected endpoint room(s): non-null **`from`** and/or **`to`** |
| **`EphemeraUpdate`** `CharacterInPlay` room projection | **Coordinator** when **`changed`** (**S1-11**) | Client roster/orientation tied to membership endpoint change |
| **`Character Moved`** stream (**S1-14**) | **`streamMembershipFact`** when **`changed`** (**S1-11**) | Head of membership-changed bundle; slice **1b** |
| PerceptionThreads **`characterMove`** registration | **Navigate orchestration** (slim `moveCharacter` successor) | Targeting-only through fan-in Phase 2 |
| Passive render kick, **`Perception`** header kick | **Navigate orchestration** | **F3-2** --- mover-only header |
| **`MapUpdate`** | **Navigate orchestration** | Out of scope for membership module |
| Imperative leave/arrive **`PublishMessage`** | **Retire slice 1b** (fan-in emission) | Until then: legacy bridge only for connect (**S1-12**) |
| **`OrchestrateMessages`** message groups for beat | **Navigate orchestration** | Model A header path |

**Slice 1 ingress through membership API:** **navigate** + **disconnect** only. **Connect** stays on existing bridge until slice **3** (**S1-12**).

**`moveCharacter` after slice 1a:** thin orchestration wrapper (or retired for navigate/disconnect paths) --- **must not** perform direct `activeCharacters` / `RoomId` transacts outside **`applyCharacterRoomMembership`**.

#### Side-effect gating (**S1-11**)

**Decided:** consolidate post-apply side effects on the **single position-emitted fact** --- not on fine-grained roster-mutation flags that preserve legacy ad-hoc gates.

**Policy:** when **`MembershipApplyResult.changed`** (`from !== to`, **S1-8** / **S1-9**), the coordinator runs one **membership-changed bundle** in lockstep:

1. **`streamMembershipFact`** --- **`Character Moved`** (**S1-14**)
2. Cache memo for affected endpoint room(s) (**S1-5**)
3. **`RoomUpdate`** for each non-null endpoint among **`from`** / **`to`**
4. **`EphemeraUpdate`** `CharacterInPlay` room projection

When **`!changed`**: skip the **entire** bundle --- no fact, no **`RoomUpdate`**, no membership cache side effects, no fan-in world lines. Duplicate disconnect / navigate-to-current-room / **`RoomStack`-only applies (**S1-9**) are no-ops for both persistence side effects and presentation.

**Explicitly rejected:** extending **`MembershipApplyResult`** with per-room roster flags (`departureRosterChanged`, `arrivalRosterChanged`, disconnect **`removed`**, etc.) to mirror today's inconsistent legacy:

| Legacy pattern | Disposition |
| --- | --- |
| Arrival **`RoomUpdate`** always (including same-room) | **Drop** --- gated on **`changed`** only |
| Departure **`RoomUpdate`** only if character was in prior roster | **Drop** --- if **`changed`**, kick non-null **`from`** |
| Disconnect **`removed`** idempotency gate separate from endpoint | **Fold into `changed`** --- already out of play => `from === to === null` => no bundle |
| Cache refresh on same-room session merge without endpoint change | **Drop** --- not a membership-changed fact; revisit only if a future non-membership event warrants it |

**Rationale:** the positions **`Character Moved`** fact is the authoritative "membership endpoint changed" signal for fan-in, affordance refresh, and cache coherence. One gate keeps ingress handlers thin and avoids re-encoding [`moveCharacter`](../../../../../../lambda/ephemera/moveCharacter/index.ts) / disconnect handler conditionals in the coordinator.

**Coordinator shape:** persist (skip or no-op transact when pre-read matches target), compute **`from`/`to`/`changed`**, then **`if (changed) { ...bundle }`**. Orchestration (**S1-13**) must not duplicate **`RoomUpdate`** on navigate/disconnect paths that already ran the bundle.

### Remaining implementation forks

| ID | Question | Status / notes |
| --- | --- | --- |
| **S1-6** | **Diff source for `from`/`to`** | **Decided:** slice 1 = pre-read **`RoomId`** + apply target (**S1-14**). Slice 2 = **`MembershipDiff`** from **`updatePositionGraphs`**. |
| **S1-4** | **Module layout** | **Decided:** split under **`positions/membership/`** --- see [Module layout (**S1-4**)](#module-layout-s1-4). Thin **`applyCharacterRoomMembership`** coordinator; swappable flat vs graph persist impl. |
| **S1-7** | **Apply API input** | **Decided:** public **`MembershipApplyArgs`** = `{ characterId, targetRoomId \| null }`; returns **`MembershipApplyResult`** with `from`, `to`, `changed`. **`updatePositionGraphs`** is internal slice 2 persist only. See [Apply API shape (**S1-7**)](#apply-api-shape-s1-7-and-no-op-gate-s1-8). |
| **S1-8** | **No-op gate** | **Decided:** emit only when **`MembershipApplyResult.changed`** (`from !== to`); slice 2 uses same gate on graph **`MembershipDiff`**. See [Apply API shape (**S1-7**)](#apply-api-shape-s1-7-and-no-op-gate-s1-8). |
| **S1-9** | **`RoomStack`-only mutation** | **Decided:** no **`Character Moved`** (room endpoint unchanged) |
| **S1-10** | **Exit-aware copy (slice 1)** | **Decided:** trust parse (**S1-1** extension). Add **`exitName`** to **`Character Navigate`** intent (**F1-9**); fan-in exit-aware when intent has **`exitName`**; **do not** populate **`legalExits`** on fact slice 1. See [Exit-aware copy (**S1-10**)](#exit-aware-copy-s1-10--fan-in-f1-9). |
| **S1-11** | **Side-effect gating** | **Decided:** single **`changed`** gate drives fact + cache + **`RoomUpdate`** + **`EphemeraUpdate`** bundle; do not preserve legacy per-effect gates. See [Side-effect gating (**S1-11**)](#side-effect-gating-s1-11). |
| **S1-12** | **Connect path in slice 1** | **Decided:** defer --- slice **1** = navigate + disconnect through membership API only; connect facts + `applyCharacterRoomMembership` routing land slice **3** (may coordinate with slice **2** storage cutover; not a slice **1** requirement). Fan-in connect intent wiring stays; end-to-end connect emission tests defer to slice **3**. |
| **S1-13** | **Persistence vs orchestration** | **Decided:** move Dynamo membership writes, roster projection, cache memo, **`RoomUpdate`**, **`EphemeraUpdate`** room projection into **`positions/membership/`** flat persist + coordinator; keep PerceptionThreads header, render kicks, **`MapUpdate`** in navigate orchestration. See [Persistence vs orchestration (**S1-13**)](#persistence-vs-orchestration-s1-13). |
| **S1-14** | **Slice 1 TEMP fact emit vs slice 2 graph-diff** | **Decided** --- this section |

When remaining rows ship, graduate rules to [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and remove from **Open decisions** below. **Slice 1 open decisions:** all resolved --- graduate at implementation.

## Migration strategy (routing-first)

**Option B (chosen):** localize **processing** first on **legacy storage**, then swap the persistence implementation to room play `positionGraph`.

| Phase | Slice | What changes | What stays stable |
| --- | --- | --- | --- |
| **Localize execution** | **1** (+ finish **0** disconnect alignment) | Ingress (`Character Navigate`), orchestration (perception threads, `RoomUpdate`, caches), **single membership persistence API**; optional **`mtw-gateways` read surface** (see S1-5) | Dynamo still uses `activeCharacters`, `RoomId`, `RoomStack`; readers may stay on `RoomCharacterList` until S1-5 / slice 2 |
| **Storage swap** | **2** | `Meta::Room.positionGraph`, **`updatePositionGraphs`** persistence impl, graph-diff **`Character Moved`** (replaces slice 1 TEMP emit), `activeCharacters` projection; swap read gateway if not done in slice 1 | Orchestration and ingress paths from slice 1 |
| **Unify ingress** | **3** | Connect path through same API (retire `CheckLocation` bridge) | --- |
| **Legacy cleanup** | **4** | `disconnectMessage`, `Disconnect Character` ingress | --- |
| **Richer graphs** | **5+** | In-room edges, objects in graph, inventory subgraphs, stream outbounds | --- |

**Slice 1 success criterion (not optional):** every character **room-membership** mutation (disconnect today; navigate after slice 1; connect after slice 3) goes through **one** positions-owned **membership persistence boundary** --- even though slice 1 still writes flat fields and uses **TEMP intent-assisted fact emit (**S1-14**)**. Slice 2 rewrites **only that module** to **`updatePositionGraphs`** + graph-diff facts (**F1-8** steady state), not every caller across the lambda.

Thin routing (`subscribe -> publish MoveCharacter` to legacy handler) **does not** satisfy slice 1.

## Slice sequence (implementation)

| Slice | Goal | Doc graduation |
| --- | --- | --- |
| **0** (done) | `mtw.connections.characters` presence ingress | Contract + implementation + concepts Shipped |
| **1a** | Localize membership **execution**: persistence API, `Character Navigate` -> positions, disconnect refactor; optional Model A beat anchor; legacy header render + imperative world copy OK | Contract + implementation |
| **1b** | Membership **emission**: **`Character Moved`** at persistence apply (**S1-14** TEMP slice 1) for **navigate + disconnect**; intent + fact fan-in; publish world lines after correlation; retire imperative suppress/copy on `MoveCharacter` | Contract + implementation; coordinates with fan-in Phase 1--2 |
| **2** | **`Meta::Room` play `positionGraph`** + **`updatePositionGraphs`**; graph-diff **`Character Moved`** (replace TEMP emit); projection to `activeCharacters` | Contract; concepts Target -> Shipped for room play graph (character nodes) |
| **3** | Unify **connect** through membership API (retire `CheckLocation` bridge) | Contract + implementation |
| **4** | Retire `disconnectMessage` / legacy `Disconnect Character` | Contract; slim parent event docs |
| **5+** | In-room edges, object placement in graph, container graphs, stream outbounds | Concepts + contract as each lands |

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making **in order to implement** the next slice(s). Do **not** copy into [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md). When a decision ships, record it in [`AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) / [`AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and **remove** the row here. Convention: [`taskPlanning/AGENT.md`](../../../../AGENT.md#open-decisions-implementation--plan-only).

### Slice 1

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| S1-1 | On navigate execute: **trust** actions exit resolution (`toRoomId`) vs **re-validate** topology in positions | 1 | **Decided:** trust --- positions applies the validated `toRoomId`; no topology re-check at persistence apply. Exit-aware **copy** also trusts parse: **`exitName`** on **`Character Navigate`** intent (**S1-10** / **F1-9**). |
| S1-2 | Cross-room side effects: **1a** --- legacy header render (`PerceptionThreads` / kick render) + optional **Model A** `beatAnchorTime`; imperative leave/arrive until **1b** fan-in emission. **1b** --- fan-in emission policy ([`AGENT.fanInPattern.planning.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md)). Conversations fragment handoff: [`conversations/AGENT.planning.md`](../../../../../../lambda/ephemera/conversations/AGENT.planning.md) | 1a / 1b | **Decided:** sequencing milestones, not an either/or fork. **Beat/header (Model A + slim `characterMove` targeting)** stays independent of fan-in. With **fan-in Phase 0 + 1 before positions slice 1**, skip building interim imperative leave/arrive --- land persistence boundary together with `Character Moved` + fan-in emission (no separate 1a-then-1b copy path). Header render remains legacy PerceptionThreads through fan-in Phase 2. |
| S1-3 | Slice 1 egress: **bus-only** vs positions **stream outbound** for navigate | 1 | **Decided:** positions **`streamEvent`** outbound on `mtw.ephemera.positions` (`publisherStrategy: 'busOnly'`); types in [`publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts). Same net delivery as bus-only today --- difference is **scope-of-authority** (positions owns the stream contract). |
| S1-5 | **`mtw-gateways` positions read surface** (roster projection from play state): land in **slice 1** (v1 projects `activeCharacters`; wire [`AffordanceRoomDeliverable`](../../../../../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) via `internalCache`) vs **slice 2** (paired with `positionGraph` storage swap only) | 1 | **Shipped:** [`packages/mtw-gateways/ts/ephemera/positions/`](../../../../../../packages/mtw-gateways/ts/ephemera/positions/); **`internalCache.Positions`**; affordance compose roster via **`getRoomRoster`**. Slice 2 swaps backing read to stored graph. |
| S1-6 | **Diff source for `from`/`to`:** slice 1 pre-read + apply target vs slice 2 graph-diff | 1b / 2 | **Decided:** slice 1 = **`CharacterMeta.RoomId`** pre-read + apply target (**S1-14**). Slice 2 = **`MembershipDiff`** from **`updatePositionGraphs`**. |
| S1-9 | **`RoomStack`-only mutation** (same room endpoint): emit fact or skip | 1b | **Decided:** skip --- no **`Character Moved`** |
| S1-10 | **Exit-aware copy (slice 1):** **`exitName`** on navigate intent; no **`legalExits`** on fact | 1b | **Decided:** trust action-parse (**S1-1** extension). See [Exit-aware copy (**S1-10**)](#exit-aware-copy-s1-10--fan-in-f1-9). Optional **`legalExits`** on contract unused until post-slice-2 spike if needed. |
| S1-12 | **Connect path:** slice 1 vs defer | 1b | **Decided:** defer to slice **3** (connect-unification milestone; not slice **1**). Slice **1** ships navigate + disconnect through membership API; connect keeps `CheckLocation` / `moveCharacter` bridge. Fan-in connect **intent** adapters remain; positions **`Character Moved`** for connect deferred. |
| S1-14 | **Slice 1 TEMP fact emit** (intent-assisted flat path) vs **slice 2 graph-diff** (**F1-8** steady state) | 1b / 2 | **Decided:** slice 1 TEMP with code comments; slice 2 cutover bundle replaces emit path. No virtual-graph write adapter in slice 1. |

**Graduated to contract / implementation (slice 1a):** S1-4 (module layout), S1-5 (read surface), S1-7 (apply API), S1-8 (no-op gate), S1-11 (side-effect bundle), S1-13 (persistence vs orchestration), navigate ingress + actions cutover.

**S1-5 context (shipped):** Affordance compose reads roster via **`internalCache.Positions.getRoomRoster`** (gateway-backed; slice 1 projects from `activeCharacters` on miss). Exits remain gateway-backed **`AffordanceCache`** + **`ComponentTopology`**. Slice 2 swaps backing read to stored `Meta::Room.positionGraph` without changing handler API.

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

- [X] **Slice 1a --- persistence boundary (legacy storage)**
  - [X] Resolve **Open decisions** S1-1 through S1-14 (all slice **1** decisions resolved)
  - [X] Add **`positions/membership/`** module layout per **S1-4** (`applyCharacterRoomMembership` coordinator + flat persist impl)
  - [X] Implement flat persist + coordinator per **S1-13** + **S1-11** (membership-changed bundle when **`changed`**: persist, cache, **`RoomUpdate`**, **`EphemeraUpdate`**); slice 1b adds TEMP fact emit per **S1-14** in **`buildCharacterMovedFact`** / **`streamMembershipFact`**
  - [X] Refactor **disconnect** handler to call **`applyCharacterRoomMembership`** (not inline `optimisticUpdate`)
  - [X] Extract navigate **orchestration** from `moveCharacter` per **S1-13** (PerceptionThreads header, render kicks, **`MapUpdate`**); wire navigate persist through **`applyCharacterRoomMembership`**
  - [X] Optional **Model A**: at persistence apply, stamp **`beatAnchorTime`** from **fact** recorded time + header **`MessageId`**; publish with explicit **`createdTime`** (leave/arrive via fan-in emission per **S1-2**)
  - [X] Subscribe positions to `Character Navigate`; remove imperative `MoveCharacter` from actions
  - [X] Grep: no new direct `Meta::Room.activeCharacters` writes outside persistence API + documented exceptions
  - [X] Add `mtw-gateways/ts/ephemera/positions/` read surface (v1: **`positionGraph`** API; slice 1 adapter projects from flat fields); register on `internalCache`; point **`AffordanceRoomDeliverable`** roster path (and memo `set`/`invalidate` from persistence API) at handler --- not raw `ephemeraDB` in compose path
  - [X] Graduate docs: contract + implementation for persistence path; clear resolved Open decision rows
  - [X] Parity tests (actions, moveCharacter, positions disconnect + navigate; affordance deliverable if S1-5 = slice 1a)

- [X] **Slice 1b --- fact producer (membership-changed bundle + stream)**
  - [X] **`buildCharacterMovedFact`** + **`streamMembershipFact`**: **`Character Moved`** at persistence apply (**S1-14** TEMP: pre-read `from`, apply target `to`, no-op gate **S1-8**); **`TEMP slice 1`** comments at fact-builder seam; **`beatAnchorTime`** (**F1-4**); **omit** **`legalExits`** (**S1-10**)
  - [X] Wire fact stream into membership-changed bundle (**S1-11**): when **`changed`**, emit fact with cache memo, **`RoomUpdate`**, **`EphemeraUpdate`**
  - [X] Scope: **navigate + disconnect** through **`applyCharacterRoomMembership`**; connect deferred (**S1-12** / slice **3**). Contract: [`publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts) (shipped)
  - [X] **Fan-in consumer (external):** track publish + end-to-end emission tests in [`AGENT.fanInPattern.planning.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md#recommended-order) Phase **1**

- [ ] **Slice 2 --- `Meta::Room` play `positionGraph` + graph-diff facts (cutover bundle)**
  - [X] Resolve **Open decisions** S2-1 through S2-3
  - [ ] Add `positionGraph` (or agreed shape) to [`EphemeraMetaRoom`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)
  - [ ] Implement **`updatePositionGraphs`** (immer draft, holistic diff, decomposed **`transactWrite`** + denorm / **`activeCharacters`** projection per S2-2); swap into **`applyCharacterRoomMembership`** (**S1-4**)
  - [ ] Replace slice 1 TEMP fact builder with **MembershipDiff**-only **`Character Moved`** emit; delete **`TEMP slice 1`** comments; graduate **F1-8** to contract
  - [ ] Swap positions read gateway from flat projection to stored graph (S1-5)
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

**Slice 1b gate:** fan-in emission tests --- cross-room leave+arrive with exit-aware copy when navigate intent carries **`exitName`** (**S1-10**); disconnect leave-only; generic copy at deferral when intent absent; world lines use Model A anchor times. Slice 1 facts may use TEMP intent-assisted emit (**S1-14**). Connect arrive-only deferred to slice **3** (**S1-12**).

**Slice 2 gate:** **`updatePositionGraphs`** + graph-diff **`Character Moved`**; no remaining **`TEMP slice 1`** emit path; persistence API tests against `positionGraph` + projection invariants; affordance/roster smoke paths unchanged for players.

---

## Progress

| Milestone | Status |
| --- | --- |
| Slice 0 code | Done |
| Phase 0 durable docs | Done |
| Slice 1a: persistence boundary | Done |
| Slice 1b: fact producer (`Character Moved` + **S1-11** bundle) | Done (fan-in publish for navigate + disconnect --- [fan-in Phase 1](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.fanInPattern.planning.md#recommended-order)) |
| Slice 2: `Meta::Room` play graph storage swap | Not started |
| Slice 3--4: connect unify + legacy retirement | Not started |
| Initiative close | Not started |
