import EphemeraDataSource from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import { 
    AssetsEventExternal,
    isAssetsComponentUpdatedEvent,
    isCanonUpdatedEvent,
    isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'

// For first iteration, no UpdatePayload or SnapshotPayload usage
type EphemeraSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'mtw.assets'
    event: AssetsEventExternal
}

export const ephemeraDataSource = new EphemeraDataSource<never, never, EphemeraSubscribedEvent>({
    dataSourceKey: 'mtw.ephemera',
    replayable: false,
    eventSerializer: new EphemeraEventSerializer(),
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is EphemeraSubscribedEvent => {
        return Boolean(
            event &&
            event.dataSourceKey === 'mtw.assets' &&
            event.event && typeof event.event === 'object' &&
            (isAssetsComponentUpdatedEvent(event.event) || isCanonUpdatedEvent(event.event) || isZoneUpdatedEvent(event.event))
        )
    },
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (evt) => {
            const { event, streamKey } = evt
            if (isAssetsComponentUpdatedEvent(event)) {
                const { component } = event
                const componentId = component.universalKey || ''
                if (isEphemeraRoomId(componentId)) {
                    messageBus.send({
                        type: 'Perception',
                        ephemeraId: componentId,
                        header: true
                    })
                }
                // Passive observation is limited to rooms; other components are only observed actively
                return
            }
            if (isCanonUpdatedEvent(event)) {
                const { assetIds } = event
                messageBus.send({
                    type: 'CanonSet',
                    assetIds: assetIds.filter(isEphemeraAssetId)
                })
                return
            }
            if (isZoneUpdatedEvent(event)) {
                const { fromZone, toZone } = event
                const assetId = streamKey as string
                if (isEphemeraAssetId(assetId)) {
                    if (toZone === 'Canon' && fromZone !== 'Canon') {
                        messageBus.send({ type: 'CanonAdd', assetId })
                    }
                    else if (fromZone === 'Canon' && toZone !== 'Canon') {
                        messageBus.send({ type: 'CanonRemove', assetId })
                    }
                }
                return
            }
        }))
    }
})

// Subscribe to the internal messageBus to receive events routed from EventBridge
ephemeraDataSource.subscribe()

export default ephemeraDataSource


