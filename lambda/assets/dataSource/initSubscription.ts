/**
 * Send-helper for Initialize Subscription events. Used when the lambda receives
 * an EventBridge event from mtw.subscriptions and forwards it to the messageBus.
 */
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

type Bus = { send: (payload: StreamingEventMessage) => void }

export function sendInitializeSubscription(
    bus: Bus,
    dataSourceKey: string,
    streamKey: string,
    sessionId: string,
    requestId: string
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'mtw.subscriptions',
        streamKey,
        timestamp,
        type: `Initialize Subscription - ${dataSourceKey}`
    }
    const payload = { sessionId, requestId }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'mtw.subscriptions',
        streamKey,
        header,
        getContentInternal: () => Promise.resolve(payload),
        timestamp
    })
}
