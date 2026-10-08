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

## Ingress

Subscribes to **`mtw.ephemera.positions`** **`Character Moved`** ([`../positions/publishedEvents.ts`](../positions/publishedEvents.ts)). Positions is bus-only, so delivery happens in-process on the same invocation's message bus. It covers both membership apply and the kernel's `commitStepSequence`. Envelope guard: [`subscribedEvents.ts`](subscribedEvents.ts). Handler: [`handleCharacterMoved.ts`](handleCharacterMoved.ts).

## Ladder maintenance

- **On `Character Moved` with `to !== null`:** read character, room and canon assets from cache, then call [`persistRoomStackNavigate`](roomStack/persistRoomStackNavigate.ts) at the fact's **`beatAnchorTime`**. A timestamp merge means a late or duplicate delivery cannot regress newer frames.
- **`to: null`** (disconnect, ghost purge): no write. Disconnect keeps the ladder.
- **Failure tolerance:** log, never throw. The move has already committed, and the ladder is only placement's fallback.
- **Trim persist** ([`trimPersistCharacterRoomStack`](roomStack/trimPersistCharacterRoomStack.ts)) is exported for positions' connect and asset-loss placement, which call it directly.
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
