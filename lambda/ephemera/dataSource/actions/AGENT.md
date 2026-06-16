# `mtw.ephemera.actions`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**, **`outboundBusDelivery: 'publish'`**). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/actions'`**.

**Ingress:** **`api.ephemera`** **`Parse Requested`** (player command routing) and **`Action Assessed`** (server-trusted pre-assessed outcomes: **`Navigation`**, **`Home`**, **`LookComponent`** with `source: uiExit` | `uiHome` | `uiLook` | `link`). See [`../apiEphemera.ts`](../apiEphemera.ts).

**Outbound (look):** **`LookRoom`** (parsed bare `look` / `l`, current room) and **`LookComponent`** (trusted UI/link with explicit `componentId`) both **`streamEvent`** **`Look Command Requested`** (see [`publishedEvents.ts`](publishedEvents.ts)). **`mtw.ephemera.renderOrchestration`** subscribes and orchestrates room + Feature/Knowledge looks via [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) (docs in [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md)).

### Look ingress

| Outcome | Ingress | `componentId` | Notes |
| --- | --- | --- | --- |
| **`LookRoom`** | **`Parse Requested`** (bare `look` / `l`, Bedrock paraphrase) | Character's **current room** (`fromRoomId`) | No trusted **`EphemeraId`** from client |
| **`LookComponent`** | **`Action Assessed`** (`source: uiLook` \| `link`) from [`routeTrustedUiAction`](../routeTrustedUiAction.ts) or [`app.ts`](../../app.ts) (link) | Trusted **`ROOM#` / `FEATURE#` / `KNOWLEDGE#`** | Optional **`directResponse`** for Knowledge |

Both converge on **`Look Command Requested`**; renderOrchestration branches room vs Feature/Knowledge in [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts).

**Bus delivery:** Imperative **`PublishMessage`** and correlated **`ReturnValue`** use **`messageBus.publish`**; quiescence at lambda boundary only (no producer-side drain). Legacy [`executeAction`](../../parse/executeAction.ts) (speech only) uses the same **`publish`** path.

## Role

Parses slash-free and natural-language commands (**Bedrock**: intent discrimination + Acme enrich when applicable). On each **`Parse Requested`**, **`index.ts`** **`PublishMessage`** **`CommandTranscriptMessage`** to the requesting character first (trimmed raw command text), then parse-side-effect messages. On **`Action Assessed`**, **`index.ts`** skips transcript and Bedrock --- it validates the pre-assessed outcome and runs the same post-parse tail as typed commands. Publishes internal bus streams such as **`Acme Order`**, **`Character Navigate`**, **`Character Home`**, **`Await RoadRunner`**, and harness-only outcomes --- see [`publishedEvents.ts`](publishedEvents.ts); for terminal parse lines that need no stream contract, **`index.ts`** may **`PublishMessage`** as **`WorldOOCMessage`** (including **`PromptInjectionAttempt`**, discriminate-intent meta-instruction / jailbreak-tone classification) or **`CoyoteGameHelpMessage`** for **`Help`** intent (requesting character only, no stream contract). When **`requestId`** is present on the parse or assessed payload, **`index.ts`** also emits **`ReturnValue`** **`Success`** with machine-oriented **`message: 'parse_request_handled'`** or **`'action_assessed_handled'`** respectively (human echo is only on the transcript row for parse). **`mtw.ephemera.objects`** subscribes via [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) (**`Acme Order`** envelope guard). **`mtw.ephemera.perception`** subscribes to **`Character Navigate`** and **`Character Home`** for membership fan-in intent legs.

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

## Movement (actions stream vs positions execution)

- Parse-based navigation (**`Parse Requested`** -> **`Character Navigate`**) and UI exit clicks (**`Action Assessed`** **`Navigation`** from [`routeTrustedUiAction`](../routeTrustedUiAction.ts)) are **stream-only** from actions; execution is owned by **`mtw.ephemera.positions`** ([`index.ts`](../positions/index.ts) -> [`navigate/executeCharacterNavigate`](../positions/navigate/executeCharacterNavigate.ts)).
- Parse-based home (**bare `home`**, **`HomeIntent`**, **`Parse Requested`**) and trusted home (**`Action Assessed`** **`Home`** from [`routeTrustedUiAction`](../routeTrustedUiAction.ts), `source: 'uiHome'`) **`streamEvent`** **`Character Home`**; positions executes via the same **`executeCharacterNavigate`** path as navigate.
- actions emits `Character Navigate` (`characterId`, `fromRoomId`, `toRoomId`, optional `exitName` when parse matched a named exit) and `Character Home` (`characterId`, `fromRoomId`, `toRoomId` from `CharacterMeta.HomeId`) for fan-in intent legs and positions execution.
- **Disconnect** and **connect** intent legs come from **`mtw.connections.characters`**; positions owns membership apply. Leave/arrive world copy is owned by **membership fan-in** on **`mtw.ephemera.perception`** ([`../perception/AGENT.md`](../perception/AGENT.md)).
- Asset visibility repair (**`repairCharacterLegalPlacement`**) is available under [`positions/membership/`](../positions/membership/repairCharacterLegalPlacement.ts) for future canon/zone ingress; **`CheckLocation` bus adapter retired** at Close **S2-6-DR**.

### Explicit non-goals

- Do not treat `mtw.ephemera.actions` as long-term authority for room/position state ownership.
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

- **[`AcmeOrderPublishedOrder`](publishedEvents.ts):** **`stableKey: string`** required on each bus order line after wiring; optional **`tropeAffinities`** / **`tropeAffinitiesFailed`** validated by **`areCoyoteObjectTropeFieldsValid`** ([`coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)) --- same rules as persisted **`EphemeraMetaRoomObject`** rows.
- **`EphemeraMetaRoomObject`:** **`stableKey: string`** --- required on persisted rows (non-empty after trim); see **`isEphemeraMetaRoomObject`**.

### Coyote prompts vs stored fields

Hypothesis / plan prompts format staged objects from **`shortName`** plus trope fields (**`tropeAffinities`** / **`tropeAffinitiesFailed`**) via **[`formatCoyoteStagedObjectsByRoom`](../coyoteGame/utilities/coyoteRoomObjectSnapshot.ts)**. **`stableKey`** is echoed in the staged snapshot line (see **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)**).

### Downstream

Clustering / combine behavior is documented under **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**[Clustering and combine (design)](../coyoteGame/AGENT.md#clustering-and-combine-design)**).

---

## Thinking writes (Acme order enrich)

When **`Parse Requested`** runs Acme enrich, **`parseCommand`** passes **`messageBus`** into **`enrichAcmeOrder`**, which owns thinking bootstrap / emit / finalize for segment **`acmeOrderEnrich`** (publisher **`mtw.ephemera.actions`**). Persistence helpers: [`enrich/acmeOrder/acmeOrderThinkingPersistence.ts`](./enrich/acmeOrder/acmeOrderThinkingPersistence.ts). Full bootstrap / emit / finalize / failure semantics: **Acme order enrich thinking** in [`../thinking/AGENT.md`](../thinking/AGENT.md). Integration tests for **`parseCommand` -> `enrichAcmeOrder`** thinking call order: [`parseCommand.test.ts`](./parseCommand.test.ts) (**`parseCommand Acme enrich thinking (messageBus)`**; pattern mirrors [`coyoteHypothesisPipeline.test.ts`](../coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts)).

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
