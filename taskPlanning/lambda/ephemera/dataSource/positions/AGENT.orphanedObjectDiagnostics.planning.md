# Orphaned improvised object diagnostics (spawn S1 follow-up)

**Status:** Phase 1 complete. **Next:** Phase 2 --- sweep + finding (diagnostics lambda).

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, open decisions, recommended-order checkboxes). **Dispose** after the initiative ships and lasting rules live in [`lambda/ephemera/dataSource/objects/`](../../../../../lambda/ephemera/dataSource/objects/) and [`lambda/diagnostics/`](../../../../../lambda/diagnostics/) `AGENT*.md` siblings.

**Follow-up to shipped spawn refactor:** two-step spawn+place is steady state ([`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md), [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) **S1**). [`spawnOneImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) compensates with `persistDeleteImprovisationObject` on placement failure; when compensation also fails, it logs only today. This initiative replaces log-only with operational diagnostics.

---

## Purpose

Detect and surface **orphaned improvised objects**: existence rows present (improvisation pair + `Meta::Object`) with **no** positions-lane placement (empty `getMembershipContainers` / absent from all room `positionGraph` object nodes).

Primary operational trigger: **S1 double-failure** --- placement fails after successful existence create, then `persistDeleteImprovisationObject` compensation also fails ([`spawnOneImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts)). Today that path logs only:

```63:67:lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts
            console.error('[mtw.ephemera.objects] spawn placement failed; compensation delete failed', {
                objectId: args.objectId,
                placementError,
                deleteError: deleteResult.errorMessage,
            })
```

Deliver the same signal as a **problem report** on `mtw.ephemera.objects` that triggers a read-only diagnostics **sweep**, which emits **`Orphaned Improvised Object Finding`** on `mtw.diagnostics` for operators (and optional downstream repair).

**Non-goals for initial slice:**

- Placement retry repair (**O1** locked to delete-on-finding for Coyote Game v1; other contexts may need different repair later).
- Inverse drift (graph placement without pair/meta rows) --- different finding; out of scope here.
- Changing **S1** / **S2** / **S3** spawn coordinator semantics (already shipped).

---

## Problem statement

After the spawn refactor, existence and placement are **two atomic steps**. **S1** rolls back existence when placement fails. When compensation delete fails, the system can leave durable rows with no graph membership --- invisible to Coyote occupancy, affordance compose, and in-room catalogs that key off **placement**, not existence alone ([`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) **S1** note).

Without diagnostics, orphans are discoverable only via CloudWatch grep on the compensation-failure log line. We need the same **problem report -> sweep -> finding** backstop used elsewhere (e.g. `mtw.connections` / `Session Disconnect Problem` -> `staleSessionSweep` -> `Stale SessionId Finding` per [`lambda/diagnostics/AGENT.md`](../../../../../lambda/diagnostics/AGENT.md)).

### Orphan classification (normative for this initiative)

| Signal | Orphan when |
| --- | --- |
| Existence | `(OBJECT#, ASSET#IMPROVISATION)` pair row **and** `(OBJECT#, Meta::Object)` row both present |
| Placement | `internalCache.Positions.getMembershipContainers(objectId)` returns **empty** (no adjacency / no graph-derived membership) |

**Explicit non-orphan:** object on graph with adjacency lag only --- handled by existing object placement drift repair ([`repairObjectPlacementDrift`](../../../../../lambda/ephemera/dataSource/positions/membership/repairObjectPlacementDrift.ts)), not this finding.

### Worked example (orphan litmus)

Concrete ids reused from [`spawnImprovisationObjectsBatch.test.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.test.ts): **`OBJECT#Skates`**, **`ROOM#Cafe`**. Phase 2 **`classification.test.ts`** should mirror these rows.

**Classifier (target):** orphan **iff** pair row present **and** meta row present **and** `getMembershipContainers(objectId)` is empty. Sweep also requires an **`Object`** node absent from every room **`positionGraph`** (equivalent to empty containers for this initiative).

#### Positive --- S1 double-fail orphan (emit finding)

Trigger: [`spawnOneImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) --- placement fails, then compensation delete fails.

| Step | Durable state |
| --- | --- |
| `persistSpawnImprovisationObject` ok | `(OBJECT#Skates, ASSET#IMPROVISATION)` pair + `(OBJECT#Skates, Meta::Object)` written |
| `applyObjectRoomMembership` fails | No **`Object`** node for **`OBJECT#Skates`** on **`ROOM#Cafe`** (or any room) graph |
| `persistDeleteImprovisationObject` fails | Pair + meta rows **remain** |
| Sweep reads | Pair: present; meta: present; `getMembershipContainers('OBJECT#Skates')` -> `[]` |

**Outcome:** emit **`Orphaned Improvised Object Finding`** for **`OBJECT#Skates`**. Problem report intake (**O2**) passes **`objectIds: ['OBJECT#Skates']`** from the **`Spawn Compensation Problem`** payload.

#### Negative --- healthy spawn (no finding)

| Pair | Meta | Graph / containers | Outcome |
| --- | --- | --- | --- |
| present | present | `getMembershipContainers` -> `[ROOM#Cafe]` | **Not orphan** --- skip |

#### Negative --- adjacency lag only (no finding)

| Pair | Meta | Graph / containers | Outcome |
| --- | --- | --- | --- |
| present | present | **`Object`** node on **`ROOM#Cafe`** graph; `getMembershipContainers` -> `[]` or missing **`ROOM#Cafe`** | **Not orphan** --- [`repairObjectPlacementDrift`](../../../../../lambda/ephemera/dataSource/positions/membership/repairObjectPlacementDrift.ts) owns adjacency sync |

#### Negative --- partial existence (no finding)

| Pair | Meta | Graph / containers | Outcome |
| --- | --- | --- | --- |
| present only | absent | `[]` | **Not orphan** --- incomplete existence |
| absent | present | `[]` | **Not orphan** --- incomplete existence |

---

## Target steady state (after merge)

| Concern | Owner | Entry |
| --- | --- | --- |
| Problem report emission | Objects lane | `spawnOneImprovisationObject` S1 double-fail path (and any future compensation-failure hooks) |
| Problem report intake + sweep trigger | Diagnostics lambda | Subscribe to `mtw.ephemera.objects` problem report; run `orphanedImprovisedObjectSweep` |
| Read-only classification | Diagnostics lambda | Enumerate candidate `OBJECT#` ids; verify pair + meta + empty containers |
| Finding emission | Diagnostics lambda | `mtw.diagnostics` / `Orphaned Improvised Object Finding` |
| Repair (Phase 4) | Objects lane | On **`Orphaned Improvised Object Finding`** -> **`persistDeleteImprovisationObject`** (idempotent; **O1**) |

### Event flow (target)

```mermaid
sequenceDiagram
    participant Objects as mtw.ephemera.objects
    participant EB as EventBridge
    participant Diag as mtw.diagnostics
    participant Repair as optional repair owner

    Objects->>EB: Spawn Compensation Problem
    EB->>Diag: problem report intake
    Diag->>Diag: orphanedImprovisedObjectSweep
    Diag->>EB: Orphaned Improvised Object Finding
    EB->>Repair: Phase 4 delete repair (O1)
```

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for checkbox and verification conventions.
2. Read spawn **S1** steady state:
   - [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (**Spawn + place**, **S1**)
   - [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (object room membership **S1** compensating delete)
   - [`spawnImprovisationObjectsBatch.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) and [`spawnImprovisationObjectsBatch.test.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.test.ts)
3. Read diagnostics house patterns (problem report vs finding):
   - [`lambda/diagnostics/AGENT.md`](../../../../../lambda/diagnostics/AGENT.md) (**Connections problem-report intake**, **Room Occupancy Drift sweep**)
   - [`packages/mtw-interfaces/ts/eventBridge/connections/index.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/connections/index.ts) (`Session Disconnect Problem` shape: `sourceOperation`, `attemptCount`, `dedupeKey`)
   - [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts) (finding types + `DiagnosticsEventSerializer`)
   - [`lambda/diagnostics/dataSource/index.ts`](../../../../../lambda/diagnostics/dataSource/index.ts) (intake dedupe + sweep dispatch)
4. Read placement read surface used by sweep:
   - [`packages/mtw-gateways/ts/ephemera/positions/`](../../../../../packages/mtw-gateways/ts/ephemera/positions/) (`getMembershipContainers`, adjacency query helpers)
   - [`packages/mtw-gateways/ts/ephemera/improvisation/`](../../../../../packages/mtw-gateways/ts/ephemera/improvisation/) (pair reads; `ASSET#IMPROVISATION`)
5. **Command authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) and diagnostics Jest from `lambda/diagnostics/`.

**Baseline before edits:**

```bash
cd lambda/ephemera
npm run test -- --watchAll=false \
  dataSource/objects/spawnImprovisationObjectsBatch.test.ts \
  dataSource/objects/applyObjectsChange.test.ts

cd lambda/diagnostics
npm run test -- --watchAll=false \
  dataSource/index.test.ts \
  app.test.ts
```

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in durable `AGENT.contract.md` / `AGENT.implementation.md` / `AGENT.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **O1** | **Repair owner and behavior:** **(b) objects lane** --- on **`Orphaned Improvised Object Finding`**, call **`persistDeleteImprovisationObject`** (idempotent). Sufficient for Coyote Game v1; non-Coyote orphan contexts may need different repair later (out of scope until product asks). | Phase 4 | **Decided** |
| **O2** | **Sweep scope on problem report:** **targeted** --- classify **`objectId`** from the problem report payload only. **Direct invoke** on **`api.diagnostics`** may still run a **full scan** when **`objectIds`** is omitted (ops backstop). | Phase 2 | **Decided** |
| **O3** | **Problem report `detail-type` name:** **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** (mirror **`Session Disconnect Problem`** on **`mtw.connections`**). | Phase 1 | **Decided** |
| **O4** | **EventBridge contract home:** add **`objects`** submodule under [`packages/mtw-interfaces/ts/eventBridge/ephemera/`](../../../../../packages/mtw-interfaces/ts/eventBridge/ephemera/) (e.g. **`eventBridge/ephemera/objects/index.ts`**). Split to a dedicated directory if the module outgrows a single file. | Phase 1 | **Decided** |
| **O5** | **Finding payload:** **`objectId` required**; **`diagnosticRunId`** for sweep correlation (house pattern). No **`stableKey`** or **`sourceOperation`** echo on the finding wire in v1. | Phase 2 | **Decided** |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark each nested line `[X]` as it is done.

- [X] **Phase 0 --- Decide**
  - [X] Lock **O1**--**O5** (at minimum **O2**, **O3**, **O4**, **O5** before implementation).
  - [X] Confirm orphan litmus (pair + meta + empty containers) with one worked example in plan or test fixture.

- [X] **Phase 1 --- Problem report (objects lane)**
  - [X] Add EventBridge contract + serializer for **`Spawn Compensation Problem`** on **`mtw.ephemera.objects`** (**O3**, **`eventBridge/ephemera/objects/`** per **O4**): `objectId`, `targetRoomId`, `sourceOperation`, `placementError`, `deleteError`, `attemptCount`, `dedupeKey`, `timestamp` (mirror connections problem-report fields where applicable).
  - [X] Wire `ephemeraObjectsDataSource` (or shared stream helper) to **`streamEvent`** the problem report on S1 double-fail --- **in addition to** existing `console.error` (keep log until ops confirms EventBridge delivery).
  - [X] Unit tests: compensation double-fail emits problem report with expected payload + dedupeKey stability.

- [ ] **Phase 2 --- Sweep + finding (diagnostics lambda)**
  - [ ] Implement [`orphanedImprovisedObjectSweep/`](../../../../../lambda/diagnostics/) (new module): classify orphans per litmus above; use gateway reads (`ImprovisationComponentData` / pair get, meta get, `queryMembershipContainersFromDynamo` or diagnostics-local equivalent).
  - [ ] Add **`Orphaned Improvised Object Finding`** to [`packages/mtw-interfaces/ts/eventBridge/diagnostics`](../../../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts) + serializer round-trip tests.
  - [ ] Subscribe diagnostics DataSource to **`mtw.ephemera.objects`** problem report; invocation dedupe by `dedupeKey` (reuse [`intakeDeduper`](../../../../../lambda/diagnostics/dataSource/intakeDeduper.ts) pattern --- generalize or parallel handler).
  - [ ] Direct invoke entry: `{ type: 'OrphanedImprovisedObjectSweep', objectIds?: string[], diagnosticRunId?, nowMs? }` on **`api.diagnostics`** (**O2**: problem-report intake passes **`objectIds: [objectId]`**; omit **`objectIds`** for full-scan ops backstop).
  - [ ] Tests: problem report triggers sweep; malformed report dropped; dedupe; finding emission for confirmed orphan; no finding when placement exists.

- [ ] **Phase 3 --- Durable docs**
  - [ ] Update [`lambda/diagnostics/AGENT.md`](../../../../../lambda/diagnostics/AGENT.md): problem-report intake, sweep, finding contract.
  - [ ] Update [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md): S1 double-fail emits problem report (not log-only).
  - [ ] Update [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): cross-reference orphan finding (existence-without-placement).
  - [X] Trim follow-up bullets from parent spawn refactor plan or link here once Phase 1--3 ship (parent plan disposed; follow-up tracked in this document).

- [ ] **Phase 4 --- Repair (**O1** = delete on finding)**
  - [ ] Objects lane handler on **`Orphaned Improvised Object Finding`** -> **`persistDeleteImprovisationObject`** (idempotent).
  - [ ] Unit tests: confirmed orphan finding triggers delete; no-op when rows already absent.
  - [ ] Note in durable docs: Coyote Game v1 repair is delete-only; placement retry remains a future product fork if needed.

- [ ] **Phase 5 --- Close**
  - [ ] Run verification commands below.
  - [ ] Delete this planning file (git retains history).

---

## Wire shapes (locked --- Phase 0)

### Problem report (`mtw.ephemera.objects`)

**`detail-type`:** **`Spawn Compensation Problem`** (**O3**). Contract home: **`packages/mtw-interfaces/ts/eventBridge/ephemera/objects/`** (**O4**).

```typescript
{
  type: 'Spawn Compensation Problem'
  objectId: EphemeraObjectId
  targetRoomId: EphemeraRoomId
  sourceOperation: 'spawnOneImprovisationObject' | string
  placementError: string
  deleteError: string
  attemptCount: number
  dedupeKey: string   // e.g. `${objectId}::spawnCompensation::${attemptCount}`
  timestamp: string
}
```

**Emission site:** replace-or-augment log block in [`spawnOneImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) when `!placeResult.ok && !deleteResult.ok`.

**Dedupe:** diagnostics intake suppresses repeated reports with the same `dedupeKey` within one lambda invocation (same as [`Session Disconnect Problem`](../../../../../lambda/diagnostics/dataSource/intakeDeduper.ts)).

### Finding (`mtw.diagnostics`)

**`detail-type`:** **`Orphaned Improvised Object Finding`**. Payload: **`objectId`** required, **`diagnosticRunId`** for sweep correlation (**O5**).

```typescript
{
  type: 'Orphaned Improvised Object Finding'
  objectId: EphemeraObjectId
  diagnosticRunId: string
  timestamp: string
}
```

Diagnostics remains **report-only** through Phase 2--3. Phase 4 (**O1**) adds objects-lane delete repair on the finding.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Phase 0 (decisions + litmus) | Done |
| **O1**--**O5** decided | Done |
| Problem report contract + emission | Done |
| Sweep + finding | Not started |
| Durable docs updated | Not started |
| Optional repair (**O1**) | Not started |

---

## Verification

After Phase 1--2:

```bash
cd lambda/ephemera
npm run test -- --watchAll=false dataSource/objects/

cd lambda/diagnostics
npm run test -- --watchAll=false \
  orphanedImprovisedObjectSweep/ \
  dataSource/index.test.ts \
  app.test.ts
```

**Problem report wired at S1 double-fail:**

```bash
rg -n "Spawn Compensation Problem|spawnCompensation" \
  lambda/ephemera/dataSource/objects/
```

**Finding type registered:**

```bash
rg -n "Orphaned Improvised Object Finding" \
  packages/mtw-interfaces/ts/eventBridge/diagnostics/ \
  lambda/diagnostics/
```

**Diagnostics intake subscribes to objects problem report:**

```bash
rg -n "Spawn Compensation Problem|mtw.ephemera.objects" \
  lambda/diagnostics/dataSource/
```

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`lambda/diagnostics/AGENT.md`](../../../../../lambda/diagnostics/AGENT.md) | Diagnostics sweeps and problem-report intake |
| [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) | Objects lane steady state |
| [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Placement normative rules (**S1**) |
| [`packages/mtw-interfaces/ts/eventBridge/AGENT.md`](../../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.md) | EventBridge contract authoring |
| [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) | Jest commands |
