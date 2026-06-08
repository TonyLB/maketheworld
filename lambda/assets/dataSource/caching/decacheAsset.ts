import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { ComponentEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import internalCache from "../../internalCache"
import { AssetKey } from "@tonylb/mtw-utilities/ts/types"
import { isEphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { tagFromEphemeraId } from '@tonylb/mtw-utilities/ts/graphStorage/cache'
import { buildReferencedByPatchesForAsset } from '@tonylb/mtw-gateways/ts/assets/components/componentData/referencedBy'
import { invalidateExhaustivePartitionCache } from '../components/verticals/exhaustivePartitionLoader'
import { emitTopologyInvalidatedForRoomTargets } from '../../componentTopology'

const isRoomId = (universalKey: ComponentUUID): boolean => universalKey.startsWith('ROOM#')

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
        // decache: empty forward graph -> patches are all []; always branch C (deleteItem)
        const patches = buildReferencedByPatchesForAsset(emptyAsset)
        const roomIdsForTopologyFirstPass: ComponentUUID[] = []

        const uncacheMeta = (universalKey: ComponentUUID, tag: string) =>
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
                    draft.cached = draft.cached.filter((id) => (id !== assetId))
                },
                deleteCondition: (draft) => (draft.cached.length === 0)
            })

        await Promise.all(
            diff._components.map(async (component) => {
                const universalKey = component.universalKey
                if (!universalKey) {
                    return
                }
                const referencedBy = patches.get(universalKey) ?? []
                const fileComponent = emptyAsset._lookup(universalKey)

                if (fileComponent) {
                    // branch A - unreachable on decache (empty forward graph)
                } else if (referencedBy.length > 0) {
                    // branch B - unreachable on decache; no stub recreation
                } else {
                    const tag = component.tag ?? tagFromEphemeraId(universalKey)
                    await Promise.all([
                        assetDB.deleteItem({ AssetId: universalKey, DataCategory: assetUUID }),
                        uncacheMeta(universalKey, tag),
                    ])
                }

                if (isRoomId(universalKey)) {
                    if (!fileComponent && referencedBy.length === 0) {
                        roomIdsForTopologyFirstPass.push(universalKey)
                    }
                }
            })
        )

        const { componentsUpdated, componentsRemoved } = diff._components
            .filter((component) => (!!component.universalKey))
            .reduce<{ componentsUpdated: ComponentUpdatedEvent[]; componentsRemoved: ComponentRemovedEvent[] }>((acc, component) => {
                const universalKey = component.universalKey
                if (!universalKey) {
                    return acc
                }
                const referencedBy = patches.get(universalKey) ?? []
                const fileComponent = emptyAsset._lookup(universalKey)
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

        await Promise.all([
            ...componentsUpdated.map((componentUpdatedEvent) => (
                streamEvent({
                    update: componentUpdatedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Updated' },
                })
            )),
            ...componentsRemoved.map((componentRemovedEvent) => (
                streamEvent({
                    update: componentRemovedEvent,
                    streamKey: assetId,
                    header: { type: 'Component Removed' },
                })
            )),
        ])
    }

    await assetDB.deleteItem({
        AssetId: assetUUID,
        DataCategory: 'Meta::Asset'
    })
    internalCache.AssetMetaData.invalidate(assetUUID)
}
