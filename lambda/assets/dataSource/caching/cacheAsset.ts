import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../../internalCache";
import AssetWorkspace from "@tonylb/mtw-asset-workspace";
import { StandardRemove, StandardReplace } from "@tonylb/mtw-wml/ts/standardize/components/edits";
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import StandardCharacter from "@tonylb/mtw-wml/ts/standardize/components/character";
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists";
import { AssetKey } from "@tonylb/mtw-utilities/ts/types";
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema";
import { ComponentEventUpdate, ComponentRemovedEvent, ComponentUpdatedEvent } from "../serializers";

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
        update: ComponentEventUpdate;
        streamKey: string;
        detailType: string;
    }) => Promise<void>;
}): Promise<void> => {
    const assetUUID = AssetKey(assetId)

    const [dbAsset, fileAsset] = await Promise.all([
        internalCache.AssetData.get([assetUUID]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset key=(${assetId}) />`))),
        (async () => {
            const assetMeta = (await internalCache.Meta.get([assetUUID]))[0]
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

        // Prepare component-level events with StandardComponent objects
        const componentsRemoved = diff._components
            .filter((component): component is StandardRemove => (
                !!component.universalKey && component instanceof StandardRemove
            ))
            .map((component): ComponentRemovedEvent => ({ 
                type: 'Component Removed',
                assetId,
                componentId: component.universalKey as string
            }))
        const componentsUpdated = diff._components
            .filter((component) => (!!component.universalKey && !(component instanceof StandardRemove)))
            .map((component): ComponentUpdatedEvent => ({
                type: 'Component Updated',
                assetId,
                component: component // The actual StandardComponent object
            }))
        
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
        
        // Stream component events with StandardComponent objects; Character events will be handled by mtw.assets.characters data source
        await Promise.all([
            ...(componentsRemoved.map((componentRemovedEvent) => (
                streamEvent({
                    update: componentRemovedEvent,
                    streamKey: assetId,
                    detailType: 'Component Removed'
                })
            ))),
            ...(componentsUpdated.map((componentUpdatedEvent) => (
                streamEvent({
                    update: componentUpdatedEvent,
                    streamKey: assetId,
                    detailType: 'Component Updated'
                })
            )))
        ])
    }
}
