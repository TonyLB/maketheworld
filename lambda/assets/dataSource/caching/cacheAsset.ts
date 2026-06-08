import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../../internalCache";
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache';
import { AssetKey } from "@tonylb/mtw-utilities/ts/types";
import { AssetsEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets';
import { Zone, isEphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema';
import {
    buildReferencedByPatchesForAsset,
    type PersistedReferencedByEntry,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData/referencedBy';
import { invalidateExhaustivePartitionCache } from '../components/verticals/exhaustivePartitionLoader';
import { emitTopologyInvalidatedForRoomTargets } from '../../componentTopology'

const isRoomId = (universalKey: ComponentUUID): boolean => universalKey.startsWith('ROOM#')

const hasEdgeRef = (entries: PersistedReferencedByEntry[]): boolean =>
    entries.some((entry) => entry.referenceType === 'Edge')

/**
 * Cache asset content to DynamoDB storage
 * 
 * This function synchronizes asset content between S3 files and DynamoDB storage,
 * identifying and applying only changed components for efficient updates.
 * 
 * Returns the zone/player used for streaming, and whether this is a new asset.
 */
export const cacheAsset = async ({ assetId, streamEvent }: {
    assetId: string;
    streamEvent: (params: {
        update: AssetsEventUpdate;
        streamKey: string;
        header: { type: string };
    }) => Promise<void>;
}): Promise<{ zone: Zone; player?: string; isNewAsset: boolean }> => {
    const assetUUID = AssetKey(assetId)

    const [dbAsset, { assetWorkspace, standardForm: fileAsset }, priorMeta] = await Promise.all([
        internalCache.AssetData.get([assetUUID]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset uuid=(${assetId}) />`))),
        (async () => {
            const assetWorkspace = await ReadOnlyAssetWorkspace.fromUUID(assetUUID, { allowS3Fallback: true })
            if (!assetWorkspace) {
                return { assetWorkspace: undefined, standardForm: new StandardForm(assetUUID) }
            }
            await assetWorkspace.loadJSON()
            return { assetWorkspace, standardForm: assetWorkspace.standard ?? new StandardForm(assetUUID) }
        })(),
        assetDB.getItem({
            Key: {
                AssetId: assetUUID,
                DataCategory: 'Meta::Asset'
            },
            ProjectionFields: ['AssetId']
        })
    ])

    const diff = dbAsset.diff(fileAsset)

    const isNewAsset = !(priorMeta && (priorMeta as any).AssetId)

    // Phase 1B: Parallelize Meta::Asset write with component updates for efficiency
    // Replaces old dbRegister function with minimal, focused metadata write
    const metaAssetWrite = (async () => {
        // Get zone/player from DynamoDB (if exists) or fall back to workspace (for new assets)
        const assetMeta = (await internalCache.AssetMetaData.get([assetUUID]))[0]
        const zone = assetMeta?.zone ?? assetWorkspace?.zone
        const player = assetMeta?.player ?? assetWorkspace?.player
        
        if (zone) {
            await assetDB.putItem({
                AssetId: assetUUID,
                DataCategory: 'Meta::Asset',
                zone,
                ...((zone === 'Personal' || zone === 'Draft') && player ? { player } : {}),
                // Include Asset-level metadata (shortName and summary)
                ...(fileAsset.shortName ? { shortName: fileAsset.shortName.toJSON() } : {}),
                ...(fileAsset.summary ? { summary: fileAsset.summary.toJSON() } : {})
                // Note: Stores zone/player directly (no AssetWorkspaceAddress)
                // Note: No import graph maintenance (deferred to component-level redesign)
            })
        }
        return { zone, player }
    })()
    
    if (diff) {
        const patches = buildReferencedByPatchesForAsset(fileAsset)
        const roomIdsForTopologyFirstPass: ComponentUUID[] = []

        const bumpMetaCached = (universalKey: ComponentUUID, tag: string) =>
            assetDB.optimisticUpdate({
                Key: {
                    AssetId: universalKey,
                    DataCategory: `Meta::${tag}`,
                },
                updateKeys: ['cached'],
                updateReducer: (draft) => {
                    if (!('cached' in draft)) {
                        draft.cached = []
                    }
                    if (!draft.cached.includes(assetId)) {
                        draft.cached = [...draft.cached, assetId]
                    }
                },
            })

        const [metaResult] = await Promise.all([
            metaAssetWrite as Promise<{ zone?: string; player?: string }>,
            ...diff._components
                .map(async (component) => {
                    const universalKey = component.universalKey
                    if (!universalKey) {
                        return
                    }
                    const referencedBy = patches.get(universalKey) ?? []
                    const fileComponent = fileAsset._lookup(universalKey)

                    if (fileComponent) {
                        await Promise.all([
                            assetDB.putItem({
                                ...(fileComponent.toJSON()),
                                referencedBy,
                                AssetId: universalKey,
                                DataCategory: assetUUID,
                            }),
                            bumpMetaCached(universalKey, component.tag),
                        ])
                    } else if (referencedBy.length > 0) {
                        const tag = component.tag ?? tagFromEphemeraId(universalKey)
                        await Promise.all([
                            assetDB.putItem({
                                tag,
                                universalKey,
                                referencedBy,
                                AssetId: universalKey,
                                DataCategory: assetUUID,
                            }),
                            bumpMetaCached(universalKey, tag),
                        ])
                    } else {
                        await assetDB.deleteItem({
                            AssetId: universalKey,
                            DataCategory: assetUUID
                        })
                    }

                    if (isRoomId(universalKey)) {
                        if (hasEdgeRef(referencedBy) || (!fileComponent && referencedBy.length === 0)) {
                            roomIdsForTopologyFirstPass.push(universalKey)
                        }
                    }
                })
        ])

        // Prepare component-level events with StandardComponent objects (same for removes and updates)
        const { componentsUpdated, componentsRemoved } = diff._components
            .filter((component) => (!!component.universalKey))
            .reduce<{ componentsUpdated: ComponentUpdatedEvent[]; componentsRemoved: ComponentRemovedEvent[] }>((acc, component) => {
                const universalKey = component.universalKey
                if (!universalKey) {
                    return acc
                }
                const referencedBy = patches.get(universalKey) ?? []
                const fileComponent = fileAsset._lookup(universalKey)
                //
                // If the component still exists in the incoming asset, treat as a content update.
                // If it no longer exists in the file and has no forward references, emit Component Removed.
                // Edge-only stubs (branch B) still exist in the partition and must not emit Component Removed.
                //
                acc.componentsUpdated.push({ component })
                if (!fileComponent && referencedBy.length === 0) {
                    acc.componentsRemoved.push({ component })
                }
                return acc
            }, { componentsUpdated: [], componentsRemoved: [] })

        const uniqueRoomIdsForTopologyFirstPass = [...new Set(roomIdsForTopologyFirstPass)]
        if (uniqueRoomIdsForTopologyFirstPass.length > 0) {
            await emitTopologyInvalidatedForRoomTargets({
                roomIds: uniqueRoomIdsForTopologyFirstPass,
                editAssetId: assetUUID,
            })
        }

        const invalidateTargets = new Set<ComponentUUID>(
            diff._components.map((c) => c.universalKey).filter((id): id is ComponentUUID => Boolean(id))
        )
        invalidateTargets.forEach((universalKey) => {
            if (isEphemeraId(universalKey)) {
                internalCache.ComponentData.invalidate(universalKey, assetUUID)
                invalidateExhaustivePartitionCache(universalKey)
            }
        })

        // Stream component events with StandardComponent objects; Character events will be handled by mtw.assets.characters data source
        await Promise.all([
            ...componentsUpdated.map((componentUpdatedEvent) => (
                streamEvent({
                    update: componentUpdatedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Updated' }
                })
            )),
            ...componentsRemoved.map((componentRemovedEvent) => (
                streamEvent({
                    update: componentRemovedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Removed' }
                })
            ))
        ])

        // Emit Asset Updated event for Asset-level metadata changes (ShortName/Summary)
        const diffShortName = (diff as any).shortName
        const diffSummary = (diff as any).summary
        const hasMetadataChanges = Boolean(diffShortName || diffSummary)
        if (hasMetadataChanges) {
            // Get player from metadata (already fetched earlier in metaAssetWrite)
            const assetMeta = (await internalCache.AssetMetaData.get([assetUUID]))[0]
            const player = assetMeta?.player
            const metadataDiffNDJSON = [
                {
                    tag: 'Asset' as const,
                    universalKey: assetUUID,
                    ...(diffShortName ? { shortName: diffShortName.toJSON() } : {}),
                    ...(diffSummary ? { summary: diffSummary.toJSON() } : {})
                }
            ]
            const metadataDiff = new StandardForm(metadataDiffNDJSON)
            await streamEvent({
                update: {
                    standardForm: metadataDiff,
                    ...(player ? { player } : {})
                },
                streamKey: assetId,
                header: { type: 'Asset Updated' }
            })
        }

        if (!metaResult.zone) {
            throw new Error(`cacheAsset: Missing zone for asset ${assetId}`)
        }
        return { zone: metaResult.zone as Zone, player: metaResult.player, isNewAsset }
    } else {
        // Even with no diff, write Meta::Asset record
        const metaResult = await metaAssetWrite
        if (!metaResult.zone) {
            throw new Error(`cacheAsset: Missing zone for asset ${assetId}`)
        }
        return { zone: metaResult.zone as Zone, player: metaResult.player, isNewAsset }
    }
}
