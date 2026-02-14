import EphemeraDataSource from './abstract'
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import {
    AssetsEventUpdate,
    ComponentUpdatedEvent,
    CanonUpdatedEventUpdate,
    ZoneUpdatedEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const EPHEMERA_ASSET_EVENT_TYPES = new Set(['Component Updated', 'Canon Updated', 'Zone Updated'])

type EphemeraIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }; getContentInternal: () => Promise<ComponentUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }; getContentInternal: () => Promise<CanonUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContentInternal: () => Promise<ZoneUpdatedEventUpdate> }

const isEphemeraComponentEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Component Updated'
const isEphemeraCanonUpdatedEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Canon Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Canon Updated'
const isEphemeraZoneUpdatedEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Zone Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Zone Updated'

const processComponentUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }>): Promise<void> => {
    const content = await evt.getContentInternal()
    const componentId = content.component.universalKey || ''
    if (isEphemeraRoomId(componentId)) {
        messageBus.send({ type: 'Perception', ephemeraId: componentId, header: true })
    }
}

const processCanonUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Canon Updated' } }>): Promise<void> => {
    const content = await evt.getContentInternal()
    messageBus.send({
        type: 'CanonSet',
        assetIds: content.assetIds.filter(isEphemeraAssetId)
    })
}

const processZoneUpdated = async (evt: Extract<EphemeraIncomingEvent, { header: { type: 'Zone Updated' } }>): Promise<void> => {
    const content = await evt.getContentInternal()
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
    subscribedEventTypeGuard: (header: StreamingEventHeader): boolean => {
        return header.dataSourceKey === 'mtw.assets' && EPHEMERA_ASSET_EVENT_TYPES.has(header.type)
    },
    receiveEvents: async ({ events }) => {
        const typedEvents = events as EphemeraIncomingEvent[]
        await Promise.all(typedEvents.map(async (evt) => {
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


