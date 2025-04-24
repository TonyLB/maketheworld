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

export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async (payload) => {
            const { assetId } = payload

            const [dbAsset, fileAsset] = await Promise.all([
                internalCache.AssetData.get([`ASSET#${assetId}`]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset key=(${assetId}) />`))),
                (async () => {
                    const assetMeta = (await internalCache.Meta.get([`ASSET#${assetId}`]))[0]
                    const { address } = assetMeta ?? {}
                    if (!address) {
                        return new StandardForm(`<Asset key=(${assetId}) />`)
                    }
                    const assetWorkspace = new AssetWorkspace(address)
                    await assetWorkspace.loadJSON()
                    return assetWorkspace.standard ?? new StandardForm(`<Asset key=(${assetId}) />`)
                })()
            ])

            const diff = dbAsset.diff(fileAsset)
            if (diff) {
                await Promise.all(Object.values(diff.byId)
                    .map(async (component) => {
                        if (!component.universalKey) {
                            return
                        }
                        if (component instanceof StandardRemove) {
                            await assetDB.deleteItem({
                                AssetId: component.universalKey,
                                DataCategory: `ASSET#${assetId}`
                            })
                        }
                        else {
                            const fileComponent = fileAsset.byId[component.key]
                            if (!fileComponent) {
                                console.warn(`Component ${component.key} not found in file asset`)
                                return
                            }
                            await Promise.all([
                                assetDB.putItem({
                                    ...(fileComponent.toJSON()),
                                    AssetId: component.universalKey,
                                    DataCategory: `ASSET#${assetId}`,
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
                const characterChanges = Object.values(diff.byId)
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
                const characterNotifications = Object.assign(
                    {},
                    ...(await Promise.all(
                        characterChanges.map(async ({ universalKey }) => {
                            if (!(universalKey && isEphemeraCharacterId(universalKey))) {
                                return undefined
                            }
                            const [character] = await internalCache.ComponentData.get([universalKey])
                            if (!character) {
                                return { [universalKey]: [] }
                            }
                            return { [character.ComponentId]: character.byAssets }
                        })
                    )).filter(excludeUndefined)
                )
                const charactersRemoved = Object.keys(characterNotifications).filter((key) => {
                    const character = characterNotifications[key]
                    return character.length === 0
                })
                await Promise.all([
                    ...(charactersRemoved.length
                        ? [
                            eventBridgeClient.send(
                                charactersRemoved.map((characterId) => ({
                                    Source: 'mtw.assets',
                                    DetailType: 'Character Removed',
                                    Detail: { characterId }
                                }))
                            )
                        ]
                        : []
                    )
                ])
            }
        })
    )
}

export default cacheAssetMessage