# DataSource fan-in pattern (`mtw-lambda-patterns`)

**Status:** Phase 0 shipped. **Next:** Phase 1 --- membership presentation emission (`MembershipPresentationFanInCluster` in [`mtw.ephemera.perception`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md)).

## Purpose

Track a **generic DataSource fan-in processor** for **multi-leg ingress correlation** (Phase 1 proof case: membership **intent + fact** emission). Replaces bespoke side-bands for that class of problem --- not a wholesale replacement of [`PerceptionThreads`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts), which after Phases 1--2 should **slim to targeting-only** for async render delivery (Phase 3+).

Cluster specs: **partial clusters** accumulate legs in any order, **unify** when a leg proves two open partials are the same transition, complete when required legs are present, and handle **negative cases** (optional legs never arrive) via [`messageBus` deferral](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) at `flushAndSettle` tail.

**Dispose this file** when the pattern is shipped in steady-state docs, membership emission runs on fan-in, and PerceptionThreads consolidation (Phase 3+) is complete or explicitly deferred. Durable truth graduates to [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) and [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).

Framework conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Getting started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- durability ladder; open-decision convention; when to graduate rows into package docs
2. [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) + [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- DataSource subscribe / `receiveEvents` shape the fan-in hooks attach to
3. [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) --- `registerDeferral`, `afterSettled`, interaction with `flushAndSettle`
4. [`lambda/ephemera/AGENT.narrativeTranscript.concepts.md`](../../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md) --- fictional **`CreatedTime`**, delivery looseness vs correlation; fan-in specs must not re-encode accidental atomic-delivery constraints
5. [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- **Phase 1 consumer** (`MembershipPresentationFanInCluster`, `FanInClusterStore`, world-line emission); PerceptionThreads retirement target (Phase 2--3)
6. [`lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) --- fact leg producer (`Character Moved`); slice **1b** coordinates with Phase 1 here

Baseline (Phase 0; should pass before framework edits):

```bash
npm --prefix packages/mtw-lambda-patterns run test -- --watchAll=false ts/dataSource/
```

## Beat orchestration vs emission correlation

Two concerns were conflated in early planning (and in shipped [`characterMove`](../../../../../lambda/ephemera/moveCharacter/index.ts) PerceptionThreads). They are **separate**:

| Concern | Question | Owner (target) | Needs fan-in? |
| --- | --- | --- | --- |
| **Beat orchestration** | Where do leave / header / arrive sit in the **narrative transcript**? | **Model A**: **`beatAnchorTime`** = recorded time of the position move (**fact** at persistence apply); stable **`MessageId`**s; each leg publishes with explicit **`createdTime`** (`anchor - epsilon`, `anchor`, `anchor + epsilon`) when its content is ready | **No** --- header render is async and independent |
| **Emission correlation** | **Which** world lines to emit and **what copy**? | Fan-in on **intent + fact** legs; publish leave/arrive **after** correlation (or deferral) | **Yes** |

**Model A (beat):** fictional anchor = **fact** recorded time when membership apply completes (see **F1-4**). Leave, header, and arrive are **independent publishes** sorted by explicit times --- not by handler order, shared `OrchestrateMessages` burst, or "wait for `Generation Started`." Header Generating/terminal at the anchor time is consistent with existing revision semantics (position anchored to first publish for that **`MessageId`**).

**Fan-in (emission):** correlates **why** (action-parse or connection **intent**) with **that** (positions **fact** after membership apply) to decide:

- **Shape:** room-to-room (leave **and** arrive + header when applicable) vs into-play (arrive only) vs out-of-play (leave only).
- **Copy:** exit-aware vs home vs connect vs generic fallback when intent is absent at settle.

Fan-in **does not** gate header render lifecycle or beat timestamps. [`positions` slice 1b presentation emission](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#cross-initiative-dependencies) depends on fan-in Phase 0 + Phase 1; **`beatAnchorTime`** can be stamped at persistence apply in slice **1a** (see **F1-4**, positions **S1-2**).

### Model A beat-anchor pattern (positions creates; render consumes)

| Role | Owner | Phase 1 behavior |
| --- | --- | --- |
| **Define anchor** | Positions at persistence apply | `beatAnchorTime` on **`Character Moved`** fact leg |
| **Emission shape + copy** | Membership fan-in (`intent` + `fact`) | Leave/arrive **`WorldMessage`** after correlation; **`createdTime`** from anchor |
| **Header content + revision** | Perception orchestrate + render pipeline | Slim **`characterMove`** targeting; Generating/terminal on **`PerceptionFanInOrchestrationPayload`** path; header **`createdTime`** should align to anchor (not `getCurrentTimestamp()` at render kick) |

**Phase 1 limitations (render-blind emission):** Membership fan-in correlates only **`intent` + `fact`**. It does **not** subscribe to **`Render Pertains`**, **`Generation Started`**, **`Orchestration Error`**, or **`Generation Deferred`**. After correlation it publishes leave/arrive **without knowing** whether mover header render succeeded, failed, or was deferred. Header error placeholders stay on the render registry path in [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) --- decoupled from membership emission. Intentional tradeoff: stable fictional transcript position (anchor at fact) vs coupling world lines to render outcomes.

**Known gap:** Navigate stream does not carry **`exitName`**; fan-in falls back to **`genericNavigate`** until a later slice enriches intent or extends the stream.

**Future (deferred spike):** A richer fan-in spec might add optional **render outcome legs** (e.g. terminal **`Render Pertains`**, **`Orchestration Error`**) for render-aware leave/arrive policy --- without making render completion the fact or anchor source. Not an open decision row until product asks.

## Problem (first draft today)

[`PerceptionThreads`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) is a **per-invocation correlation registry** with known limits:

- **Bespoke** to perception --- not reusable by other DataSources.
- **Side-band enrollment** --- `Perception Thread Registered` or direct `internalCache.PerceptionThreads.register()` before downstream events (e.g. [`moveCharacter`](../../../../../lambda/ephemera/moveCharacter/index.ts) registers synchronously before transact so Leave/Arrive find a bucket).
- **Order-sensitive** --- register-first, then cascade.
- **Weak negative case** --- incomplete clusters mostly vanish at invocation `InternalCache.clear()` without a settle-time fallback.

## Framework API (Phase 0)

Per **DataSource instance** (see **F0-2**). Fan-in runs **inside** the DataSource subscription pipeline --- `receiveEvents` (or a helper it owns) routes legs through a local store; not an external wrapper around `receiveEvents` (**F0-1**).

### `FanInCluster` (abstract; concrete subclasses per spec)

Each fan-in **spec** is a subclass holding a **leg bag** and completion rules. Legs may arrive in **any order**; identity may be **provisional** until an authoritative leg (usually the **fact**) arrives.

| Method / property | Role |
| --- | --- |
| **`canAcceptLeg(leg)`** | Spec guard + no contradiction with legs already in this partial. |
| **`canUnifyWith(other)`** | Same transition, compatible endpoints --- not blind merge of unrelated partials. |
| **`unifyWith(other)`** | Merge leg bags; store removes the absorbed partial. |
| **`registerLeg(leg)`** | Add leg; recompute `completed`. |
| **`clusterIdentity()`** | Stable store key when computable (fact-authoritative per **F1-1**); `null` while provisional. |
| **`completed`** | All **required** legs for this spec are present. |
| **`handler(ctx, { deferralExecution })`** | Positive completion (`false`) or settle-time negative case (`true` -> `onDeferredIncomplete`). |

**Order independence:** any leg may **seed** a new open partial, **join** one compatible partial via `canAcceptLeg`, or trigger **`unifyWith`** when a leg (often the fact) proves two open partials are the same transition. Phase 1 membership emission is the degenerate case (one optional intent slot + one fact); the same machinery supports future **multi-intent** specs (e.g. separate leave-intent and arrive-intent partials unified by a cross-room fact).

**Unify guardrails (subclass responsibility):** same `characterId`; fact endpoints authoritative when present; reject endpoint contradictions; at most one leg per kind unless spec allows more; remove cluster from open store after non-deferral `handler` (no duplicate completion).

### `FanInClusterStore` (per DataSource instance)

| Operation | Role |
| --- | --- |
| **`route(leg)`** | Find join target via `canAcceptLeg`; else seed partial; after register, unify compatible open partials; fire `handler` when `completed`. |
| **`settleDeferrals()`** | For each still-open partial: `handler({ deferralExecution: true })`. |
| **`clear()`** | Drop open partials; wired to deferral **`onClear`** at invocation boundary. |

**Registry:** DataSource holds a list of cluster **constructors** to try per envelope (replaces ad hoc per-event-type branching in `receiveEvents`).

### Deferral (**F0-3**)

Each DataSource registers **one** `messageBus.registerDeferral` tag at subscribe/module load. **`afterSettled`** calls `fanInStore.settleDeferrals()`; **`onClear`** calls `fanInStore.clear()`. Document interaction with existing deferrals (e.g. publish coalescer).

Cross-link: [`InternalMessageBus.flushAndSettle`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (settle loop, then `runDeferrals()`).

### Wiring sketch

```typescript
// In receiveEvents (consumer DataSource):
for (const envelope of events) {
  const leg = await toFanInLeg(envelope)  // spec-specific; may be undefined
  if (leg) await fanInStore.route(leg)
  // ... non-fan-in domain logic ...
}
```

## Consumers (cross-initiative)

| Initiative | Depends on | Phase |
| --- | --- | --- |
| **Move emission policy** (intent + fact -> shape + copy) | Fan-in **Phase 0 + Phase 1** | Actions (or connections) emit **intent**; positions emit membership **fact**; **[`mtw.ephemera.perception`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md)** runs **`onComplete`** / **`onDeferredIncomplete`** then **`PublishMessage`** with times from pre-assigned beat anchor |
| [`positions` slice 1b emission](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#cross-initiative-dependencies) | Phase 0 + Phase 1 | **Not** a blocker for slice **1a** persistence boundary or Model A beat assignment. **Preferred order (positions S1-2):** fan-in Phase 0 + 1 **before** positions slice 1 --- then ship persistence + `Character Moved` + emission together (skip interim imperative copy). |
| **Model A beat orchestration** | **Independent** of fan-in framework | Stamp **`beatAnchorTime`** at position-move **fact** time (persistence apply); header kick/render stays on existing perception paths |
| **PerceptionThreads retirement (ordering / pre-bake)** | Phase 2 | Drop `characterMove` register-first + pre-baked `leaveWorldMessage` / `arriveWorldMessage` once emission fan-in owns world lines |
| **PerceptionThreads slim (targeting-only)** | Phase 3+ | After emission + beat decouple: keep **who** + **which render thread** at register; [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) correlates async render --- **not** migrated into generic fan-in specs by default |

## Proof case (Phase 1) --- membership presentation emission

**Consumer (decided):** [`mtw.ephemera.perception`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- **`MembershipPresentationFanInCluster`** + module-scoped **`FanInClusterStore`** on **`ephemeraPerceptionDataSource`**. Perception already owns leave/arrive **`PublishMessage`** today (via **`PerceptionThreads`** / [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts)); Phase 1 replaces **emission policy** there while positions stays **fact producer only**. Do **not** conflate with existing **`PerceptionFanInOrchestrationPayload`** (render **`Generation Started`** lifecycle --- separate concern).

**Parallel to PerceptionThreads** --- do not block Phase 0 on retiring all thread kinds. Phase 1 validates **emission policy only**, not beat orchestration or header render fan-in.

**Cluster legs (correlation **F1-1**; fact name **F1-3**):**

| Leg | Source (decided) | Carries |
| --- | --- | --- |
| **Intent** | **`mtw.ephemera.actions`** (**`Character Navigate`**, **`Character Home`** --- admin teleport deferred) + **`mtw.connections.characters`** (`Character Connected` / `Character Disconnected` per **F1-5**) | Why the transition happened; optional exit name |
| **Fact** | **`mtw.ephemera.positions`** `Character Moved` after persistence apply (**F1-3**) | That membership changed; **`characterId`**, **`from`** / **`to`** endpoints (authoritative cluster key per **F1-1**); **legal exits** for exit-aware copy (emit-time read; positions **does not** re-validate `toRoomId` at apply per positions **S1-1**); fact recorded time (**F1-4**) |

**F1-1 rationale (`requestId` rejected):** [`Character Connected` / `Character Disconnected`](../../../../../packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts) carry `characterId`, `sessionId`, `timestamp` only --- no `requestId`. [`Character Navigate`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) stream payload is `characterId`, `fromRoomId`, `toRoomId` only; `requestId` exists on **`Parse Requested`** ingress (for `ReturnValue`) but is not on the actions stream today and [`actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) discourages expanding navigate payload without positions scope.

**Correlation via partial clusters + unify:** stable **`clusterIdentity()`** comes from the **position-change fact** (`characterId` + `from` + `to` at persistence apply). Intent legs use the general **`canAcceptLeg` / `unifyWith`** path --- not a connections-only pending side table. Navigate intent often seeds a partial with full endpoints; connect/disconnect intent seeds a **provisional** partial (`characterId` + direction) unified when the fact arrives.

**F1-3 rationale (`Character Moved`):** positions emits **`Character Moved`** on **`mtw.ephemera.positions`** via **`streamEvent`** (internal bus envelope; not a bespoke `messageBus` message type). Externally a character move is "an object changed position," but **in-product** it is the **player point-of-view** relocating --- fan-in emission, beat anchoring, session orientation, and roster/affordance cascades all hang off that fact. A domain-specific name signals those consumers; payload shape (including out-of-play `from`/`to` encoding) lands in [`positions/publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts) at slice **1b** implementation.

**`onComplete` (intent + fact correlate):** build an **emission plan** then publish (using **`beatAnchorTime`** = fact recorded time when the beat applies --- **F1-4**):

| Correlated picture | World lines | Copy notes |
| --- | --- | --- |
| Room A -> Room B (in play) | Leave **and** arrive | Exit-aware when intent exit is in fact legal set; header kick separate (Model A anchor) |
| Out of play -> in play (connect) | Arrive **only** | e.g. " has connected." |
| In play -> out of play (disconnect) | Leave **only** | e.g. " has disconnected." |

**`onDeferredIncomplete` (fact at settle, no aligned intent):** infer shape from **fact endpoints**; generic copy (connect/disconnect/navigate/home without retained intent; admin teleport deferred to generic).

**Explicit non-goals for Phase 1:** correlating header **`Generation Started`** / **`Render Pertains`**; synchronous leave+header+arrive handler burst; replacing `OrchestrateMessages` offset trees for beat order (Model A explicit times instead).

**Phase 1 cluster shape (minimal):** strict **intent + fact** AND on positive completion; **`onDeferredIncomplete`** at settle when intent never arrives (fact-only). No optional legs, no in-process render outcomes, no pre-baked publish payloads on the cluster record.

## Phase 3+ --- PerceptionThreads: targeting-only consolidation

**Not** "migrate every thread kind into generic fan-in." Phases 1--2 move **membership emission** and **move beat baggage** out of PerceptionThreads. What remains is the job PerceptionThreads was always doing underneath the accreted complexity:

| At **register** | At **correlate** ([`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts)) |
| --- | --- |
| **Who** (`targets` --- one viewer, whole roster, connecting character only) | Match **`Render Pertains`** / orchestration lifecycle to **`(componentId, perspectiveKey)`** bucket |
| **Which thread kind** (`roomDescription`, `roomHeaderBroadcast`, `sessionOrientationRender`, mover header, ...) | Generating placeholder + terminal overwrite (**`messageId`**, **`createdTime`** T0) |
| Routing identity only on render ingress --- not full audience story | Publish **`PerceptionMessage`** to **registered targets only** |

That is **audience targeting + async render correlation**, not the Phase 0 two-leg AND processor. Render flows still have multi-step lifecycles (kick, **`Generation Started`**, terminal, error, fan-out across rows in one bucket). Default plan: keep that machinery in **perception orchestration** keyed off **slim registration rows**, rather than forcing each thread kind into **`fanInSpec`** unless a later spike shows real reuse.

**Consolidation goals:**

- Drop fields and thread behavior that duplicated **emission fan-in** (pre-baked world lines, leave/arrive dispatch flags) or **beat orchestration** (messageGroup ordering hacks).
- Treat registration as **capture delivery intent once** --- see [**Thread registration principle**](../../../../../lambda/ephemera/dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative) in perception docs.
- **`sessionOrientationAffordances`**: already largely targeting-only terminal on affordance channel; align with slim model.
- Document steady-state split: **fan-in** = intent/fact emission; **PerceptionThreads** (keep name; slim in place per **F3-1**) = render targeting registry.

**F3-2 --- mover header vs room affordances (decided):** two **separate** post-move kicks; do not conflate with fan-in or with each other.

| Kick | Audience | Mechanism (target) |
| --- | --- | --- |
| **Arrival room header (render)** | **Mover only** --- session orientation to the new room | Slim **`characterMove`** PerceptionThread registration (**targeting-only**: `targets`, `componentId`, `perspectiveKey`, `messageId`; no world-line fields). Optional UUID **`requestId`** on the render kick / registration row to ease correlation with [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (evaluate during Phase 3 slim; distinct from fan-in **F1-1**). |
| **Room affordances refresh** | **Everyone in the arrival room** (and departure room when roster changes) --- "who is here?", exits, etc. | **Separate** affordance path (today: **`RoomUpdate`** -> affordance orchestration). **Out of scope for this initiative:** generalizing to a positions **`Object Moved`** (or similar) stream consumer; defer until positions graph / richer move facts justify it. |

Beat orchestration (Model A anchor times for leave / header / arrive in the transcript) remains **outside** fan-in; the mover header row is **perception targeting only** after Phase 2 strips emission baggage.

**Not required for fan-in value (optional later):** re-homing render lifecycle into `mtw-lambda-patterns` fan-in specs is **possible** if a spike shows the abstraction pays off --- Phase 3+ default is slim **in-place** PerceptionThreads + orchestrate because that already delivers targeting without blocking Phases 0--1.

## Open decisions (implementation --- plan only)

Plan-only. When a decision ships, record in durable DataSource / messageBus docs and remove the row.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| F1-1 | **Fact-authoritative identity** (`characterId`, `from`, `to` at persistence apply) via `clusterIdentity()`; intent joins through **`canAcceptLeg` / `unifyWith`** (not `requestId`; not a connections-only pending table) | Phase 1 | Decided |
| F1-2 | Navigate + **home** **intent**: owned by **`mtw.ephemera.actions`** (not `api.ephemera` ingress). **Admin teleport deferred** out of Phase 1 (deferral/generic copy covers fact-only moves) | Phase 1 | Decided |
| F1-3 | Fact leg: **`Character Moved`** on **`mtw.ephemera.positions`** via **`streamEvent`** (not a bespoke bus message type) | Phase 1 | Decided |
| F1-4 | **`beatAnchorTime`**: align with recorded time of the position move (**fact** at persistence apply) | Phase 1 | Decided |
| F1-5 | Connect/disconnect **intent** leg: **`mtw.connections.characters`** stream (`Character Connected` / `Character Disconnected`) | Phase 1 | Decided |
| F1-6 | **Consumer DataSource:** [`mtw.ephemera.perception`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- cluster in **`perception/`**, extend **`subscribedEvents`** for actions + connections + positions intent/fact legs; positions does **not** own emission policy | Phase 1 | Decided |
| F1-7 | **`MembershipEndpoint`**: `null` = out of play (provisional; must match positions **`Character Moved`** payload at slice 1b) | Phase 1 | Decided |
| F3-1 | Phase 3 registry: **keep `PerceptionThreads` name**; slim in place (delete dead fields; no rename/split) | Phase 3 | Decided |
| F3-2 | Mover arrival **header**: **keep** slim **`characterMove`** PerceptionThread (targeting-only; optional UUID **`requestId`** on render kick for orchestrate match). **Affordance refresh** for all occupants: **separate** kick (today **`RoomUpdate`**); defer positions **`Object Moved`** generalization | Phase 3 | Decided |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [X] **Phase 0 --- framework pattern (`FanInCluster` + store)**
  - [X] Resolve **Open decisions** F0-1, F0-2, F0-3 (graduated to [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation))
  - [X] Implement abstract **`FanInCluster`** (`canAcceptLeg`, `canUnifyWith`, `unifyWith`, `registerLeg`, `clusterIdentity`, `completed`, `handler`)
  - [X] Implement **`FanInClusterStore`** (`route`, `settleDeferrals`, `clear`) with constructor registry
  - [X] Wire per-DataSource **`registerDeferral`** (`afterSettled` -> `settleDeferrals`, `onClear` -> `clear`; document coalescer interaction)
  - [X] Unit tests: leg order independence; provisional intent partial + fact unify; duplicate-leg rejection; deferral path; no double `handler`; multi-partial unify (synthetic two-intent fixture); mixed fan-in + non-fan-in batch
  - [X] Graduate API to [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)

- [ ] **Phase 1 --- membership presentation emission ([`mtw.ephemera.perception`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md); **F1-6**)**
  - [X] Resolve **Open decisions** F1-1, F1-2, F1-3, F1-4, F1-5, F1-6 (coordinate with [`positions` S1-2 / slice 1b](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md); positions **S1-1** trusts actions `toRoomId` at apply)
  - [X] **May ship cluster + unit tests on synthetic legs before positions persistence API exists** (positions **S1-2** preferred order)
  - [X] Perception: add **`MembershipPresentationFanInCluster`** in [`perception/membershipPresentationFanIn.ts`](../../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) (intent + fact legs; `canUnifyWith` / fact-authoritative identity per **F1-1**)
  - [X] Actions: add **`Character Home`** to [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) (**F1-2**); type + guard on the stream contract. **Emit** when home is resuscitated on the actions path (legacy [`executeAction`](../../../../../lambda/ephemera/parse/executeAction.ts) **`MoveCharacter`** until then). Distinct from **`Character Navigate`** so fan-in can set **`copyKind: 'home'`** (navigate-to-`HomeId` alone is not sufficient).
  - [X] Perception: extend [`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts) for **`mtw.ephemera.actions`** **`Character Navigate`** + **`Character Home`** intent adapters, **`mtw.connections.characters`** connect/disconnect intent (**F1-5**), **`mtw.ephemera.positions`** **`Character Moved`** fact (**F1-3**). Admin teleport **out of scope** for Phase 1. Leg mappers in [`membershipPresentationLegAdapters.ts`](../../../../../lambda/ephemera/dataSource/perception/membershipPresentationLegAdapters.ts).
  - [X] Perception: module-scoped **`FanInClusterStore`** + **`registerDeferral`** on [`index.ts`](../../../../../lambda/ephemera/dataSource/perception/index.ts); wire **`receiveEvents`** (fan-in legs vs existing perception handlers). Tag: **`fanIn-mtw.ephemera.perception`**; sequential batch loop; **`afterSettled`** skips settle when no open partials.
  - [ ] Positions: emit **`Character Moved`** from membership persistence API apply (navigate, connect, disconnect); contract in [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts) shipped
  - [ ] At persistence apply: stamp **`beatAnchorTime`** from **fact** recorded time + ids when beat applies (Model A); do **not** pre-bake world copy on registration
  - [X] Emission **policy** (shape + copy): **`buildMembershipEmissionPlan`** in [`membershipPresentationFanIn.ts`](../../../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) covers **`onComplete`** (intent + fact) and **`onDeferredIncomplete`** (fact-only / `deferralExecution`); unit-tested on synthetic legs. **Interim:** cluster **`handler`** still pushes plans onto **`ctx.plans`** --- staging only, not delivery.
  - [ ] **Publish** leave/arrive on correlation completion: add **`publishMembershipPresentation`** (or equivalent) called from cluster **`handler`** (pass **`messageBus`** on **`MembershipFanInHandlerContext`**) or a single emit helper at completion/deferral time; explicit **`createdTime`** from **`beatAnchorTime`** anchor (Model A). **Close staging seam:** retire **`ctx.plans`** accumulation and shrink/repurpose handler context once publish is wired. Kick header render independently (not gated on fan-in).
  - [ ] Ephemera tests: cross-room leave+arrive; connect arrive-only; disconnect leave-only; exit-aware copy; fact-only at settle; leg order independence
  - [ ] Document parallel operation with legacy imperative `MoveCharacter` suppress/copy flags until cutover

- [ ] **Phase 2 --- retire `characterMove` ordering / pre-bake PerceptionThreads**
  - [ ] Stop using `characterMove` PerceptionThreads to gate leave/arrive dispatch on `Generation Started` / `Render Pertains`
  - [ ] Remove pre-baked `leaveWorldMessage` / `arriveWorldMessage` on `PerceptionThreads.register`
  - [ ] Mover header: keep **`characterMove`** registration (targeting-only per **F3-2**); affordance refresh stays separate (`RoomUpdate` path until generalized)
  - [ ] Update [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) delivery paths table

- [ ] **Phase 3+ --- PerceptionThreads targeting-only consolidation**
  - [X] Resolve **Open decisions** F3-2 (F3-1 decided: keep name, slim in place)
  - [ ] Slim **`characterMove`** row: `targets`, routing identity, `messageId` (+ optional render-kick **`requestId`**); drop emission/beat fields
  - [ ] Document affordance kick as separate from mover header; note deferred **`Object Moved`** affordance consumer on positions
  - [ ] Audit each **`threadKind`**: delete emission/beat fields; keep **`targets`**, routing identity, revision ids
  - [ ] **`roomDescription`**, **`roomHeaderBroadcast`**, **`sessionOrientationRender`**: document as targeting registrations + orchestrate correlation (no fan-in migration required)
  - [ ] **`sessionOrientationAffordances`**: align with targeting-only terminal pattern
  - [ ] Slim or split mover header registration after Phase 2
  - [ ] Graduate perception docs: fan-in vs render registry responsibilities
  - [ ] Delete dead code paths; keep slim **in-place** `PerceptionThreads` registry (**F3-1**)

- [ ] **Close initiative**
  - [ ] Merge lasting **fan-in** pattern docs into package `AGENT*.md`
  - [ ] Confirm membership emission + slim render registry shipped or deferred with recorded decision
  - [ ] Delete this planning file

---

## Verification

From repo root (Phase 0):

```bash
npm --prefix packages/mtw-lambda-patterns run test -- --watchAll=false ts/dataSource/
```

Phase 1 adds ephemera perception / move tests:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/perception/ \
  dataSource/positions/ \
  moveCharacter/index.test.ts \
  dataSource/actions/index.test.ts
```

**Phase 0 gate:** cluster completes on any leg order (including intent-first provisional partial unified by fact); `settleDeferrals` runs once per invocation after settle; no duplicate non-deferral `handler` for same cluster; `unifyWith` rejects contradictory endpoints.

**Phase 1 gate:** correct emission shape (leave+arrive vs singleton) when intent + fact correlate; exit-aware copy when intent exit matches fact legal set; fact-only deferral yields endpoint-inferred shape + generic copy; published rows use explicit beat anchor times (Model A).

---

## Progress

| Milestone | Status |
| --- | --- |
| Phase 0: framework pattern | Done |
| Phase 1: membership presentation emission | In progress (policy + store wiring shipped; publish + retire `ctx.plans` staging pending) |
| Phase 2: retire characterMove ordering / pre-bake | Not started |
| Phase 3+: PerceptionThreads targeting-only | Not started |
| Initiative close | Not started |
