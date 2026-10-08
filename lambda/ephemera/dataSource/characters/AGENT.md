# `mtw.ephemera.characters`

**Status:** Shipped --- bus-only **`EphemeraDataSource`** (**`replayable: false`**, subscribe-only). Registered from [`../../app.ts`](../../app.ts) via **`import './dataSource/characters'`**.

## Role

Owns **character play state** on the ephemeraDB **`Meta::Character`** row, the way [`mtw.ephemera.objects`](../objects/AGENT.md) owns object play state while placement stays with positions.

**Scope rule:** this lane owns **`RoomStack`** (the eviction ladder) only. Every other field has an owner, or is marked unclaimed, in the table below. A field moves here only when something needs it to.

| Concern | Storage | Owner |
| --- | --- | --- |
| **Eviction ladder** maintenance (navigate merge, trim persist) | `Meta::Character.RoomStack` | This lane ([`roomStack/`](roomStack/)) |
| **Legal placement** from the ladder (trim, top frame, move) | reads `RoomStack` | **`mtw.ephemera.positions`** ([`../positions/AGENT.contract.md`](../positions/AGENT.contract.md#eviction-ladder-roomstack-storage)) |
| **Membership** (which room holds the character) | **`ludicGraph`** + adjacency | **`mtw.ephemera.positions`** |
| **Body** (`Name`, `Color`, `Pronouns`, `assets`, ...) | `Meta::Character` | Unclaimed (see field table) |

[`internalCache.CharacterMeta`](../../internalCache/characterMeta.ts) stays in `internalCache/` (as `ObjectEphemeraMeta` does for objects). Every reader is in ephemera; the row gets a gateway when another lambda first needs character play state.

### Eviction ladder

When the world is built from **layered assets** (canon plus temporary or personal overlays), a character can occupy rooms that exist only while certain assets remain accessible. `Meta::Character.RoomStack` answers one question under that constraint:

**Where can this character legally be placed in play, given their current asset access?**

**Shape:** an ordered stack of frames `{ asset, room }` from root outward. The outermost frame aligns with **current** presence at the deepest active asset layer; inner frames are **fallback presences** still valid when outer layers are stripped away.

**Purpose:** not a travel diary. The stack is maintained in **trim-ready shape** so resolution is always: filter to accessible assets, read the top frame, move when the endpoint must change.

#### Three roles (one storage shape)

| Role | Question | Typical ingress |
| --- | --- | --- |
| **Resolve legal placement** | After trim, what room is legal? | Connect (place **from nowhere**); asset visibility loss (move **from a room they can no longer occupy**) |
| **Maintain stack on intentional moves** | While placing at the target room, keep frames aligned for future resolution | Navigate (extend / rewrite-tail / fork, in the same transaction as membership) |
| **Bookkeeping-only trim** | Did asset access change without changing the legal room? | Asset trim when the top frame still matches current membership (no `Character Moved`) |

**Resolution triggers** share the same mechanics (trim, top frame, move when the endpoint changes) and differ in **starting membership state**:

| Trigger | Starting state | Outcome when legal room differs |
| --- | --- | --- |
| **Connect** | Out of play --- purged from graph and adjacency; ladder **retained** on disconnect | Place at resolved room (`froms: []` -> `to`) |
| **Asset visibility** | In play at a room that may be invalid after asset loss | Relocate to resolved room (`froms: [illegal...]` -> `to`) |

**Disconnect asymmetry:** disconnect **purges** play membership (graph nodes, adjacency) but **preserves** `RoomStack`. That stack is the retained answer to "where can they legally go when they return?" --- connect resolves from it without reconstructing history.

**Navigate maintenance** (compare the destination's **asset chain** to the current ladder):

| Operation | When | Effect on ladder |
| --- | --- | --- |
| **Extend rung** | Destination chain **continues** the current chain (adds a further asset layer) | Push a new outer frame |
| **Rewrite tail rung** | Same chain prefix and same deepest asset; different room (lateral move within the layer) | Replace the outer frame's room only |
| **Fork** | Destination chain **diverges** from the current branch (sibling asset at some depth) | Truncate the abandoned branch; set the new tail frame |

Example (asset visibility): while a limited-time event overlay is active, middle rungs look like inert bookkeeping. When the event assets deactivate, trim removes the overlay rungs in one pass and lands the character on the last still-valid inner presence (suburbs in canon, not a vanished circus tent).

**Relationship to room membership:** membership is **where the character is now** (roster, `Character Moved`). The ladder is **how a legal endpoint is computed** when membership is missing (connect) or points at an inaccessible layer (asset loss). A trim that fixes only the ladder is not a membership change; a resolution that changes the endpoint is a real move.

## Ingress

Subscribes to **`mtw.ephemera.positions`** **`Character Moved`** ([`../positions/publishedEvents.ts`](../positions/publishedEvents.ts)). Positions is bus-only, so delivery happens in-process on the same invocation's message bus. It covers both membership apply and the kernel's `commitStepSequence`. Envelope guard: [`subscribedEvents.ts`](subscribedEvents.ts). Handler: [`handleCharacterMoved.ts`](handleCharacterMoved.ts).

## Ladder maintenance

- **On `Character Moved` with `to !== null`:** read character, room and canon assets from cache, then call [`persistRoomStackNavigate`](roomStack/persistRoomStackNavigate.ts) at the fact's **`beatAnchorTime`**. A timestamp merge means a late or duplicate delivery cannot regress newer frames.
- **`to: null`** (disconnect, ghost purge): no write. Disconnect keeps the ladder.
- **Navigate merge:** ladder persist **must** use per-frame `timeWritten` (epoch ms) stamped from **`beatAnchorTime`** at graph persist. A write at time `T` **must not** overwrite or truncate frames with `timeWritten > T`, and **must not** extend outer frames unless `T` exceeds all existing frame timestamps. Missing `timeWritten` **must** be treated as `0` (legacy rows). Merge logic: [`roomStack/mergeRoomStack.ts`](roomStack/mergeRoomStack.ts).
- **Trim persist:** asset/connect trim ([`trimPersistCharacterRoomStack`](roomStack/trimPersistCharacterRoomStack.ts)) **must** filter inaccessible frames and **preserve** survivor `timeWritten` values. **Must not** use navigate merge semantics on trim paths. Exported for positions' connect and asset-loss placement, which call it directly.
- **Failure tolerance:** ladder persist failure after retry exhaustion **must not** fail membership apply or navigate presentation orchestration; errors **must** be logged, never thrown. The move has already committed, and the ladder is only placement's fallback.
- **Guest seed:** [`confirmGuestCharacter`](../../guestCharacter/index.ts) writes `DEFAULT_ROOM_STACK` only when `RoomStack` is absent, so a guest's ladder survives reconnect.

## `Meta::Character` field ownership

This table covers the **ephemeraDB** row only. Two other tables use the same `DataCategory` for separate rows:

- **connectionDB** `Meta::Character.sessions`, owned by the connections lambda. Written by `connections/registerCharacter` and `connections/disconnect`. Read by the `characterSessions` caches in ephemera and subscriptions, and by `connections/dataSource/charactersDataSource.ts`.
- **assetDB** player-library character rows, owned by assets: `assets/player/heal.ts`, `assets/internalCache/playerLibrary.ts`, `diagnostics/playerMisalignmentSweep`. The dynamic `` `Meta::${tag}` `` writes in `assets/` (`cacheAsset`, `decacheAsset`) also target assetDB.

Most ephemera readers go through `internalCache.CharacterMeta`, which projects `Name`, `RoomStack`, `Color`, `fileURL`, `HomeId`, `assets`, `Pronouns` and `player`. The Readers column lists the consumers of each field, not the cache.

| Field | Writers | Readers | Owner | Notes |
| --- | --- | --- | --- | --- |
| `RoomStack` | `persistRoomStackNavigate` (on `Character Moved`), `trimPersistCharacterRoomStack`; `confirmGuestCharacter` (`DEFAULT_ROOM_STACK`, only when absent) | positions `resolveCharacterRoomId`, `resolveConnectTargetRoom`, `repairCharacterLegalPlacement`; `trimPersistCharacterRoomStack` | **characters** | |
| `ludicGraph` | positions `ludicGraph/index.ts` (via `hostDataCategory`); objects `persistClearStoredLudicGraphs` | positions (via `mtw-gateways` `getHostLudicGraphFromDynamo`); diagnostics `ludicGraphPortMismatchSweep`, `ludicGraphStaleStructureSweep`, `orphanedImprovisedObjectSweep` | **positions** | The only field typed in `mtw-interfaces` (`EphemeraMetaCharacter`) |
| `assets` | `confirmGuestCharacter` (`[]`); `updateEphemera` (player's asset list) | perspective resolution across render, perception, actions and affordance fan-out; positions ladder trim and repair | unclaimed | The two writers disagree for a guest (finding 2) |
| `Name` | `confirmGuestCharacter`; `updateEphemera` | `fetchEphemera`, `ephemeraUpdate`, `hydrateRoomRoster`, narration `handleCharacterSpoke`, perception `orchestrate` | unclaimed | Body field |
| `Color` | `confirmGuestCharacter`; `updateEphemera` | `fetchEphemera`, `ephemeraUpdate`, `hydrateRoomRoster`, `handleCharacterSpoke` | unclaimed | Body field |
| `Pronouns` | `confirmGuestCharacter` | none found beyond the cache projection | unclaimed | `updateEphemera` writes `pronouns` instead (finding 3) |
| `player` | `confirmGuestCharacter`; `updateEphemera` | none found beyond the cache projection | unclaimed | |
| `fileURL` | **none found** | `publishMessage`, `fetchEphemera`, `ephemeraUpdate`, `hydrateRoomRoster` | unclaimed | Finding 4 |
| `HomeId` | **none found** | actions `resolveHomeTargetForCharacter`; positions `orchestrateCharacterRoomMembership` (`CharacterInPlay` fallback when `to` is null) | unclaimed | Cache defaults it to `ROOM#VORTEX` (finding 4) |
| `Description` | `updateEphemera` (Coyote only) | none found | unclaimed | Finding 3 |

Legacy `RoomId` is retired. It is no longer written (`updateEphemera`), read (`chaos/addGhostSession`, `mtw-gateways`) or projected (`internalCache.CharacterMeta`). Stored rows may still carry it, and nothing reads it.

### Open findings

These belong to whoever claims the body fields:

2. **Guest `assets` clobber.** `confirmGuestCharacter` writes `assets: []` on every connect, and `updateEphemera` (Heal) writes the player's asset list. Whichever runs last wins.
3. **`pronouns` / `Description`.** `updateEphemera` writes `pronouns` (lowercase), which no reader projects, and `Description`, which nothing reads.
4. **Readers with no writer.** No writer exists for `fileURL` or `HomeId` on the ephemeraDB row, so readers always see `undefined` / `ROOM#VORTEX`. Before either field gets an owner, decide whether it comes from the asset-side character row or is retired.
6. **`updateEphemera` writes body fields from a separate lambda** (invoked by the Heal step function).

(Findings 1 and 5, the guest ladder reset and legacy `RoomId`, are fixed. The numbering is kept from the inventory.)
