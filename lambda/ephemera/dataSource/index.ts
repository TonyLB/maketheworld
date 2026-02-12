import EphemeraDataSource from './abstract'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import {
    AssetsEventUpdate,
    isAssetsComponentUpdatedEvent,
    isCanonUpdatedEvent,
    isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const EPHEMERA_ASSET_EVENT_TYPES = new Set(['Component Updated', 'Canon Updated', 'Zone Updated'])

// SubscribedContent = AssetsEventUpdate (we subscribe to mtw.assets). UpdatePayload = what we publish (same for Ephemera).
export const ephemeraDataSource = new EphemeraDataSource<never, AssetsEventUpdate, AssetsEventUpdate>({
    dataSourceKey: 'mtw.ephemera',
    replayable: false,
    eventSerializer: new EphemeraEventSerializer(),
    subscribedEventTypeGuard: (header: StreamingEventHeader): boolean => {
        return header.dataSourceKey === 'mtw.assets' && EPHEMERA_ASSET_EVENT_TYPES.has(header.type)
    },
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (evt) => {
            const content = evt.content as AssetsEventUpdate
            const streamKey = evt.header.streamKey
            if (isAssetsComponentUpdatedEvent(content)) {
                const { component } = content
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
            if (isCanonUpdatedEvent(content)) {
                const { assetIds } = content
                messageBus.send({
                    type: 'CanonSet',
                    assetIds: assetIds.filter(isEphemeraAssetId)
                })
                return
            }
            if (isZoneUpdatedEvent(content)) {
                const { fromZone, toZone } = content
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


