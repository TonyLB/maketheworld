# `mtw.ephemera.actions`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/actions'`**.

**Ingress:** **`api.ephemera`** **`Parse Requested`** (player command routing). See [`../apiEphemera.ts`](../apiEphemera.ts).

**Outbound (room look):** In-room **`LookRoom`** results **`streamEvent`** a **`Look Command Requested`** payload (see [`publishedEvents.ts`](publishedEvents.ts)). **`mtw.ephemera.renderOrchestration`** subscribes as a sibling; [`handleLookCommandRequestedForRenderOrchestration`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) runs **`Perception Thread Registered`**, flushes the same run-scoped lane, then sends default-lane **`Render Requested`** (docs in [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md)).

## Role

Parses slash-free and natural-language commands (**Bedrock**: intent discrimination + Acme enrich when applicable). On each **`Parse Requested`**, **`index.ts`** **`PublishMessage`** **`CommandTranscriptMessage`** to the requesting character first (trimmed raw command text), then parse-side-effect messages. Publishes internal bus streams such as **`Acme Order`**, **`Character Navigate`**, **`Await RoadRunner`**, and harness-only outcomes --- see [`publishedEvents.ts`](publishedEvents.ts); for terminal parse lines that need no stream contract, **`index.ts`** may **`PublishMessage`** as **`WorldOOCMessage`** (including **`PromptInjectionAttempt`**, discriminate-intent meta-instruction / jailbreak-tone classification) or **`CoyoteGameHelpMessage`** for **`Help`** intent (requesting character only, no stream contract). When **`requestId`** is present on the parse payload, **`index.ts`** also emits **`ReturnValue`** **`Success`** with machine-oriented **`message: 'parse_request_handled'`** (human echo is only on the transcript row). **`mtw.ephemera.objects`** subscribes via [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) (**`Acme Order`** envelope guard).

Related index: [`../AGENT.md`](../AGENT.md) (**DataSource instances** table).

## Implementation guide

Implementation-heavy workflows are documented in [`AGENT.implementation.md`](./AGENT.implementation.md):

The discriminate-intent prompt, deterministic checks (including Coyote slash-command matchers), JSON interpreter, and intent-only types/guards live under [`discriminateIntent/`](./discriminateIntent/).
**Acme affinities test (`/test affinities`) operator usage:** `/test affinities` runs all affinities fixtures, while `/test affinities <n>` runs a single fixture by 1-based index (invalid tails return deterministic parse errors with usage text).
**Coyote engine test (`/test generation`):** Handled without Bedrock --- [`deterministicChecks.ts`](./discriminateIntent/deterministicChecks.ts) routes the prefix, [`parseCoyoteEngineTestSlashTail`](./discriminateIntent/parseCoyoteEngineTestSlash.ts) parses the tail, and [`coyoteEngineTestSlashCommand.ts`](./discriminateIntent/coyoteEngineTestSlashCommand.ts) defines the slash prefix. Canonical grammar, harness modes (**`runUntil`** vs programmatic **`runOnly`**), and fixtures: **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**Engine testing harness**).
Post-discrimination enrichment flows live under [`enrich/`](./enrich/), with Acme order as the first concrete implementation in [`enrich/acmeOrder/`](./enrich/acmeOrder/).

- Adding a new command affordance (actions-local and end-to-end checklist)
- Discriminate-intent / Acme order enrich alignment requirements and branching patterns
- Stream contract wiring and client-display protocol wiring
- Verification matrix and suggested test commands

## Movement bridge and deferred positions cutover

- Current movement behavior in actions is intentionally **event + imperative** for parity:
  - actions emits `Character Navigate` (`characterId`, `fromRoomId`, `toRoomId`) for downstream/event-first workflows.
  - actions also sends `MoveCharacter` imperatively so movement executes immediately in current runtime.
- This dual-path behavior is transitional and scoped to the movement-affordance task.
- Event-only movement execution ownership is deferred to **`mtw.ephemera.positions`**.

### Explicit non-goals (until positions lands)

- Do not treat `mtw.ephemera.actions` as long-term authority for room/position state ownership.
- Do not expand `Character Navigate` payload beyond `characterId`, `fromRoomId`, `toRoomId` without positions-scope requirements.
- Do not add object-position or relative-position semantics in actions; those belong to future positions design.

---

## Acme catalog lines and `stableKey` (normative contract)

Stable keys give **machine correlation** for Coyote staged objects (seams, clustering, tests, indexing) **besides** opaque **`OBJECT#`** **`uuid`** and mutable display **`shortName`**. Naming: **`stableKey`** (not `slug` alone and not **`referenceKey`**) signals **durable logical identity** alongside human-facing **`shortName`**.

### Scope and non-goals

- **Uniqueness:** **`stableKey`** must be unique across the **union** of **`Meta::Room.objects`** staged in **every Coyote demo game room** --- the same fixed roster used for hypothesis / plan snapshots ([**`defaultCoyoteGameData.gameRooms`**](../../internalCache/coyoteGame.ts)), not only the character's delivery room. Objects remain **stored per room**; collisions are forbidden **across** those rooms.
- **Outside scope:** No contract that **`stableKey`** stays unique outside that Coyote game-room set (other rooms or features). Persisted **[`EphemeraMetaRoomObject`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** rows require a non-empty **`stableKey`** after trim; environments with historical Dynamo rows that omit it need migration or loads may fail **`isEphemeraMetaRoomObject`** validation.

### Enforcement model

- **Acme order enrich may propose keys, but does not authoritatively guarantee uniqueness.**
- **Deterministic finalize is mandatory before publishing `Acme Order`** and is the contract boundary that guarantees usable `stableKey` values on bus payloads.
- Implementation details and call-order expectations are documented in [`AGENT.implementation.md`](./AGENT.implementation.md#acme-stablekey-implementation-notes).

### Acme order enrich: Coyote placement cap (pre-Bedrock)

Before **`invokeBedrockAcmeOrderEnrich`**, **[`enrich/acmeOrder/index.ts`](./enrich/acmeOrder/index.ts)** runs **[`countCoyotePlacedObjectsAcrossRooms`](./utilities/countCoyotePlacedObjectsAcrossRooms.ts)** over the same Coyote demo room roster as **`collectCoyoteOccupiedStableKeys`** (sum of **`meta.objects.length`** per room; placement rows, not **`stableKey`** deduplication). If the total is **greater than 20**, enrich returns **`ParseCommandErrorResult`** (`type: 'Error'` with a fixed **`errorMessage`**) and **does not** call Bedrock. **`parseCommand`** may therefore yield **`Error`** immediately after **`AcmeOrderIntent`** without catalog lines. **`ParseCommandDeps.countCoyotePlacedObjectsAcrossRoomsDeps`** supplies injectable **`getGameRooms`** / **`getRoomMeta`** for tests; the deps shape is **`CollectCoyoteOccupiedStableKeysDeps`** in **[`baseClasses.ts`](./baseClasses.ts)**.

### Types and payloads

- **[`AcmeOrderPublishedOrder`](publishedEvents.ts):** **`stableKey: string`** required on each bus order line after wiring.
- **`EphemeraMetaRoomObject`:** **`stableKey: string`** --- required on persisted rows (non-empty after trim); see **`isEphemeraMetaRoomObject`**.

### Coyote prompts vs stored fields

Hypothesis / plan prompts format staged objects from **`shortName`** plus trope fields (**`tropeAffinities`** / **`tropeAffinitiesFailed`**) via **[`formatCoyoteStagedObjectsByRoom`](../coyoteGame/utilities/coyoteRoomObjectSnapshot.ts)**. **`stableKey`** is echoed in the staged snapshot line (see **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)**).

### Downstream

Clustering / combine behavior is documented under **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**[Clustering and combine (design)](../coyoteGame/AGENT.md#clustering-and-combine-design)**).

---

## Thinking writes (Acme order enrich)

When **`Parse Requested`** runs Acme enrich, **`parseCommand`** passes **`messageBus`** into **`enrichAcmeOrder`**, which owns thinking bootstrap / emit / finalize for segment **`acmeOrderEnrich`** (publisher **`mtw.ephemera.actions`**). Persistence helpers: [`enrich/acmeOrder/acmeOrderThinkingPersistence.ts`](./enrich/acmeOrder/acmeOrderThinkingPersistence.ts). Steady-state thinking keys and rollup: [`../thinking/AGENT.md`](../thinking/AGENT.md). Integration tests for **`parseCommand` -> `enrichAcmeOrder`** thinking call order: [`parseCommand.test.ts`](./parseCommand.test.ts) (**`parseCommand Acme enrich thinking (messageBus)`**; pattern mirrors [`coyoteHypothesisPipeline.test.ts`](../coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts)).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Ephemera DataSource directory index (**`mtw.ephemera.actions`** row) |
| [`AGENT.implementation.md`](./AGENT.implementation.md) | Implementation playbook: affordance wiring, stream contracts, message protocols, test checklist |
| [`enrich/AGENT.md`](./enrich/AGENT.md) | Post-discrimination enrich namespace contract; current `acmeOrder` implementation boundary |
| [`../objects/AGENT.md`](../objects/AGENT.md) | **`Meta::Room.objects`** merge; Acme **`stableKey`** pass-through |
| [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) | Staged snapshot; **`stableKey`** on rows vs prompt text |
| **`/test generation`** harness parse | Same **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**Engine testing harness**). Actions entrypoints: [`parseCoyoteEngineTestSlash.ts`](./discriminateIntent/parseCoyoteEngineTestSlash.ts), [`coyoteEngineTestSlashCommand.ts`](./discriminateIntent/coyoteEngineTestSlashCommand.ts), [`deterministicChecks.ts`](./discriminateIntent/deterministicChecks.ts) |
| [`../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) | Durable trope and legacy-role helper contracts used by Coyote pipelines |
| [`../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) | **`EphemeraMetaRoomObject`** |
