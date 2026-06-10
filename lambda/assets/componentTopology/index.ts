//
// Non-replayable DataSource for mtw.assets.componentTopology
//
// Subscribes to mtw.assets Component Updated / Component Removed and publishes
// TopologyInvalidated for Area/Room topology and cacheAsset referencedBy writes.
//
import { AssetsDataSource } from '../dataSource/abstract'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import { detectTopologyInvalidations } from './topologyDiff'
import {
    isComponentTopologySubscribedEnvelope,
    type ComponentTopologySubscribedContent,
} from './subscribedEvents'
import type { ComponentTopologyInvalidatedEvent } from './events'

export { detectTopologyInvalidations } from './topologyDiff'

export type ComponentTopologyEventUpdate = ComponentTopologyInvalidatedEvent

export const componentTopologyDataSource = new AssetsDataSource<
    never,
    ComponentTopologyEventUpdate,
    ComponentTopologySubscribedContent
>({
    dataSourceKey: 'mtw.assets.componentTopology',
    outboundBusDelivery: 'publish',
    replayable: false,
    subscribedEventTypeGuard: isComponentTopologySubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (event) => {
                if (!isComponentTopologySubscribedEnvelope(event)) {
                    return
                }
                const content = await event.getContent()
                const editAssetId = event.header.streamKey as AssetUUID
                const entityRemoved = event.header.type === 'Component Removed'
                const drafts = detectTopologyInvalidations({
                    component: content.component,
                    entityRemoved,
                })
                for (const draft of drafts) {
                    if (draft.scope === 'room') {
                        await streamEvent({
                            update: {
                                type: 'TopologyInvalidated',
                                roomIds: draft.roomIds,
                                editAssetId,
                                ...(draft.areaId ? { areaId: draft.areaId } : {}),
                            },
                            streamKey: editAssetId,
                            header: { type: 'TopologyInvalidated' },
                        })
                        continue
                    }
                    await streamEvent({
                        update: {
                            type: 'TopologyInvalidated',
                            areaId: draft.areaId,
                            editAssetId,
                        },
                        streamKey: editAssetId,
                        header: { type: 'TopologyInvalidated' },
                    })
                }
            })
        )
    },
})

componentTopologyDataSource.subscribe()

/** Called from cacheAsset / decacheAsset when room topology targets change via referencedBy or partition row deletion. */
export const emitTopologyInvalidatedForRoomTargets = async ({
    roomIds,
    editAssetId,
    areaId,
}: {
    roomIds: ComponentUUID[];
    editAssetId: AssetUUID;
    areaId?: ComponentUUID;
}): Promise<void> => {
    if (roomIds.length === 0) {
        return
    }
    const update: ComponentTopologyInvalidatedEvent = {
        type: 'TopologyInvalidated',
        roomIds,
        editAssetId,
        ...(areaId ? { areaId } : {}),
    }
    await componentTopologyDataSource.streamEvent({
        update,
        streamKey: editAssetId,
        header: { type: 'TopologyInvalidated' },
    })
}

export default componentTopologyDataSource
