# Guest character confirm/repair

**Status:** Shipped 2026-08-04. `confirmGuestCharacter` is the single seam for both making and repairing a guest character; guest *id/name* allocation happens separately in [`lambda/assets/player/heal.ts`](../../assets/player/heal.ts)'s `healPlayer`, which does not touch ephemera.

## What it does

[`index.ts`](index.ts)'s `confirmGuestCharacter(userName, messageBus)` runs on every `Player Connected` (via [`dataSource/players/`](../dataSource/players/AGENT.md)) and does two things, idempotently:

1. **`pushCharacterEphemera`** --- upserts `Meta::Character` (`Name`, `Pronouns`, `Color`, `assets`, `RoomStack`, `player`). No `Description` field: that was a dead write, predating the render path, that nothing ever read.
2. **`writeGuestSituationFacet`** (only when `coyoteGameEnabled`) --- writes a `(CHARACTER#<guestId>, ASSET#IMPROVISATION)` pair row carrying a `SITUATION#DEFAULT` prose facet, exactly the "runtime-generated content" merge layer Object uses for its own spawn-time facet (see [`../dataSource/objects/AGENT.md`](../dataSource/objects/AGENT.md)). This is what gives a guest character something to render at all --- see [`../dataSource/renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md) **Improvisation merge participation** for the `CHARACTER#` side of that mechanism.

## Check-before-write

`writeGuestSituationFacet` reads the existing pair row first (`internalCache.ImprovisationComponentData.get`, the same read-through cache `persistImprovisationObject.ts` uses) and compares it against the desired `StandardCharacter` via `StandardComponent.equals()` (base-class `deepEqual` on `toJSON()`). It skips the `putItem` / memo-patch / render-cache-invalidation entirely when they already match. Every `Player Connected` is a reconnect as much as a first connect, so without this check every reconnect would perform an unconditional write plus a cache-invalidation query for a guest already up to date.

**Rewrite semantics on mismatch are unconditional**, though --- there is nothing per-guest worth preserving on the row while prose is a single shared static slice, so a prose edit still reaches every existing guest on their next confirm. This would need revisiting (cf. `persistUpdateImprovisationObject`'s preserve-prior-`situations` fix) if per-guest generated prose ever lands.

On mismatch: `ephemeraDB.putItem`, `internalCache.ImprovisationComponentData.set` (memo-patch), then `queryAllRenderCacheDataCategoriesForComponent` + `sendDeleteCacheRecords` to clear stale `CACHE#`/`Cache::` rows so a repaired guest doesn't keep serving pre-repair render output.

## The prose facet: [`guestSituations.ts`](guestSituations.ts)

`guestCoyoteSituations(guestName)` builds the facet as a function, not a constant, because it must supply **all three** of `displayName` / `summary` / `description`:

- `<Render>`'s content model requires the full triplet with a non-empty `DisplayName` (`schema/converters/components.ts`'s `finalize`, and again in Character's and Room's standardize consumers). `toProseTripletChildren` emits only the fields present on the payload, so a description-only facet round-trips into a one-child `<Render>` the client cannot reparse --- this shipped as a production show-stopper once character looks first reached the render path (`Render tag must contain exactly three children`). See [`taskPlanning/packages/mtw-wml/AGENT.renderTagArity.planning.md`](../../../taskPlanning/packages/mtw-wml/AGENT.renderTagArity.planning.md) for the (separate, still-open) work to relax that arity requirement itself.
- `displayName` is also the **only** source of the character's name on the render channel: `characterRenderWmlFromCacheRecord` puts no `displayName` on the Character row itself. Without it the client falls back to the literal string `Unknown`. See [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) **Correlated Character description (policy)** for the authored-character version of this same gap.

## Related

- [`../dataSource/players/AGENT.md`](../dataSource/players/AGENT.md) --- what actually triggers `confirmGuestCharacter`.
- [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) **Correlated Character description (policy)** --- how the facet reaches a player as rendered prose.
- [`../dataSource/renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md) **Improvisation merge participation** --- why the pair row is visible to the merge at all.
