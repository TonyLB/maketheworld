import EphemeraDataSource from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { EphemeraEventSerializer } from './serializers'

// For first iteration, no UpdatePayload or SnapshotPayload usage
type EphemeraSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'mtw.assets'
    event: {
        type: string
    } & Record<string, unknown>
}

export const ephemeraDataSource = new EphemeraDataSource<never, never, EphemeraSubscribedEvent>({
    dataSourceKey: 'mtw.ephemera',
    replayable: false,
    eventSerializer: new EphemeraEventSerializer(),
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is EphemeraSubscribedEvent => {
        return Boolean(
            event &&
            event.dataSourceKey === 'mtw.assets' &&
            event.event && typeof event.event === 'object' && 'type' in event.event
        )
    },
    receiveEvents: async ({ events }) => {
        // Intentionally empty for first iteration (subscribe-only)
        // Later we will translate incoming mtw.assets events into ephemera operations
        void events
    }
})

// Subscribe to the internal messageBus to receive events routed from EventBridge
ephemeraDataSource.subscribe()

export default ephemeraDataSource


