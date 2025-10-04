import EphemeraDataSource from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EphemeraEventSerializer } from './serializers'
import messageBus from '../messageBus'
import { isEphemeraRoomId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'

// TODO: Move these shared external event types and guards to @tonylb/mtw-interfaces/ts/dataSources/assets.ts
// These represent the external (EventBridge) payload shapes for mtw.assets DataSource events
export type AssetsComponentUpdatedExternal = {
    type: 'Component Updated'
    assetId: string
    componentId: string
    wml: string
}

export type AssetsCanonUpdatedExternal = {
    type: 'Canon Updated'
    assetIds: string[]
}

export type AssetsZoneChangedExternal = {
    type: 'Zone Changed'
    fromZone: string
    toZone: string
    player?: string
    subFolder?: string
}

export type AssetsEventExternal = AssetsComponentUpdatedExternal | AssetsCanonUpdatedExternal | AssetsZoneChangedExternal

// Type guards for external event shapes
export const isAssetsComponentUpdatedExternal = (event: any): event is AssetsComponentUpdatedExternal => {
    return event && typeof event === 'object' && event.type === 'Component Updated' &&
           typeof event.assetId === 'string' && typeof event.componentId === 'string' && typeof event.wml === 'string'
}

export const isAssetsCanonUpdatedExternal = (event: any): event is AssetsCanonUpdatedExternal => {
    return event && typeof event === 'object' && event.type === 'Canon Updated' &&
           Array.isArray(event.assetIds) && event.assetIds.every((id: any) => typeof id === 'string')
}

export const isAssetsZoneChangedExternal = (event: any): event is AssetsZoneChangedExternal => {
    return event && typeof event === 'object' && event.type === 'Zone Changed' &&
           typeof event.fromZone === 'string' && typeof event.toZone === 'string' &&
           (event.player === undefined || typeof event.player === 'string') &&
           (event.subFolder === undefined || typeof event.subFolder === 'string')
}

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
            (isAssetsComponentUpdatedExternal(event.event) || isAssetsCanonUpdatedExternal(event.event) || isAssetsZoneChangedExternal(event.event))
        )
    },
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (evt) => {
            const { event, streamKey } = evt
            if (isAssetsComponentUpdatedExternal(event)) {
                const { componentId } = event
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
            if (isAssetsCanonUpdatedExternal(event)) {
                const { assetIds } = event
                messageBus.send({
                    type: 'CanonSet',
                    assetIds: assetIds.filter(isEphemeraAssetId)
                })
                return
            }
            if (isAssetsZoneChangedExternal(event)) {
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


