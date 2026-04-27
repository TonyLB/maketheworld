# `mtw.ephemera.actions`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/actions'`**.

**Ingress:** **`api.ephemera`** **`Parse Requested`** (player command routing). See [`../apiEphemera.ts`](../apiEphemera.ts).

**Outbound (room look):** In-room **`LookRoom`** results **`streamEvent`** a **`Look Command Requested`** payload (see [`publishedEvents.ts`](publishedEvents.ts)). **`mtw.ephemera.renderOrchestration`** subscribes as a sibling; [`handleLookCommandRequestedForRenderOrchestration`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) runs **`Perception Thread Registered`**, flushes the same run-scoped lane, then sends default-lane **`Render Requested`** (docs in [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md)).

## Role

Parses slash-free and natural-language commands (**Bedrock**: intent classification + Acme enrich when applicable). Publishes internal bus streams such as **`Acme Order`**, **`Character Navigate`**, **`Await RoadRunner`**, and harness-only outcomes --- see [`publishedEvents.ts`](publishedEvents.ts); for terminal parse lines that need no stream contract, **`index.ts`** may **`PublishMessage`** as **`WorldOOCMessage`** (including **`PromptInjectionAttempt`**, Step A meta-instruction / jailbreak-tone classification) or **`CoyoteGameHelpMessage`** for **`Help`** intent (requesting character only, no stream contract). **`mtw.ephemera.objects`** subscribes via [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) (**`Acme Order`** envelope guard).

Related index: [`../AGENT.md`](../AGENT.md) (**DataSource instances** table).

## Implementation guide

Implementation-heavy workflows are documented in [`AGENT.implementation.md`](./AGENT.implementation.md):

- Adding a new command affordance (actions-local and end-to-end checklist)
- Step A / Step B alignment requirements and branching patterns
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

- **Step B may propose keys, but does not authoritatively guarantee uniqueness.**
- **Deterministic finalize is mandatory before publishing `Acme Order`** and is the contract boundary that guarantees usable `stableKey` values on bus payloads.
- Implementation details and call-order expectations are documented in [`AGENT.implementation.md`](./AGENT.implementation.md#acme-stablekey-implementation-notes).

### Types and payloads

- **[`AcmeOrderPublishedOrder`](publishedEvents.ts):** **`stableKey: string`** required on each bus order line after wiring.
- **`EphemeraMetaRoomObject`:** **`stableKey: string`** --- required on persisted rows (non-empty after trim); see **`isEphemeraMetaRoomObject`**.

### Coyote prompts vs stored fields

Hypothesis / plan prompts format staged objects primarily from **`shortName`** + plan-role **`affinities`** (**[`formatCoyoteStagedObjectsByRoom`](../coyoteGame/utilities/coyoteRoomObjectSnapshot.ts)**). Current affinity vocabulary includes structural roles, enrich-side generative roles **`prep`** and **`creation`**, and flat modification tags (**`influence-road-runner`**, **`alter-road-runner`**, **`coyote-equipment`**, **`coyote-enhancement`**, **`setting-addition`**, **`connect-props`**, **`enhance-prop`**). **`stableKey`** is echoed in the staged snapshot line (see **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)**).

### Downstream

Clustering / combine behavior is documented under **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**[Clustering and combine (design)](../coyoteGame/AGENT.md#clustering-and-combine-design)**).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Ephemera DataSource directory index (**`mtw.ephemera.actions`** row) |
| [`AGENT.implementation.md`](./AGENT.implementation.md) | Implementation playbook: affordance wiring, stream contracts, message protocols, test checklist |
| [`../objects/AGENT.md`](../objects/AGENT.md) | **`Meta::Room.objects`** merge; Acme **`stableKey`** pass-through |
| [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) | Staged snapshot; **`stableKey`** on rows vs prompt text |
| [`../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) | Durable affinity contract: **`CoyoteAffinityPossibility`**, `prep` / `creation`, and flat modification tags |
| [`../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) | **`EphemeraMetaRoomObject`** |
