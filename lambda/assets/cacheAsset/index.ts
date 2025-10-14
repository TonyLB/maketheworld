import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";
import { CacheAssetMessage, MessageBus } from "../messageBus/baseClasses";
import AssetWorkspace from "@tonylb/mtw-asset-workspace";
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
                    const assetMeta = (await internalCache.AssetMetaData.get([assetUUID]))[0]
                    const { address } = assetMeta ?? {}
                    if (!address) {
                        return new StandardForm(`<Asset uuid=(${assetId}) />`)
                    }
                    const assetWorkspace = new AssetWorkspace(address)
                    await assetWorkspace.loadJSON()
                    return assetWorkspace.standard ?? new StandardForm(`<Asset uuid=(${assetId}) />`)
                })()
            ])

            const diff = dbAsset.diff(fileAsset)
            if (diff) {
                await Promise.all(diff._components
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
                )
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
            }
        })
    )
}

export default cacheAssetMessage