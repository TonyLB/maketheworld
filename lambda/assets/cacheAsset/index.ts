import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";
import { MessageBus } from "../messageBus/baseClasses";
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly";

type CacheAssetMessage = {
    assetId: string;  // Plain asset ID without 'ASSET#' prefix
}
import { StandardRemove, StandardReplace } from "@tonylb/mtw-wml/ts/standardize/components/edits";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import StandardCharacter from "@tonylb/mtw-wml/ts/standardize/components/character";
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import eventBridgeClient from "@tonylb/mtw-utilities/ts/eventBridge";
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists";
import { AssetKey } from "@tonylb/mtw-utilities/ts/types";

export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async (payload) => {
            const { assetId } = payload

            const assetUUID = AssetKey(assetId)
            const [dbAsset, fileAsset] = await Promise.all([
                internalCache.AssetData.get([assetUUID]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset uuid=(${assetId}) />`))),
                (async () => {
                    const assetWorkspace = await ReadOnlyAssetWorkspace.fromUUID(assetId)
                    if (!assetWorkspace) {
                        return new StandardForm(`<Asset uuid=(${assetId}) />`)
                    }
                    await assetWorkspace.loadJSON()
                    return assetWorkspace.standard ?? new StandardForm(`<Asset uuid=(${assetId}) />`)
                })()
            ])

            const diff = dbAsset.diff(fileAsset)
            
            // Parallelize Meta::Asset write with component updates for efficiency
            const metaAssetWrite = (async () => {
                // Register Meta::Asset record (simplified metadata)
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
                const characterChanges = diff._components
                    .filter((component): component is StandardRemove | StandardReplace | StandardCharacter => {
                        if (component instanceof StandardRemove) {
                            return component._match instanceof StandardCharacter
                        }
                        if (component instanceof StandardReplace) {
                            return component._match instanceof StandardCharacter
                        }
                        return component instanceof StandardCharacter
                    })
                characterChanges.forEach((component) => {
                    const { universalKey } = component
                    if (universalKey && isEphemeraCharacterId(universalKey)) {
                        internalCache.ComponentData.invalidate(universalKey)
                    }
                })
                // Character events are now handled by mtw.assets.characters data source
            } else {
                // Even with no diff, write Meta::Asset record
                await metaAssetWrite
            }
        })
    )
}

export default cacheAssetMessage