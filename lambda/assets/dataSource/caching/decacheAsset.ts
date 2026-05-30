import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { ComponentEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import internalCache from "../../internalCache"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import { isEphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { clearReferencedByForDecache } from './referencedByPersistence'
import { emitTopologyInvalidatedForRoomTargets } from '../../componentTopology'

/**
 * Remove asset content from DynamoDB storage
 * 
 * This function removes all component data associated with an asset from the database,
 * including updating component metadata to remove the asset from cached lists.
 * 
 * @param params - Parameters object
 * @param params.assetId - The asset ID to remove from cache
 * @param params.streamEvent - Function to stream events to EventBridge and messageBus subscribers
 * @returns Promise<void>
 */
export const decacheAsset = async ({ assetId, streamEvent }: {
    assetId: string;
    streamEvent: (params: {
        update: ComponentEventUpdate;
        streamKey: string;
        header: { type: string };
    }) => Promise<void>;
}): Promise<void> => {
    const assetUUID = AssetKey(assetId)
    // Load current cached asset form and synthesize an empty form to diff against
    const dbAsset = await internalCache.AssetData
        .get([assetUUID])
        .then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset uuid=(${assetId}) />`)))
    const emptyAsset = new StandardForm(`<Asset uuid=(${assetId}) />`)

    const diff = dbAsset.diff(emptyAsset)

    if (diff) {
        // For each removal in the diff, delete DB record, update metadata, and emit as both Component Updated and Component Removed
        await Promise.all(diff._components.map(async (component) => {
            if (!component.universalKey) {
                return
            }
            const universalKey = component.universalKey
            await Promise.all([
                assetDB.deleteItem({ AssetId: universalKey, DataCategory: assetUUID }),
                assetDB.optimisticUpdate({
                    Key: {
                        AssetId: universalKey,
                        DataCategory: `Meta::${universalKey[0]}${universalKey.slice(1).split('#')[0].toLocaleLowerCase()}`,
                    },
                    updateKeys: ['cached'],
                    updateReducer: (draft) => {
                        if (!('cached' in draft)) {
                            draft.cached = []
                        }
                        draft.cached = draft.cached.filter((id) => (id !== assetId))
                    },
                    deleteCondition: (draft) => (draft.cached.length === 0)
                })
            ])

            const componentUpdatedEvent: ComponentUpdatedEvent = { component }
            const componentRemovedEvent: ComponentRemovedEvent = { component }
            await Promise.all([
                streamEvent({
                    update: componentUpdatedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Updated' },
                }),
                streamEvent({
                    update: componentRemovedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Removed' },
                }),
            ])
        }))

        const { patchedTargetIds, roomIdsForTopology } = await clearReferencedByForDecache({
            assetUUID,
            assetId,
            dbAsset,
        })
        patchedTargetIds.forEach((universalKey) => {
            if (isEphemeraId(universalKey)) {
                internalCache.ComponentData.invalidate(universalKey, assetUUID)
            }
        })
        if (roomIdsForTopology.length > 0) {
            await emitTopologyInvalidatedForRoomTargets({
                roomIds: roomIdsForTopology,
                editAssetId: assetUUID,
            })
        }
    }

    await assetDB.deleteItem({
        AssetId: assetUUID,
        DataCategory: 'Meta::Asset'
    })
    internalCache.AssetMetaData.invalidate(assetUUID)
}
