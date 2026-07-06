# Object embeddings (`EMBEDDING#IMPROMPTU`)

**Status:** Decisions locked (OE-1 -- OE-8). Next step: Bedrock embed invoke + row types, then spawn-coordinator wiring.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../AGENT.md).

Retire this plan when impromptu object embeddings ship on the **`mtw.ephemera.objects`** spawn path and durable docs record the steady-state row shape; git retains history.

## Purpose

Store a **semantic embedding adjacency row** in ephemeraDB for each improvisational **`OBJECT#`** created on the **objects lane** (`mtw.ephemera.objects`), alongside the existing pair + **`Meta::Object`** rows. The embedding is derived from the object's **`shortName`** (improvisation pair body), quantized with [`SemanticEmbedding`](../../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts), and persisted as a Dynamo-safe nested map on a dedicated adjacency sort key.

**Best-case vs absence:** a present **`EMBEDDING#IMPROMPTU`** row is the expected steady state after spawn; downstream readers must tolerate **missing** embedding rows. Bedrock embed failure **must not** block object creation (see OE-3).

**v1 row shape (target):**

```text
EphemeraId:     OBJECT#<uuid>
DataCategory:   EMBEDDING#IMPROMPTU
embedding:      SemanticEmbeddingDynamoRecord   // { modelId, dimensions, encoding, vector: Uint8Array, sourceTextHash? }
```

Later iterations may add perspective-scoped keys (for example `EMBEDDING#PERSPECTIVE#...`); v1 uses a single impromptu-scope row per object.

**Out of scope for v1 (unless this plan is updated):**

- Embedding-backed **`resolveObjectSpan`** / identity-stage fallback ([`resolveObjectSpan.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/resolveObjectSpan.ts); noted in [`semanticEmbedding/AGENT.md`](../../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.md))
- Read gateway / **`internalCache`** handler for embedding rows
- Re-embed on **`shortName`** update
- Vector search index or cross-room similarity queries

## Relationship to existing code

Improvisational objects today use a **three-way split** ([`objects/AGENT.md`](../../../../../../lambda/ephemera/dataSource/objects/AGENT.md)):

| Concern | Storage | Owner |
| --- | --- | --- |
| Merge body (`shortName`, future WML) | `(OBJECT#, ASSET#IMPROVISATION)` | objects lane |
| Play meta (`stableKey`, trope fields) | `(OBJECT#, Meta::Object)` | objects lane |
| Placement | **`positionGraph`** `Object` node + adjacency | positions lane |

This initiative adds a **fourth adjacency row** on the objects lane:

| Concern | Storage | Owner |
| --- | --- | --- |
| Short-name semantic vector (impromptu scope) | `(OBJECT#, EMBEDDING#IMPROMPTU)` | objects lane (new `embedding/` slice) |

**Spawn create paths (integration surface):** all improvisational object creation converges on the same coordinator --- embed attempt, then existence transact, then placement.

```text
Ingress A (Acme Order):
  parseCommand -> enrichAcmeOrder -> Acme Order bus
    -> handleAcmeOrderAddObjects (handleApiObjectsChange.ts)

Ingress B (Objects Change add):
  api.ephemera Objects Change -> applyObjectsChange (applyObjectsChange.ts)

Both:
  -> spawnImprovisationObjectsBatch / spawnOneImprovisationObject
  -> buildShortNameSemanticEmbedding (best-effort; OE-3)
  -> persistSpawnImprovisationObject (2- or 3-item transact: pair + Meta::Object [+ EMBEDDING#IMPROMPTU])
  -> applyObjectRoomMembership (placement; separate atomic step)
```

Embedding generation is an **external Bedrock call** and runs **before** the existence transact. When embed succeeds, the third **`Put`** is bundled in the **same `transactWrite`** as pair + **`Meta::Object`** (OE-2). When embed fails, spawn proceeds with the two-row transact only (OE-3).

**Delete / clear paths** must also remove **`EMBEDDING#IMPROMPTU`** when removing improvisation rows ([`persistDeleteImprovisationObject`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts), Coyote bulk clear, orphan repair) so destroyed objects do not leave orphan embedding adjacency.

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| `SemanticEmbedding` API, quantization, Dynamo serde | [`packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.implementation.md`](../../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/AGENT.implementation.md) |
| Binary `Uint8Array` round-trip through ephemeraDB handlers | [`packages/mtw-utilities/ts/dynamoDB/mixins/binaryRoundTrip.test.ts`](../../../../../../packages/mtw-utilities/ts/dynamoDB/mixins/binaryRoundTrip.test.ts) |
| Objects spawn sequencing (two-step existence + placement) | [`objects/AGENT.md`](../../../../../../lambda/ephemera/dataSource/objects/AGENT.md) |
| Acme Order -> spawn wiring | [`handleApiObjectsChange.ts`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) |
| Bedrock transport patterns | [`lambda/ephemera/llm/AGENT.md`](../../../../../../lambda/ephemera/llm/AGENT.md) |
| Ephemera lambda testing | [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../../AGENT.md) (durability, open decisions, checkbox conventions).
2. Read [`SemanticEmbedding`](../../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts) and run its unit tests (baseline).
3. Trace spawn coordinators: [`spawnImprovisationObjectsBatch.ts`](../../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) (callers: [`handleAcmeOrderAddObjects`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts), [`applyObjectsChange`](../../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.ts)) -> [`persistImprovisationObject.ts`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts).
4. Read existing transact helpers (`improvisationPairPutItem`, `metaObjectPutItem`, `deleteTransactItemsForObject`) in [`persistImprovisationObject.ts`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file.

**Baseline verification (should pass before edits):**

```bash
cd packages/mtw-lambda-patterns && npm test -- semanticEmbedding
cd packages/mtw-utilities && npm test -- binaryRoundTrip
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/objects/persistImprovisationObject.test.ts
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in durable docs (objects contract / implementation) and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| OE-1 | **Create-path scope** --- v1 writes **`EMBEDDING#IMPROMPTU`** on **every** improvisational spawn through **`mtw.ephemera.objects`** ([`spawnOneImprovisationObject`](../../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts)), including **Acme Order** and **`Objects Change`** **`add`** ([`applyObjectsChange`](../../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.ts)). Single coordinator; no Acme-only call-site fork. | Spawn coordinator | Decided |
| OE-2 | **Atomic bundling** --- when embed succeeds, third **`Put`** for embedding **in the same `transactWrite`** as pair + **`Meta::Object`** (3 items, within Dynamo transact limit). Bedrock embed runs **before** transact; not a post-spawn best-effort write. | Spawn coordinator ordering | Decided |
| OE-3 | **Embed failure policy** --- present embedding is **best-case**; **absence is valid**. If Bedrock embed fails, **still create** the object (pair + **`Meta::Object`** two-row transact). **`console.error`** with `objectId`, `shortName`, and error message; **must not** add to **`addFailures`** or block placement. Downstream readers tolerate missing embedding rows. | `spawnOneImprovisationObject` / batch | Decided |
| OE-4 | **`sourceTextHash`** --- hash the **normalized** embed input: [`normalizeExitName`](../../../../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) applied to trimmed **`shortName`**; set on **`SemanticEmbedding`** metadata for future invalidation. | Embed helper | Decided |
| OE-5 | **Model + invoke params** --- `amazon.titan-embed-text-v2:0`, `dimensions: 256`, `normalize: true` (matches [`SEMANTIC_EMBEDDING_V1_DIMENSIONS`](../../../../../../packages/mtw-lambda-patterns/ts/semanticEmbedding/index.ts)); request float vector from Bedrock, quantize via **`SemanticEmbedding.fromFloat32`**. | `invokeBedrockTitanEmbed` + IAM | Decided |
| OE-6 | **IAM** --- add `bedrock:InvokeModel` for `amazon.titan-embed-text-v2:0` on **`EphemeraFunction`** in [`template.yaml`](../../../../../../template.yaml) (today: Nova inference profiles only). | Deploy | Decided |
| OE-7 | **Update path** --- v1 **does not** re-embed when **`shortName`** changes via **`persistUpdateImprovisationObject`**; document as follow-up. | Scope | Decided |
| OE-8 | **Read path** --- v1 is write-only persistence; no **`internalCache`** handler or gateway read surface (consumer: future identity-stage embedding resolve). Gateway comes later. | Scope | Decided |

## Progress

| Area | State |
| --- | --- |
| Task plan scaffold | Done |
| Open decisions locked (OE-1 -- OE-8) | Done |
| `EphemeraObjectEmbedding` type + guard in `mtw-interfaces` | Done |
| `invokeBedrockTitanEmbed` (or equivalent) under `lambda/ephemera/llm/` | Done |
| `buildShortNameSemanticEmbedding` helper under `objects/embedding/` | |
| Persist: optional embedding `Put` + delete item | |
| Spawn coordinator wiring (embed before existence transact; best-effort) | |
| IAM (`template.yaml`) | |
| Unit / integration tests | |
| Durable docs (`objects/AGENT.md`, optional `objects/embedding/AGENT.md`) | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **0. Decision lock**
  - [X] Close OE-1 -- OE-8 in **Open decisions** (2026-07-06).

- [X] **1. Types and constants**
  - [X] Add `EMBEDDING_IMPROMPTU_DATA_CATEGORY = 'EMBEDDING#IMPROMPTU'` and `EphemeraObjectEmbedding` row type in [`packages/mtw-interfaces/ts/ephemeraEmbedding.ts`](../../../../../../packages/mtw-interfaces/ts/ephemeraEmbedding.ts) (sibling of [`ephemeraMeta.ts`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)): `EphemeraId`, `DataCategory`, `embedding: SemanticEmbeddingDynamoRecord` (import type from `@tonylb/mtw-lambda-patterns/ts/semanticEmbedding`).
  - [X] Add `isEphemeraObjectEmbedding` guard mirroring other ephemera meta guards.
  - [X] Export `objectEmbeddingPutItem` / row builder from [`objects/embedding/`](../../../../../../lambda/ephemera/dataSource/objects/embedding/) (new module; keep [`persistImprovisationObject.ts`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts) as coordinator).

- [X] **2. Bedrock embed transport**
  - [X] Add [`lambda/ephemera/llm/invokeBedrockTitanEmbed.ts`](../../../../../../lambda/ephemera/llm/invokeBedrockTitanEmbed.ts): `InvokeModelCommand` on `BedrockRuntimeClient`, typed success (`float[]` length 256) / failure, timeout, injectable client (mirror [`invokeBedrockConverseText.ts`](../../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts)).
  - [X] Unit tests with mocked `client.send` (no live Bedrock in CI).
  - [X] Document model id and request body in [`llm/AGENT.md`](../../../../../../lambda/ephemera/llm/AGENT.md) integration row (one line; no duplicate of implementation guide).

- [ ] **3. Embed helper (objects lane)**
  - [ ] Implement `buildShortNameSemanticEmbedding(shortName, deps?)` in [`objects/embedding/buildShortNameSemanticEmbedding.ts`](../../../../../../lambda/ephemera/dataSource/objects/embedding/buildShortNameSemanticEmbedding.ts): trim input, normalize via `normalizeExitName`, compute `sourceTextHash` from normalized text (OE-4), call embed transport, return `SemanticEmbedding` or typed failure.
  - [ ] Use `SemanticEmbedding.fromFloat32` with `modelId: 'amazon.titan-embed-text-v2:0'`; never persist raw floats.
  - [ ] Tests: mocked Bedrock returns known floats; assert `toDynamoRecord()` shape (dimensions, encoding, `Uint8Array` vector).

- [ ] **4. Persist layer**
  - [ ] Extend `SpawnImprovisationObjectArgs` with optional `embedding?: SemanticEmbedding` (or pre-serialized Dynamo record).
  - [ ] When present, append `objectEmbeddingPutItem({ objectId, embedding })` as third transact **`Put`** in [`persistSpawnImprovisationObject`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts).
  - [ ] Extend `deleteTransactItemsForObject` with **`Delete`** for `DataCategory: 'EMBEDDING#IMPROMPTU'` (all delete/clear/repair paths inherit via existing helpers).
  - [ ] Update [`persistImprovisationObject.test.ts`](../../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.test.ts): spawn with embedding (3 puts), delete (3 deletes). Keep existing two-row tests for spawns without embedding.

- [ ] **5. Spawn coordinator wiring**
  - [ ] In [`spawnOneImprovisationObject`](../../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts): call `buildShortNameSemanticEmbedding` **before** `persistSpawnImprovisationObject` for every spawn (OE-1). On success, pass embedding into persist for 3-item transact; on failure, `console.error` and call persist without embedding (2-item transact; OE-3).
  - [ ] No Acme-only fork --- [`handleAcmeOrderAddObjects`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) and [`applyObjectsChange`](../../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.ts) both use the same batch coordinator unchanged at the call site.
  - [ ] Batch parallelism: [`spawnImprovisationObjectsBatch`](../../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) already uses `Promise.all` per row --- embed + spawn per row stays isolated (**S3** partial success unchanged).
  - [ ] Update [`spawnImprovisationObjectsBatch.test.ts`](../../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.test.ts), [`applyObjectsChange.test.ts`](../../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.test.ts), and [`handleApiObjectsChange.test.ts`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.test.ts): mock embed helper; assert 3 puts when embed succeeds; assert 2 puts + `console.error` when embed fails but object still lands in `createdIds`.

- [ ] **6. Infrastructure**
  - [ ] Add Titan Embed v2 foundation model ARN to **`EphemeraFunction`** Bedrock policy in [`template.yaml`](../../../../../../template.yaml) (OE-6).

- [ ] **7. Durable documentation**
  - [ ] Update [`objects/AGENT.md`](../../../../../../lambda/ephemera/dataSource/objects/AGENT.md): four-way split table, spawn transact note (2 vs 3 items), delete invariant includes embedding row.
  - [ ] Optional slim [`objects/embedding/AGENT.md`](../../../../../../lambda/ephemera/dataSource/objects/embedding/AGENT.md) if row contract grows; otherwise keep contract in objects AGENT + interfaces only.
  - [ ] Remove resolved rows from **Open decisions**; do not copy implementation forks into package concepts docs.

- [ ] **8. Finish**
  - [ ] Run verification commands below.
  - [ ] Update **Progress** and **Recommended order** checkboxes in this document.

## Verification

From [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md):

```bash
cd packages/mtw-lambda-patterns && npm test -- semanticEmbedding
cd packages/mtw-utilities && npm test -- binaryRoundTrip
cd lambda/ephemera && npm run test -- --watchAll=false \
  llm/invokeBedrockTitanEmbed.test.ts \
  dataSource/objects/embedding/ \
  dataSource/objects/persistImprovisationObject.test.ts \
  dataSource/objects/spawnImprovisationObjectsBatch.test.ts \
  dataSource/objects/handleApiObjectsChange.test.ts
```

**Suggested grep spot-checks after implementation:**

```bash
# Embedding row constant used at persist + delete
rg -n "EMBEDDING#IMPROMPTU" lambda/ephemera/dataSource/objects/

# Spawn coordinator invokes embed before persist (not only in tests)
rg -n "buildShortNameSemanticEmbedding" \
  lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts

# Delete paths include embedding row (3 deletes per object)
rg -n "deleteTransactItemsForObject" lambda/ephemera/dataSource/objects/persistImprovisationObject.ts
```

**Manual / staging (optional):** after deploy with IAM, place one Acme order, then `getItem` on ephemeraDB with `getAllFields: true` for `(OBJECT#..., EMBEDDING#IMPROMPTU)` and confirm nested `embedding.vector` is binary (`B`) and round-trips through `SemanticEmbedding.fromDynamoRecord`.

## Follow-ups (link only)

| Follow-up | Trigger |
| --- | --- |
| Embedding read gateway + `internalCache` handler | Identity-stage embedding resolve ships |
| Re-embed on `shortName` update | Product needs stale-vector detection via `sourceTextHash` |
| `EMBEDDING#PERSPECTIVE#...` rows | Perspective-scoped similarity needed |
