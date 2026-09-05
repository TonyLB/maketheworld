import EphemeraDataSource from './abstract'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    EphemeraIncomingEvent,
    EphemeraSubscribedContent,
    isEphemeraSubscribedEnvelope,
    isEphemeraComponentEnvelope,
    isEphemeraCanonUpdatedEnvelope,
    isEphemeraZoneUpdatedEnvelope,
} from './subscribedEvents'
import { kickRoomHeaderBroadcastForRoom } from './perception/kickRoomHeaderBroadcast'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { populateContainmentAtCache } from './positions/manipulation/containment/populateContainmentAtCache'

const processComponentUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    const componentId = content.component.universalKey || ''
    if (isEphemeraRoomId(componentId)) {
        await kickRoomHeaderBroadcastForRoom({ roomId: componentId, messageBus })
    }
    // RD-4 (`AGENT.presenceRefactor.planning.md` step 3): cache-time containment population,
    // additive-only --- Room-in-Area and Feature-in-Room today. Duck-typed on `ludicGraph` rather
    // than switched on `component.tag`, so a future host kind (e.g. Feature, once it gains its own
    // `_ludicGraph`) starts participating with no change here (RA-3's scale-invariant framing).
    const { component } = content
    if (isEphemeraMembershipHostId(componentId) && 'ludicGraph' in component) {
        const nodes = (component as { ludicGraph: { nodes: { payload: readonly { universalKey?: string }[] } } }).ludicGraph.nodes.payload
        if (nodes.length > 0) {
            await populateContainmentAtCache(componentId, nodes, { messageBus })
        }
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
