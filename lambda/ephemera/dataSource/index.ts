import EphemeraDataSource from './abstract'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import { AssetsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    EphemeraIncomingEvent,
    isEphemeraSubscribedEnvelope,
    isEphemeraComponentEnvelope,
    isEphemeraCanonUpdatedEnvelope,
    isEphemeraZoneUpdatedEnvelope,
} from './subscribedEvents'
import { kickRoomHeaderBroadcastForRoom } from './perception/kickRoomHeaderBroadcast'

const processComponentUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    const componentId = content.component.universalKey || ''
    if (isEphemeraRoomId(componentId)) {
        await kickRoomHeaderBroadcastForRoom({ roomId: componentId, messageBus })
    }
}

const processCanonUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Canon Updated' } }>): Promise<void> => {
    const content = await evt.getContent()
    if (!content) return
    messageBus.send({
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
            messageBus.send({ type: 'CanonAdd', assetId })
        } else if (fromZone === 'Canon' && toZone !== 'Canon') {
            messageBus.send({ type: 'CanonRemove', assetId })
        }
    }
}

// SubscribedContent = AssetsEventUpdate (we subscribe to mtw.assets). UpdatePayload = what we publish (same for Ephemera).
export const ephemeraDataSource = new EphemeraDataSource<never, AssetsEventUpdate, AssetsEventUpdate>({
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
            }
        }))
    }
})

// Subscribe to the internal messageBus to receive events routed from EventBridge
ephemeraDataSource.subscribe()

export default ephemeraDataSource
