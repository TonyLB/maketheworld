# Player heal authority and mesh alignment

Status: in progress. Phases 0-5 complete (heal authority moved to assets, Cognito mesh cutover landed, double-heal eliminated). **Next:** Phase 6 optional player misalignment sweep, or proceed directly to Phase 7 closeout if the optional sweep is deferred. Per-environment Phase 5 dev/staging verification still pending (record results in **Progress**).

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Purpose

Move **player heal** (guest meta repair + personal library projection for downstream consumers) out of **diagnostics** and under **assets** authority, where Dynamo **`PLAYER#` / `Meta::Player`** and the assets table already live. Align **Cognito signup signaling** with a proper **`mtw.cognito`** EventBridge contract and DataSource-style publishing. Reduce **duplicate heals** from overlapping Cognito and Step Functions paths. Optionally add a **diagnostics-only player misalignment sweep** (**`Player Misalignment Finding`**, **D5**) with **assets** subscribing to heal---mirroring the room-occupancy drift pattern.

## Problem statement

Today:

- Imperative heal logic runs in [`lambda/diagnostics/player/index.ts`](../../../lambda/diagnostics/player/index.ts) (**`healPlayer`**; **`healAllPlayers`** exists but is **unwired**---see **D6**).
- EventBridge **`mtw.connections` / `New Player`** is emitted from [`lambda/cognitoEvent/app.ts`](../../../lambda/cognitoEvent/app.ts) PostConfirmation but is misleading semantically; [`template.yaml`](../../../template.yaml) routes it **only** to **Diagnostics**.
- [`lambda/assets/app.ts`](../../../lambda/assets/app.ts) contains a **PostConfirmation** branch that starts the heal Step Functions ([`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml)); **SAM does not attach Assets as a Cognito trigger**, so that branch is **dead** for template-deployed stacks (see **D1**). Double-heal risk is rather **EventBridge `New Player` -> diagnostics heal** vs **Step Functions `HealPlayer`** when SFN is started from some other caller---enumerate in Phase 0.

Diagnostics should remain **analysis and findings** where possible; assets mutations belong in **assets**.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) (durability ladder, Recommended order checkbox conventions, verification pattern).
2. Read steady-state boundaries (update after refactor in code-adjacent `AGENT.md`, not only here):
   - [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md)
   - [`lambda/assets/AGENT.event.md`](../../../lambda/assets/AGENT.event.md) (event mesh context for assets)
3. Inspect current implementations:
   - [`lambda/diagnostics/player/index.ts`](../../../lambda/diagnostics/player/index.ts)
   - [`lambda/diagnostics/dataSource/index.ts`](../../../lambda/diagnostics/dataSource/index.ts) (`New Player`, `HealPlayer` branches)
   - [`lambda/diagnostics/ingress.ts`](../../../lambda/diagnostics/ingress.ts), [`lambda/diagnostics/dataSource/apiDiagnostics.ts`](../../../lambda/diagnostics/dataSource/apiDiagnostics.ts)
   - [`lambda/cognitoEvent/app.ts`](../../../lambda/cognitoEvent/app.ts)
   - [`lambda/assets/app.ts`](../../../lambda/assets/app.ts) (PostConfirmation / Step Functions)
   - [`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml)
4. Pattern references:
   - [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)
   - Existing **finding consumer** precedent: [`lambda/ephemera/dataSource/selfHealing/roomOccupancyDriftFinding.ts`](../../../lambda/ephemera/dataSource/selfHealing/roomOccupancyDriftFinding.ts) (subscribe to diagnostics finding, repair in owning domain).

### Testing command authority

- **Assets lambda** uses Jest per [`lambda/assets/package.json`](../../../lambda/assets/package.json) (`npm test` from `lambda/assets`). If root or workspace scripts wrap this, prefer the package-local script when they conflict.
- **Diagnostics lambda**: run its package tests after peeling heal paths (`lambda/diagnostics`).
- **Interfaces**: run package tests under `packages/mtw-interfaces` when adding `mtw.cognito` types and serializers.

### Baseline verification (before edits)

From `lambda/assets`, run `npm test` once and confirm green (or record known flakes in Progress).

## Design targets (steady state)

- **Authority**: Assets owns heal **writes** to the assets table for player meta and library projection used by heal consumers.
- **Cognito signal**: **`source: mtw.cognito`**, **`detail-type: New Player`**, payload **`{ player }`** only; shared **`mtw-interfaces`** wire format and DataSource **`streamEvent`** / EventBridge boundary (see **D3**).
- **Diagnostics**: No subscribe/handle for **`New Player`** as heal; no **`HealPlayer`** imperative command unless temporarily shimmed during migration. Optional deferred sweep emits **`Player Misalignment Finding`** (**D5**).
- **Orchestration**: [`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml) invokes **Assets** (not Diagnostics) for the heal task; return payload remains compatible with **`Update Ephemera`** merge unless that contract is intentionally versioned.
- **Imperative invoke (SFN / direct)**: Route through **`api.assets`** synthetic envelope + DataSource **`receiveEvents`**, not a stand-alone heal branch in **`app.ts`** (see **D4**). **`ReturnValue`** matches existing **`healPlayer`** (**`Characters`**, **`Assets`**, **`guestName`**, **`guestId`**).
- **Single signup path**: Resolve **double-heal** by choosing one primary PostConfirmation orchestration (emit domain event only, or SFN only, or SFN called from one place); document in durable docs.
- **Cutover**: **`New Player`** mesh cutover is intended as **atomic** (see **D2**): Assets ready + Cognito emits **`mtw.cognito`** + Diagnostics unsubscribed in one coordinated deploy.
- **Bulk / backlog repair**: No Cognito **`ListUsers`** hammer (**`healAllPlayers`**); deferred **player misalignment sweep** (**D5**, **`Player Misalignment Finding`**) plus targeted heals addresses the same operational need more efficiently (see **D6**, Phase 6).

## Decisions (resolved)

All **D1** through **D7** are locked; pending vs completed for **implementation** is tracked in **Recommended order** below. Convention: resolved lines use `[X]`.

- [X] **D1 - Cognito trigger topology**
  - [X] **PreSignUp** (`PreSignUp_SignUp`): Keep as a **separate functional thread** at the **app/handler level** in [`lambda/cognitoEvent/app.ts`](../../../lambda/cognitoEvent/app.ts). It deliberately mutates **`event.response`** (e.g. **`autoConfirmUser`**) for Cognito contract semantics. **Do not** fold PreSignUp into the DataSource **`streamEvent`** / mesh path for **`New Player`**---that path is for **PostConfirmation** outbound publishing only.
  - [X] **PostConfirmation (SAM)**: [`template.yaml`](../../../template.yaml) attaches **PostConfirmation** only to **`CognitoHandlerFunction`** (`lambda/cognitoEvent`). **`AssetsFunction`** defines **no** `Type: Cognito` trigger---only EventBridge-driven **`Events`**. Refactor work for **`New Player`** publishing stays on **cognitoEvent** PostConfirmation unless the stack is intentionally customized outside this template.
  - [X] **Assets handler PostConfirmation branch**: The **`PostConfirmation_ConfirmSignUp`** block in [`lambda/assets/app.ts`](../../../lambda/assets/app.ts) (starts **`HEAL_SFN`**) is **dead code** for stacks deployed from this template: Cognito never invokes Assets as PostConfirmation. Caveat: a **manually** attached User Pool trigger in AWS Console would still invoke that branch (verify non-SAM environments). Remove or replace during this initiative once SFN entry moves as planned.

- [X] **D2 - Cutover strategy for `New Player`**
  - [X] Prefer **atomic single deploy**: **Phase 2** (Assets heal + **`mtw.cognito`** subscription) and **Phase 3** (Cognito **`DataSource`** publishes **`mtw.cognito`** instead of **`mtw.connections`**) together position **Phase 4** (drop Diagnostics **`New Player`** + EventBridge rule) in **one** coordinated release. No dual-publish window unless rehearsal or rollback policy explicitly requires it.
  - [X] **`mtw.connections` / `New Player`** retires in that same cutover (Diagnostics rule and publisher both removed/updated together).

- [X] **D3 - Wire contract (`mtw-interfaces`)**
  - [X] EventBridge **`source`**: **`mtw.cognito`**. **`detail-type`**: **`New Player`** (aligned with existing mesh naming; replaces misleading **`mtw.connections`** for this signal).
  - [X] Payload: **`{ player }`** only---no extra correlation or pool-id fields for observability in v1.

- [X] **D4 - Assets ingress shape for imperative heal** (direct invoke / Step Functions, distinct from EventBridge **`New Player`**)

  Direct invokes surface as **`event`** shape on [`lambda/assets/app.ts`](../../../lambda/assets/app.ts).

  - [X] **Synthetic `api.assets` envelope**: Parse **`event.message`** / payload, enqueue an internal envelope (same idea as [`sendApiDiagnosticsEvent`](../../../lambda/diagnostics/dataSource/apiDiagnostics.ts)), **`messageBus.flush()`**, heal runs inside **`mtw.assets`** DataSource **`receiveEvents`**---shared path with EventBridge **`mtw.cognito` / `New Player`** when both normalize to the same handler body. **Not** using a dedicated imperative-only branch in **`app.ts`** for heal.

  - [X] **`ReturnValue` / SFN contract**: Locked to existing Diagnostics **`healPlayer`** shape---**`Characters`**, **`Assets`**, **`guestName`**, **`guestId`**---so **[`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml)** and **`Update Ephemera`** stay unchanged. Implementation still needs to **verify** end-to-end; contract changes require an intentional version bump elsewhere.

- [X] **D5 - Player misalignment sweep (deferred implementation; contract locked)**
  - [X] **Entry**: **Direct invoke only** (like other diagnostics sweeps), not scheduled in v1.
  - [X] **Finding** **`detail-type`**: **`Player Misalignment Finding`** (on **`mtw.diagnostics`**, consistent with other finding emissions).
  - [X] **Payload**: **`player`** (required), **`diagnosticRunId`** (optional), for sweep correlation---no extra evidence fields in v1.

- [X] **D6 - `healAllPlayers`**
  - [X] **Remove** [`healAllPlayers`](../../../lambda/diagnostics/player/index.ts) when **`healPlayer`** leaves diagnostics (it is **unwired** in the repo today---no callers).
  - [X] **Do not port** a blunt-force **ListUsers** + heal-all equivalent under assets as part of this initiative.
  - [X] **Conceptual replacement**: a **deferred** diagnostics **player misalignment sweep** (Phase 6 / **D5**, **`Player Misalignment Finding`**) that emits **findings** only, plus **assets** subscribing to heal **per finding**, achieves the same class of “clean up misaligned players” **more efficiently** than scanning the whole Cognito pool.

- [X] **D7 - Documentation cleanup**
  - [X] Removed obsolete **`connectionsRefactor`** task-plan link from [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md) (that plan was deleted after completion); **Related docs** now points to **this** plan.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines as you go; parent `[X]` when all children are done.

- [X] **Phase 0 - Inventory and baseline**
  - [X] Confirm Cognito trigger targets and list all code paths that call **`healPlayer`** (EventBridge, SFN, direct invoke). (**`healAllPlayers`** is unused---see **D6**.)
  - [X] Baseline tests: `lambda/assets` `npm test`, `lambda/diagnostics` tests, relevant `mtw-interfaces` tests.

- [X] **Phase 1 - Contracts (`mtw-interfaces`)**
  - [X] Add **`mtw.cognito`** EventBridge types, headers, and serializer/deserializer patterns consistent with [`packages/mtw-interfaces/ts/eventBridge`](../../../packages/mtw-interfaces/ts/eventBridge).
  - [X] Unit tests for serialization round-trip where applicable.

- [X] **Phase 2 - Assets: heal implementation and subscription**
  - [X] Move or reimplement **`healPlayer`** (and helpers) under **`lambda/assets`**; keep behavior and **return shape** compatible with [`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml) / Update Ephemera (see **D4** **`ReturnValue`**).
  - [X] Delete **`healAllPlayers`** from diagnostics when removing **`healPlayer`** (**D6**).
  - [X] Add EventBridge rule in [`template.yaml`](../../../template.yaml): **`mtw.cognito`** + agreed **`detail-type`** -> **AssetsFunction**.
  - [X] Add DataSource **`receiveEvents`** (or extend existing assets DataSource) to handle **`New Player`** and run heal **idempotently**.
  - [X] Add **`api.assets`** (or chosen) path for **direct / SFN** invoke with **`ReturnValue`** extraction mirroring diagnostics pattern ([`lambda/assets/returnValue`](../../../lambda/assets/returnValue)).

- [X] **Phase 3 - Cognito lambda: DataSource publish**
  - [X] Refactor [`lambda/cognitoEvent/app.ts`](../../../lambda/cognitoEvent/app.ts) to use **`DataSource`** and **`streamEvent`** for **`mtw.cognito`** instead of manual **`PutEvents`** to **`mtw.connections`**.
  - [X] Extend **`template.yaml`** for cognito lambda env vars (bus name, feedback topic if required by pattern, etc.) per DataSource needs.
  - [X] Tests or harness acceptable for PostConfirmation publish path.

- [X] **Phase 4 - Cutover and diagnostics retirement**
  - [X] Deploy **atomically** per **D2** (single release with Phase 2 and Phase 3 already merged: Cognito publishes **`mtw.cognito`**, Assets subscribes, Diagnostics does not).
  - [X] Remove **`New Player`** handling from [`lambda/diagnostics/dataSource/index.ts`](../../../lambda/diagnostics/dataSource/index.ts) and guards from [`lambda/diagnostics/dataSource/subscribedEvents.ts`](../../../lambda/diagnostics/dataSource/subscribedEvents.ts).
  - [X] Remove **`HealPlayer`** from [`lambda/diagnostics/ingress.ts`](../../../lambda/diagnostics/ingress.ts), [`lambda/diagnostics/app.ts`](../../../lambda/diagnostics/app.ts), [`lambda/diagnostics/dataSource/apiDiagnostics.ts`](../../../lambda/diagnostics/dataSource/apiDiagnostics.ts).
  - [X] Update **DiagnosticsFunction** EventBridge rule in [`template.yaml`](../../../template.yaml): drop **`New Player`** from the pattern (keep **`Session Disconnect Problem`** if still needed).
  - [X] Point [`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml) **Resource** at **Assets**; update parameters if ingress shape changes.

- [X] **Phase 5 - Eliminate double-heal**
  - [X] Remove dead **`PostConfirmation`** / **`HEAL_SFN`** branch from [`lambda/assets/app.ts`](../../../lambda/assets/app.ts) once SFN invokes Assets directly (per **D1**, SAM never wired this path). Also dropped now-orphan **`AssetsFunction`** template entries: **`HEAL_SFN`** and **`COGNITO_POOL_ID`** env vars, **`StepFunctionsExecutionPolicy`** for **`${TablePrefix}_heal_step_function`**, and **`cognito-idp:ListUsers`** statement (the last two left over from **D6** **`healAllPlayers`**); **`HealStateMachine`** resource itself retained for ad-hoc operator invocations.
  - [X] Documented dev/staging one-heal-per-signup protocol and the SAM-only Cognito trigger assumption in **Verification** below.

- [X] **Phase 6 - Optional: player misalignment sweep**
  - [X] Implemented read-only sweep in diagnostics; emits **`mtw.diagnostics`** / **`Player Misalignment Finding`** per **D5** through direct-invoke **`PlayerMisalignmentSweep`**.
  - [X] Subscribed assets heal path to **`Player Misalignment Finding`**; remediation uses idempotent **`healPlayer`**.
  - [X] Sweep now acts as the **efficient substitute** for old **`healAllPlayers`** intent: evidence-driven targeting from assets-table misalignment signals (missing player meta, missing guest fields, coyote guest-name mismatch), not full Cognito enumeration (**D6**).

- [ ] **Phase 7 - Close out**
  - [ ] Update durable docs: [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md), [`lambda/assets/AGENT.event.md`](../../../lambda/assets/AGENT.event.md), [`lambda/cognitoEvent`](../../../lambda/cognitoEvent) if present, root [`AGENT.md`](../../../AGENT.md) index if needed.
  - [ ] Rewrite stale **`healPlayer`** references in [`lambda/diagnostics/AGENT.schema.planning.md`](../../../lambda/diagnostics/AGENT.schema.planning.md) (lines ~156-178 still describe `healPlayer` as living in `lambda/diagnostics/player/index.ts`; after this initiative it lives at [`lambda/assets/player/heal.ts`](../../../lambda/assets/player/heal.ts) and is invoked through the assets DataSource lane).
  - [ ] Remove or archive **this** plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

## Progress

| Milestone | Notes |
| --- | --- |
| Contracts | Added `mtw.cognito` contract module + serializer + guards in `packages/mtw-interfaces/ts/eventBridge/cognito`, exported via `eventBridge/index.ts`, and covered by new unit tests. |
| Assets heal + subscribe | Ported `healPlayer` to `lambda/assets/player/heal.ts`; wired `mtw.cognito/New Player` and `api.assets/HealPlayer` through assets DataSource; added `AssetsFunction` EventBridge rule for `mtw.cognito`; removed diagnostics `healPlayer`/`healAllPlayers`; direct `type: HealPlayer` invoke now routes through assets synthetic ingress and returns message-bus `ReturnValue` shape. |
| Cognito publish | Added `lambda/cognitoEvent` message-bus/DataSource publish lane (`api.cognito` -> `mtw.cognito` via `streamEvent`), removed direct `PutEvents` publishing from `app.ts`, added focused Jest coverage (`app.test.ts`, `ingress.test.ts`, `dataSource/index.test.ts`), and wired `FEEDBACK_TOPIC` env var for Cognito DataSource configuration parity. |
| Diagnostics / template / SFN cutover | Removed diagnostics `mtw.connections/New Player` subscribed-event guards and no-op branch, removed `New Player` trigger from `DiagnosticsFunction` EventBridge pattern, and switched `HealStateMachine` substitution/task resource/policy from `DiagnosticsFunction` to `AssetsFunction` while preserving `type: HealPlayer` parameters and return-shape compatibility for `Update Ephemera`. |
| Double-heal resolved | Removed dead `PostConfirmation_ConfirmSignUp` / `HEAL_SFN` branch from `lambda/assets/app.ts`; dropped now-orphan `AssetsFunction` template entries (`HEAL_SFN` and `COGNITO_POOL_ID` env vars, `StepFunctionsExecutionPolicy` for `${TablePrefix}_heal_step_function`, `cognito-idp:ListUsers` statement); updated durable docs (`lambda/assets/AGENT.event.md`, `lambda/cognitoEvent/AGENT.md`) to assert `AssetsFunction` is not a Cognito trigger and heal entry is mesh + `api.assets` only. Dev/staging one-heal-per-signup protocol and non-SAM Cognito trigger enumeration documented in Verification; per-environment verification still pending. |
| Optional sweep | Added diagnostics direct-invoke `PlayerMisalignmentSweep` read-only evaluator and `Player Misalignment Finding` emitter; assets now subscribes to finding and runs idempotent `healPlayer`; `template.yaml` includes `Player Misalignment Finding` under `AssetsFunction` diagnostics rule. |

### Phase 0 inventory snapshot

- Cognito trigger wiring (SAM): [`template.yaml`](../../../template.yaml) wires **`PostConfirmation`** and **`PreSignUp`** to **`CognitoHandlerFunction`** only; **`AssetsFunction`** has no `Type: Cognito` event source.
- `healPlayer` call paths currently active:
  - EventBridge: `mtw.connections` / `New Player` -> diagnostics DataSource handler in [`lambda/diagnostics/dataSource/index.ts`](../../../lambda/diagnostics/dataSource/index.ts) (guarded by [`lambda/diagnostics/dataSource/subscribedEvents.ts`](../../../lambda/diagnostics/dataSource/subscribedEvents.ts)).
  - Direct invoke: diagnostics command `type: HealPlayer` routed via [`lambda/diagnostics/app.ts`](../../../lambda/diagnostics/app.ts) -> [`lambda/diagnostics/ingress.ts`](../../../lambda/diagnostics/ingress.ts) -> diagnostics DataSource.
  - Step Functions: [`stepFunctions/heal.asl.yaml`](../../../stepFunctions/heal.asl.yaml) currently invokes **`DiagnosticsFunction`** with `type: HealPlayer`.
- Baseline before edits (2026-05-07): `lambda/assets`, `lambda/diagnostics`, and `packages/mtw-interfaces` test suites all green using package-local Jest scripts (`npm run test` in each package).

## Verification

Repeat these after each risky phase; adjust paths if workspace scripts change.

- `cd lambda/assets && npm test`
- `cd lambda/diagnostics && npm test` (when diagnostics changes land)
- `cd packages/mtw-interfaces && npm test` (when interfaces change)
- Phase 0 baseline (2026-05-07): all three suites passed (`lambda/assets` 21/21, `lambda/diagnostics` 5/5, `packages/mtw-interfaces` 19/19 pre-change).
- Phase 1 verification (2026-05-07): `cd packages/mtw-interfaces && npm run test -- eventBridge` and full `cd packages/mtw-interfaces && npm run test` both passed after `mtw.cognito` contract additions.
- Phase 2 verification (2026-05-07): `cd lambda/assets && npm run test`, `cd lambda/diagnostics && npm run test`, and `cd packages/mtw-interfaces && npm run test` all passed after assets heal-authority wiring.
- Phase 3 verification (2026-05-07): `npm --prefix "lambda/cognitoEvent" run test` and `npm --prefix "lambda/assets" run test` both passed after Cognito DataSource publish refactor.
- Phase 4 verification (2026-05-07): `npm --prefix "lambda/diagnostics" run test`, `npm --prefix "lambda/assets" run test`, and `npm --prefix "lambda/cognitoEvent" run test` all passed after diagnostics retirement + template/SFN cutover.
- Phase 5 verification (2026-05-07): `npm --prefix "lambda/assets" run test` (21 suites / 172 tests), `npm --prefix "lambda/cognitoEvent" run test` (3 suites / 5 tests), and `npm --prefix "lambda/diagnostics" run test` (5 suites / 24 tests) all passed after dead-branch and AssetsFunction template-orphan removal.
- Phase 6 verification (2026-05-07): `npm --prefix "packages/mtw-interfaces" run test` (20 suites / 425 tests), `npm --prefix "lambda/diagnostics" run test` (6 suites / 28 tests), and `npm --prefix "lambda/assets" run test` (21 suites / 173 tests) all passed after player-misalignment contract + sweep + finding-consumer wiring.
- Manual or integration: confirm EventBridge rule delivers **`mtw.cognito` / `New Player`** to Assets only after cutover; confirm **`HealPlayer`** SFN step returns payload **`Update Ephemera`** accepts.

### Phase 5 dev/staging protocol (one heal per signup)

Run after deploying the Phase 5 template change. Repeat per environment (dev, staging) before promoting.

1. **Sign up a fresh Cognito user** through the normal client / hosted UI flow (or `aws cognito-idp sign-up` followed by auto-confirm via `PreSignUp`).
2. **Confirm exactly one `mtw.cognito` / `New Player` publish** for the signup. Either:
   - CloudWatch Logs Insights against `CognitoHandlerFunction` log group:
     ```
     fields @timestamp, @message
     | filter @message like /streamEvent|New Player|api\.cognito/
     | sort @timestamp desc
     | limit 50
     ```
     Expect a single `streamEvent` for the new `userName`.
   - Or CloudWatch metric on the `AssetsFunction` EventBridge rule for `mtw.cognito` (`Invocations` should increment by exactly **1** for the signup window).
3. **Confirm exactly one heal in `AssetsFunction`** by tailing its log group and looking for the `HealPlayer` DataSource path (`api.assets` synthetic envelope or `mtw.cognito` mesh entry, both run idempotent heal). Expect a single heal log line per signup.
4. **Confirm `HealStateMachine` execution count is zero** for the signup window:
   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn arn:aws:states:<region>:<account>:stateMachine:<TablePrefix>_heal_step_function \
     --max-results 50
   ```
   Filter by start time around the signup; expect zero new executions (no in-tree code starts heal SFN now).

### Phase 5 Cognito trigger assumption (SAM-only)

This initiative assumes SAM-managed infrastructure only. In this repository's expected deployment model, Cognito triggers are managed exclusively in `template.yaml`, where `PostConfirmation` and `PreSignUp` are attached to `CognitoHandlerFunction` and not to `AssetsFunction`.

Because this team does not configure Cognito triggers manually in AWS, no additional non-SAM trigger enumeration is required for this slice.

## Related documentation

- [`taskPlanning/AGENT.md`](../../AGENT.md)
- [`lambda/diagnostics/AGENT.md`](../../../lambda/diagnostics/AGENT.md)
- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)
