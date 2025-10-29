import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../../internalCache";
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly";
import { StandardRemove } from "@tonylb/mtw-wml/ts/standardize/components/edits";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import { AssetKey } from "@tonylb/mtw-utilities/ts/types";
import { AssetsEventUpdate, ComponentUpdatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets';

/**
 * Cache asset content to DynamoDB storage
 * 
 * This function synchronizes asset content between S3 files and DynamoDB storage,
 * identifying and applying only changed components for efficient updates.
 * 
 * @param params - Parameters object
 * @param params.assetId - The asset ID to cache
 * @param params.streamEvent - Function to stream events to EventBridge and messageBus subscribers
 * @returns Promise<void>
 */
export const cacheAsset = async ({ assetId, streamEvent }: {
    assetId: string;
    streamEvent: (params: {
        update: AssetsEventUpdate;
        streamKey: string;
    }) => Promise<void>;
}): Promise<void> => {
    const assetUUID = AssetKey(assetId)

    const [dbAsset, fileAsset] = await Promise.all([
        internalCache.AssetData.get([assetUUID]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset uuid=(${assetId}) />`))),
        (async () => {
            const assetWorkspace = await ReadOnlyAssetWorkspace.fromUUID(assetUUID)
            if (!assetWorkspace) {
                return new StandardForm(assetUUID)
            }
            await assetWorkspace.loadJSON()
            return assetWorkspace.standard ?? new StandardForm(assetUUID)
        })()
    ])

    // Debug: Log incoming StandardForms' asset-level metadata prior to diff
    console.log('cacheAsset: dbAsset header', {
        shortName: dbAsset.shortName?.toJSON?.(),
        summary: dbAsset.summary?.toJSON?.()
    })
    console.log('cacheAsset: fileAsset header', {
        shortName: fileAsset.shortName?.toJSON?.(),
        summary: fileAsset.summary?.toJSON?.()
    })
    const diff = dbAsset.diff(fileAsset)
    
    // Phase 1B: Parallelize Meta::Asset write with component updates for efficiency
    // Replaces old dbRegister function with minimal, focused metadata write
    const metaAssetWrite = (async () => {
        const assetMeta = (await internalCache.AssetMetaData.get([assetUUID]))[0]
        const { zone, player } = assetMeta ?? {}
        
        if (zone) {
            await assetDB.putItem({
                AssetId: assetUUID,
                DataCategory: 'Meta::Asset',
                zone,
                ...(zone === 'Personal' && player ? { player } : {}),
                // Include Asset-level metadata (shortName and summary)
                ...(fileAsset.shortName ? { shortName: fileAsset.shortName.toJSON() } : {}),
                ...(fileAsset.summary ? { summary: fileAsset.summary.toJSON() } : {})
                // Note: Stores zone/player directly (no AssetWorkspaceAddress)
                // Note: No import graph maintenance (deferred to component-level redesign)
            })
        }
    })()
    
    if (diff) {
        await Promise.all([
            metaAssetWrite,
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
        // Debug: Log metadata diff shape for investigation
        console.log('cacheAsset: metadata diff', {
            hasShortName: Boolean(diffShortName),
            shortNameJSON: diffShortName?.toJSON?.(),
            hasSummary: Boolean(diffSummary),
            summaryJSON: diffSummary?.toJSON?.()
        })
        const hasDiffMetadata = Boolean(diffShortName || diffSummary)
        const hasAdditions = Boolean((!dbAsset.shortName && fileAsset.shortName) || (!dbAsset.summary && fileAsset.summary))
        const hasMetadataChanges = hasDiffMetadata || hasAdditions
        if (hasMetadataChanges) {
            const metadataDiffNDJSON = [
                {
                    tag: 'Asset' as const,
                    universalKey: assetUUID,
                    ...(((diff as any).shortName || (!dbAsset.shortName && fileAsset.shortName)) ? { shortName: (((diff as any).shortName) || fileAsset.shortName)!.toJSON() } : {}),
                    ...(((diff as any).summary || (!dbAsset.summary && fileAsset.summary)) ? { summary: (((diff as any).summary) || fileAsset.summary)!.toJSON() } : {})
                }
            ]
            const metadataDiff = new StandardForm(metadataDiffNDJSON)
            await streamEvent({
                update: { type: 'Asset Updated', standardForm: metadataDiff },
                streamKey: assetId
            })
        }
    } else {
        // Even with no diff, write Meta::Asset record
        await metaAssetWrite
    }
}
