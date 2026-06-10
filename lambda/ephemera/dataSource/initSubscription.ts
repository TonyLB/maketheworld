/**
 * Send-helper for Initialize Subscription events. Used when ephemera receives
 * an EventBridge event from mtw.subscriptions and forwards it to the messageBus
 * via `publish` (P4 EventBridge ingress).
 */
import type { StreamingEventMessage } from '../messageBus/baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

type Bus = { publish: (payload: StreamingEventMessage) => void }

const initSubscriptionSerializer = {
    serialize: ({
        content,
        header,
    }: {
        content: { sessionId: string; requestId: string }
        header: StreamingEventHeader
    }) => ({ type: header.type, ...content }),
}

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
        type: `Initialize Subscription - ${dataSourceKey}`,
    }
    const payload = { sessionId, requestId }
    const envelope = createInternalOriginEnvelope(header, payload, initSubscriptionSerializer)
    bus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'mtw.subscriptions',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}
