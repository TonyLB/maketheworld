# Publishing from Draft - Architecture Plan

**Date**: October 14, 2025  
**Status**: PLANNING

---

## Context

With Phase 1 flat UUID-based storage and zone tagging in place, the "Publish from Draft" workflow can be dramatically simplified compared to the pre-existing `copyWML` + `resetWML` pattern.

---

## Deprecated Pattern (Pre-Phase 1)

### Old `publishWML.asl.yaml` Step Function

**Workflow**:
```
1. copyWML: Copy Draft files to target zone subdirectory
2. resetWML: Clear Draft files
```

**Problems**:
- Requires S3 CopyObject + DeleteObject operations
- Changes file paths (zone subdirectories)
- Complex error handling if copy succeeds but reset fails
- Not implemented in client UI (infrastructure exists but unused)

### Recommendation: **DEPRECATE**

Since this workflow:
- ❌ Is not used in production (no client UI)
- ❌ Predates Phase 1 UUID architecture
- ❌ Uses inefficient copy+delete pattern
- ✅ Can be replaced with simpler zone tag approach

**Action**: Remove `copyWML`, `resetWML`, and `publishWML.asl.yaml` rather than migrate them.

---

## New Pattern (Phase 1)

### Draft UUID Strategy: **Rotating v4 UUIDs**

**Core Principle**: Each player's draft is a real asset with a standard v4 UUID, tracked in DynamoDB.

### Draft Asset Structure

**S3 Objects**:
```
{uuid}.wml              # Where uuid = v4() UUID
{uuid}.ndjson
{uuid}.auth.wml
{uuid}.auth.ndjson

S3 Tags: { Zone: 'Draft' }
S3 Metadata: { player: 'alice' }
```

**Example**:
```
550e8400-e29b-41d4-a716-446655440000.wml
Tags: { Zone: 'Draft' }
Metadata: { player: 'alice' }
```

**DynamoDB Tracking**:
```typescript
// Player metadata record
{
  PlayerId: 'PLAYER#alice',
  DataCategory: 'Meta::Player',
  currentDraftAssetId: 'ASSET#550e8400-e29b-41d4-a716-446655440000'
}
```

### Publishing Workflow

**User Action**: "Publish to Personal Zone"

**Backend Steps**:
```typescript
1. Get player's current draft UUID from DynamoDB
   → draftUUID = 'ASSET#550e8400-e29b-41d4-a716-446655440000'

2. moveAsset(draftUUID, { fromZone: 'Draft', toZone: 'Personal' })
   → Just updates S3 tag: Zone='Personal'
   → Asset stays at same path: {uuid}.wml
   → Atomic, instant, no file copying

3. Generate new draft UUID for player
   → newDraftUUID = `ASSET#${uuidv4()}`
   → e.g., 'ASSET#7c9e6679-7425-40de-944b-e07fc1f90ae7'

4. Create empty new draft asset
   → Write {newUUID}.wml with <Asset uuid=({newUUID}) />
   → Set S3 tags: { Zone: 'Draft' }
   → Set S3 metadata: { player: 'alice' }

5. Update player's current draft pointer in DynamoDB
   → currentDraftAssetId = newDraftUUID

6. Emit events for cache invalidation/updates
```

### Benefits

✅ **No Special UUID Format**: Use standard `v4()` UUIDs everywhere  
✅ **No Collision Risk**: UUID package guarantees uniqueness  
✅ **No Special Parsing**: All UUIDs have same format  
✅ **Atomic Zone Changes**: `moveAsset` just updates S3 tag  
✅ **Clean Architecture**: Drafts are just regular assets with Zone=Draft  
✅ **Simple Rollback**: Published asset can be moved back to Draft if needed  

### Draft Discovery

**Question**: How does client find player's current draft?

**Answer**: Query DynamoDB
```typescript
// Option 1: Player metadata lookup
const { currentDraftAssetId } = await getPlayerMetadata(playerId)

// Option 2: Index query (if needed)
const draftAssets = await queryAssets({
  IndexName: 'PlayerDraftIndex',
  player: playerId,
  zone: 'Draft'
})
```

---

## Alternative Considered: Fixed Draft UUID Pattern

### `ASSET#draft[{player}]` Pattern

**Rejected because**:
- ❌ Requires special UUID format parsing
- ❌ Not a standard UUID (breaks expectations)
- ❌ Publishing still requires creating a new UUID and copying content
- ❌ Can't use simple `moveAsset` (would leave player without a draft)

**If we used this pattern, workflow would be**:
```
1. Read content from ASSET#draft[alice]
2. Generate new UUID for published asset
3. Create new asset at new UUID with draft content (essentially copyWML)
4. Clear ASSET#draft[alice] (essentially resetWML)
```
This is just the old pattern with extra steps. **Not recommended.**

---

## Implementation Requirements

### New Functions Needed

**1. Draft Management**:
```typescript
// lambda/wml/draft/getDraftUUID.ts
export async function getPlayerDraftUUID(player: string): Promise<AssetUUID>

// lambda/wml/draft/createNewDraft.ts  
export async function createNewDraftForPlayer(player: string): Promise<AssetUUID>
```

**2. Modified Functions**:
- ✅ `moveAsset` - Already being refactored for tag-based zone changes
- ✅ `applyEdit` - Already works, just needs draft UUID discovery

### DynamoDB Schema Changes

**Player Metadata Record**:
```typescript
{
  PlayerId: 'PLAYER#{player}',
  DataCategory: 'Meta::Player',
  currentDraftAssetId: AssetUUID,  // NEW FIELD
  // ... existing player metadata fields
}
```

### Asset Metadata Records (No Change)

Draft assets already tracked like any other asset:
```typescript
{
  AssetId: 'ASSET#7c9e6679-...',
  DataCategory: 'Meta::Asset',
  zone: 'Draft',
  player: 'alice',
  // ... other metadata
}
```

---

## Migration Path

### Phase 1A (Immediate)

1. **Deprecate Unused Infrastructure**:
   - Remove `lambda/wml/copyWML/` directory and tests
   - Remove `lambda/wml/resetWML/` directory and tests
   - Remove `stepFunctions/publishWML.asl.yaml`
   - Remove handlers from `lambda/wml/app.ts`
   - Update CloudFormation template (template.yaml)

2. **Update Documentation**:
   - Mark as deprecated in `AGENT.s3Storage.md`
   - Document new pattern in `AGENT.publishing.planning.md`
   - Update migration catalog

### Phase 1B (With Storage Refactor)

1. **Implement Draft Management**:
   - Add `currentDraftAssetId` to Player metadata schema
   - Create `getDraftUUID` helper
   - Create `createNewDraft` helper
   - Modify client draft initialization

2. **Update Publishing When Ready**:
   - Build new step function using `moveAsset` + `createNewDraft`
   - Or use direct lambda calls (simpler than step function)
   - Implement client UI with zone selector

---

## Benefits of This Approach

### Technical
- **Simpler Code**: Fewer special cases, standard UUIDs everywhere
- **Better Performance**: Zone changes are tag updates, not file copies
- **Atomic Operations**: Tag updates are atomic, copy+delete is not
- **Consistent Architecture**: All assets follow same pattern

### Operational
- **No Migration Needed**: Unused code simply removed
- **Clean Slate**: Rebuild publishing with Phase 1 architecture in mind
- **Future-Proof**: Scales to collaborative workflows naturally

---

## Open Questions

### 1. Draft Lifecycle
**Q**: What happens to old published drafts?  
**A**: They remain as normal assets in their published zone. No special handling needed.

### 2. Draft Naming
**Q**: How do we display draft assets to users?  
**A**: Use player-friendly display name from Player metadata, not the UUID. UUID is internal identifier only.

### 3. Multiple Drafts
**Q**: Could a player have multiple drafts eventually?  
**A**: Yes! Just track multiple draft UUIDs. For MVP, track one `currentDraftAssetId`.

### 4. Draft Asset Discovery
**Q**: How to find all draft assets for a player?  
**A**: Query DynamoDB by player + zone:
```typescript
assetDB.query({
  IndexName: 'PlayerZoneIndex',
  player: 'alice',
  zone: 'Draft'
})
```

---

## Recommendation Summary

✅ **Deprecate immediately**: `copyWML`, `resetWML`, `publishWML` step function  
✅ **Use rotating v4 UUIDs** for draft assets  
✅ **Track in Player metadata**: `currentDraftAssetId` field  
✅ **Publishing = moveAsset + createNewDraft**: Simple, atomic, efficient  
✅ **Rebuild publishing UI** when ready, using Phase 1 architecture  

This approach aligns perfectly with the flat UUID + zone tag architecture and eliminates unnecessary complexity.

