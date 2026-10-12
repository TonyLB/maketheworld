import EphemeraDataSource from './abstract'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraAreaId, isEphemeraRoomId, isEphemeraAssetId, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    EphemeraIncomingEvent,
    EphemeraSubscribedContent,
    isEphemeraSubscribedEnvelope,
    isEphemeraComponentEnvelope,
    isEphemeraComponentRemovedEnvelope,
    isEphemeraCanonUpdatedEnvelope,
    isEphemeraZoneUpdatedEnvelope,
} from './subscribedEvents'
import { kickRoomHeaderBroadcastForRoom } from './perception/kickRoomHeaderBroadcast'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { populateContainmentAtCache } from './positions/manipulation/containment/populateContainmentAtCache'
import { removeAuthoredObject } from './positions/manipulation/containment/removeAuthoredObject'

const processComponentUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    const componentId = content.component.universalKey || ''
    if (isEphemeraRoomId(componentId)) {
        await kickRoomHeaderBroadcastForRoom({ roomId: componentId, messageBus })
    }
    // Cache-time containment population, additive-only --- e.g. Room-in-Area, Feature-in-Room.
    // Duck-typed on `ludicGraph` rather than switched on `component.tag`, so any host kind whose
    // component authors nested nodes participates with no change here. That scale-invariance is deliberate, and is contracted in
    // `positions/AGENT.contract.md`'s `Component Updated` ingress section.
    // A Room or Area is populated even with no nested nodes: its hostless remainder is the root of
    // its presence tree, which every Room and Area keeps (`rootStep`).
    const { component } = content
    if (isEphemeraMembershipHostId(componentId) && 'ludicGraph' in component) {
        const nodes = (component as { ludicGraph: { nodes: { payload: readonly { universalKey?: string }[] } } }).ludicGraph.nodes.payload
        if (nodes.length > 0 || isEphemeraRoomId(componentId) || isEphemeraAreaId(componentId)) {
            await populateContainmentAtCache(componentId, nodes, { messageBus })
        }
    }
}

// Cache-time removal is for Objects only: Rooms and Features never move, so the contract's removal
// deferral still holds for them. See `positions/AGENT.contract.md`'s `Component Updated` section.
const processComponentRemoved = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Component Removed' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    const componentId = content.component.universalKey || ''
    if (isEphemeraObjectId(componentId)) {
        await removeAuthoredObject(componentId, { messageBus })
    }
}

const processCanonUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Canon Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    messageBus.publish({
        type: 'CanonSet',
        assetIds: content.assetIds.filter(isEphemeraAssetId)
    })
}

const processZoneUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Zone Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    const { fromZone, toZone } = content
    const assetId = evt.header.streamKey as string
    if (isEphemeraAssetId(assetId)) {
        if (toZone === 'Canon' && fromZone !== 'Canon') {
            messageBus.publish({ type: 'CanonAdd', assetId })
        } else if (fromZone === 'Canon' && toZone !== 'Canon') {
            messageBus.publish({ type: 'CanonRemove', assetId })
        }
    }
}

export const ephemeraDataSource = new EphemeraDataSource<never, AssetsEventUpdate, EphemeraSubscribedContent>({
    dataSourceKey: 'mtw.ephemera',
    replayable: false,
    eventSerializer: new EphemeraEventSerializer(),
    subscribedEventTypeGuard: isEphemeraSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent, streamEnvelope }) => {
        await Promise.all(events.map(async (evt) => {
            if (isEphemeraComponentEnvelope(evt)) {
                await processComponentUpdated(evt)
                return
            }
            if (isEphemeraComponentRemovedEnvelope(evt)) {
                await processComponentRemoved(evt)
                return
            }
            if (isEphemeraCanonUpdatedEnvelope(evt)) {
                await processCanonUpdated(evt)
                return
            }
            if (isEphemeraZoneUpdatedEnvelope(evt)) {
                await processZoneUpdated(evt)
                return
            }
        }))
    }
})

// Subscribe to the internal messageBus to receive events routed from EventBridge
ephemeraDataSource.subscribe()

export default ephemeraDataSource
