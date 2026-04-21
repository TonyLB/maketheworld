# `mtw.ephemera.actions`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/actions'`**.

**Ingress:** **`api.ephemera`** **`Parse Requested`** (player command routing). See [`../apiEphemera.ts`](../apiEphemera.ts).

## Role

Parses slash-free and natural-language commands (**Bedrock**: intent classification + Acme enrich when applicable). Publishes internal bus streams such as **`Acme Order`**, **`Character Navigate`**, **`Await RoadRunner`**, and harness-only outcomes --- see [`publishedEvents.ts`](publishedEvents.ts); **`mtw.ephemera.objects`** subscribes via [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) (**`Acme Order`** envelope guard).

Related index: [`../AGENT.md`](../AGENT.md) (**DataSource instances** table).

---

## Acme catalog lines and `stableKey` (normative contract)

Stable keys give **machine correlation** for Coyote staged objects (seams, clustering, tests, indexing) **besides** opaque **`OBJECT#`** **`uuid`** and mutable display **`shortName`**. Naming: **`stableKey`** (not `slug` alone and not **`referenceKey`**) signals **durable logical identity** alongside human-facing **`shortName`**.

### Scope and non-goals

- **Uniqueness:** **`stableKey`** must be unique across the **union** of **`Meta::Room.objects`** staged in **every Coyote demo game room** --- the same fixed roster used for hypothesis / plan snapshots ([**`defaultCoyoteGameData.gameRooms`**](../../internalCache/coyoteGame.ts)), not only the character's delivery room. Objects remain **stored per room**; collisions are forbidden **across** those rooms.
- **Outside scope:** No contract that **`stableKey`** stays unique outside that Coyote game-room set (other rooms or features). Persisted **[`EphemeraMetaRoomObject`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** rows require a non-empty **`stableKey`** after trim; environments with historical Dynamo rows that omit it need migration or loads may fail **`isEphemeraMetaRoomObject`** validation.

### Two phases

1. **LLM-first (Step B enrich):** For Acme intent, **`buildParseAcmeOrderEnrichPrompt`** embeds the **Coyote-wide occupied-key list** (union of existing **`stableKey`** values from **`Meta::Room.objects`** across all Coyote game rooms). The model proposes one **`stableKey`** string per catalog line when possible (semantic hyphenated labels preferred). Output is structured JSON (**`mergeAcmeOrderEnrich`** / **`finalizeAcmeOrderFromStepB`**). Proposals may still collide internally or violate charset rules; Bedrock output is **not** authoritative alone.

2. **Deterministic fallback (contractual guarantee):** After enrich, **[`finalizeStableKeysDeterministic`](finalizeStableKeysDeterministic.ts)** (with **[`normalizeStableKeyCharset`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** / **`defaultStableKeyProposal`**) validates and **repairs** collisions using a **pure** allocator: charset rules, **`constructed-`** reservation (Acme allocator remaps reserved prefix), reservation of the normalized key **`setting`** for Coyote phase-plan virtual grounding (**[`COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** --- Acme emits **`acme-setting`** or suffixed variants instead), **numeric suffix repair** when needed, using the **occupied set** plus keys finalized earlier in the **same batch**. Exact repair steps are implemented and unit-tested in **`finalizeStableKeysDeterministic.test.ts`**; callers must supply **valid lines in batch order**.

### Where enforcement runs

[**`index.ts`**](index.ts) (**Acme Order** path):

1. **[`collectCoyoteOccupiedStableKeys`](collectCoyoteOccupiedStableKeys.ts)** builds the occupancy snapshot from **`CoyoteGame.gameRooms`** + **`Meta::Room.objects`** (same roster as Coyote snapshots). Only non-empty trimmed **`stableKey`** strings contribute; malformed or legacy-shaped rows without a valid key contribute nothing.
2. **`parseCommand({ command, occupiedStableKeys })`** passes that snapshot into Step B enrich (**same snapshot** used for **`finalizeStableKeysDeterministic`** after parse returns **`AcmeOrder`**).
3. **`finalizeStableKeysDeterministic`** attaches **final** **`stableKey: string`** per valid line before **`streamEvent`** **`Acme Order`**.
4. **`mtw.ephemera.objects`** **[`handleAcmeOrderAddObjects`](../objects/handleApiObjectsChange.ts)** persists into the character's **current** room only (pass-through **`stableKey`**).

### Types and payloads

- **[`AcmeOrderPublishedOrder`](publishedEvents.ts):** **`stableKey: string`** required on each bus order line after wiring.
- **`EphemeraMetaRoomObject`:** **`stableKey: string`** --- required on persisted rows (non-empty after trim); see **`isEphemeraMetaRoomObject`**.

### Coyote prompts vs stored fields

Hypothesis / plan prompts format staged objects primarily from **`shortName`** + plan-role **`affinities`** (**[`formatCoyoteStagedObjectsByRoom`](../coyoteGame/coyoteRoomObjectSnapshot.ts)**). Current affinity vocabulary includes structural roles, enrich-side generative roles **`prep`** and **`creation`**, and flat modification tags (**`influence-road-runner`**, **`alter-road-runner`**, **`coyote-equipment`**, **`coyote-enhancement`**, **`setting-addition`**, **`connect-props`**, **`enhance-prop`**). **`stableKey`** is echoed in the staged snapshot line (see **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)**).

### Downstream

Clustering / combine behavior is documented under **[`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md)** (**[Clustering and combine (design)](../coyoteGame/AGENT.md#clustering-and-combine-design)**).

---

## Verification

From [`lambda/ephemera/`](../../):

```bash
cd lambda/ephemera && npx jest dataSource/actions/ dataSource/objects/
```

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Ephemera DataSource directory index (**`mtw.ephemera.actions`** row) |
| [`../objects/AGENT.md`](../objects/AGENT.md) | **`Meta::Room.objects`** merge; Acme **`stableKey`** pass-through |
| [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) | Staged snapshot; **`stableKey`** on rows vs prompt text |
| [`../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) | Durable affinity contract: **`CoyoteAffinityPossibility`**, `prep` / `creation`, and flat modification tags |
| [`../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) | **`EphemeraMetaRoomObject`** |
