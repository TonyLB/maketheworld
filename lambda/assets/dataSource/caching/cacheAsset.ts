import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../../internalCache";
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly";
import { StandardRemove } from "@tonylb/mtw-wml/ts/standardize/components/edits";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import { AssetKey } from "@tonylb/mtw-utilities/ts/types";
import { AssetsEventUpdate, ComponentUpdatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets';
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses';

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
        const [metaResult] = await Promise.all([
            metaAssetWrite as Promise<{ zone?: string; player?: string }>,
            ...diff._components
            .map(async (component) => {
                if (!component.universalKey) {
                    return
                }
                if (component instanceof StandardRemove) {
                    await assetDB.deleteItem({
                        AssetId: component.universalKey,
                        DataCategory: assetUUID
                    })
                }
                else {
                    const fileComponent = fileAsset._lookup(component._key)
                    if (!fileComponent) {
                        console.warn(`Component ${component.universalKey} not found in file asset`)
                        return
                    }
                    await Promise.all([
                        assetDB.putItem({
                            ...(fileComponent.toJSON()),
                            AssetId: component.universalKey,
                            DataCategory: assetUUID,
                        }),
                        assetDB.optimisticUpdate({
                            Key: {
                                AssetId: component.universalKey,
                                DataCategory: `Meta::${component.tag}`,    
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
                    ])
                }
            })
        ])

        // Prepare component-level events with StandardComponent objects (same for removes and updates)
        const componentsUpdated = diff._components
            .filter((component) => (!!component.universalKey))
            .map((component): ComponentUpdatedEvent => ({
                type: 'Component Updated',
                component
            }))
        
        // Invalidate component cache for all updated components
        diff._components
            .filter((component) => (!!component.universalKey))
            .forEach(({ universalKey }) => {
                if (universalKey) {
                    internalCache.ComponentData.invalidate(universalKey)
                }
            })
        
        // Stream component events with StandardComponent objects; Character events will be handled by mtw.assets.characters data source
        await Promise.all(
            componentsUpdated.map((componentUpdatedEvent) => (
                streamEvent({
                    update: componentUpdatedEvent,
                    streamKey: assetId
                })
            ))
        )

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
                    type: 'Asset Updated', 
                    standardForm: metadataDiff,
                    ...(player ? { player } : {})
                },
                streamKey: assetId
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
