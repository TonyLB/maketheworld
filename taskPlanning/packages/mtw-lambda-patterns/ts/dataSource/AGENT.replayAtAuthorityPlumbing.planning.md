# replayAt authority plumbing (DataSource + mtw.wml)

**Status:** in progress (partially complete). Next: Phase C - evaluate Dynamo cursor alignment (`snapshotHeader.replayAt` with fallback) and complete Phase D verification/docs.

This file is task-scoped. See [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability, checkbox conventions, and what belongs here vs in package docs.

## Purpose

1. **Framework:** Ensure delegated work inside **`snapshotContentGenerator`** (for example S3 snapshot creation and presign) can supply an authoritative **`replayAt`** that reflects **post-delegation** reality, not only values read before delegation runs.
2. **mtw.wml:** Use that pattern so subscribe-time snapshots align **`replayAt`** with the **mint time of the presigned sidecar** (manifest snapshot for the object returned), fixing cases where a new S3 snapshot is created but the returned cursor still reflects an earlier Dynamo read.

Durable constraint for **content vs auth** and why a single joined snapshot is misleading: [`lambda/wml/dataSource/AGENT.md`](../../../../../lambda/wml/dataSource/AGENT.md).

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task plan conventions |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) | Snapshot metadata, `snapshotContentGenerator`, `replayAt` vs `createdAt` |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | `generateSnapshot`, `storeSnapshotToStore`, Meta::Snapshot shape |
| [`packages/mtw-lambda-patterns/ts/dataSource/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) | `generateSnapshot`, `resolveReplayCursorTimestamp` |
| [`lambda/wml/dataSource/snapshotContent.ts`](../../../../../lambda/wml/dataSource/snapshotContent.ts) | WML generator orchestration |
| [`lambda/wml/s3Storage/snapshotPresign.ts`](../../../../../lambda/wml/s3Storage/snapshotPresign.ts) | Presign, optional `createManualSnapshot`, **`snapshotTimestamp`** (manifest mint ms for the presigned row) |

## Background (problem statement)

- **`generateSnapshot`** in the DataSource already prefers **`replayAt`** returned from the generator when present (see `generateSnapshot` in [`index.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts)).
- **`generateWmlSnapshotContent`** currently sets **`replayAt`** from an **initial** Dynamo `Meta::Snapshot` read, then may call **`getPresignedSnapshotUrl`** with **`createSnapshotFirst`**, which can mint a **new** manifest snapshot. The returned **`replayAt`** is not refreshed from the manifest row for the object that was presigned, so the cursor can lag the sidecar.
- **`getLatestSnapshotTimestampFromDynamo`** reads **`snapshotHeader.timestamp`**. Stored rows also carry **`snapshotHeader.replayAt`** (see **`storeSnapshotToStore`**). Aligning the **query lower bound** with the same field used for replay may require a follow-up (prefer **`replayAt`** with fallback to **`timestamp`**), scoped in **Recommended order** below.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) (snapshot metadata and `snapshotContentGenerator`).
3. Read [`lambda/wml/dataSource/AGENT.md`](../../../../../lambda/wml/dataSource/AGENT.md) (content vs auth constraint).
4. Trace [`snapshotContent.ts`](../../../../../lambda/wml/dataSource/snapshotContent.ts) and [`snapshotPresign.ts`](../../../../../lambda/wml/s3Storage/snapshotPresign.ts) for the current ordering bug.

## Owner

- TBD - assign when scheduled.

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| A | Presign path exposes sidecar mint time to the generator | Done | **`getPresignedSnapshotUrl`** returns **`snapshotTimestamp`** (ms) for the presigned manifest row; shared parse in [`lambda/wml/s3Storage/snapshotPresign.ts`](../../../../../lambda/wml/s3Storage/snapshotPresign.ts) |
| B | WML generator sets `replayAt` from that authority after presign | Done | `generateWmlSnapshotContent` now returns presigned sidecar mint time (`snapshotTimestamp`) as `replayAt` |
| C | Optional: Meta::Snapshot read uses `replayAt` for event bound | Done | `getLatestSnapshotTimestampFromDynamo` now prefers `snapshotHeader.replayAt` with fallback to `snapshotHeader.timestamp` |
| D | Tests + docs touch-up | In progress | Framework replayAt guard exists; WML tests are currently blocked by existing Jest transform/config issues in this workspace |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [X] **Phase A - Delegated authority (plumbing)**
  - [X] Extend **`getPresignedSnapshotUrl`** (or a small helper it calls) to return the **manifest timestamp** (ms) of the **same** snapshot object that was presigned, alongside **`wml.sidecarUrl`**. Reuse the same parsing logic as **`getLatestSnapshotTimestamp`** where practical to avoid drift.
  - [X] Update **`getPresignedSnapshotUrl`** unit tests in [`lambda/wml/s3Storage/snapshotPresign.test.ts`](../../../../../lambda/wml/s3Storage/snapshotPresign.test.ts).
- [X] **Phase B - mtw.wml generator**
  - [X] In **`generateWmlSnapshotContent`**, after **`getPresignedSnapshotUrl`**, set returned **`replayAt`** to the **mint time of the returned sidecar** (from Phase A), per [`lambda/wml/dataSource/AGENT.md`](../../../../../lambda/wml/dataSource/AGENT.md) (single descriptor for content; one `replayAt` matches one URL).
  - [X] Update [`lambda/wml/dataSource/snapshotContent.test.ts`](../../../../../lambda/wml/dataSource/snapshotContent.test.ts) (including manifest fallback / `createSnapshotFirst` true cases).
- [X] **Phase C - Dynamo cursor alignment (optional but recommended)**
  - [X] Evaluate **`getLatestSnapshotTimestampFromDynamo`**: use **`snapshotHeader.replayAt`** when present, else **`snapshotHeader.timestamp`**, so the event query lower bound matches the stored replay cursor contract.
  - [X] Add or adjust tests so **`Meta::Snapshot`** fixtures with **`replayAt`** differ from **`timestamp`** behave as intended.
- [ ] **Phase D - Framework regression guard**
  - [X] Confirm **`generateSnapshot`** still merges generator **`replayAt`** correctly; existing coverage is present in [`packages/mtw-lambda-patterns/ts/dataSource/index.test.ts`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/index.test.ts) (`should preserve authoritative replayAt from snapshotContentGenerator`).
  - [ ] Run **`packages/mtw-lambda-patterns`** tests from package root (Jest per [`packages/mtw-lambda-patterns/AGENT.md`](../../../../../packages/mtw-lambda-patterns/AGENT.md) / `package.json` scripts) and WML tests covering **`snapshotContent`** / **`snapshotPresign`**.

## Verification

- All **Recommended order** checkboxes for shipped phases are `[X]`.
- **`npx jest`** (or **`npm test`**) from **`packages/mtw-lambda-patterns`** passes for touched DataSource tests.
- Lambda WML tests for **`snapshotContent`** and **`snapshotPresign`** pass.
- Grep for **`generateWmlSnapshotContent`** and **`getPresignedSnapshotUrl`** call sites updated if signatures change.

## When this task finishes

1. Move any remaining **steady-state** rules from this plan into [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) only if the framework contract changed in a general way.
2. Keep [`lambda/wml/dataSource/AGENT.md`](../../../../../lambda/wml/dataSource/AGENT.md) as the home for **WML storage vs subscribe** constraints.
3. Archive or delete this planning file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
