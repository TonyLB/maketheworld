import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export type DiagnosticsAPIPayload = {
    type: 'StaleSessionSweep'
    diagnosticRunId?: string
    nowMs?: number
}

export type DiagnosticsApiSubscribedHeader = StreamingEventHeader & {
    dataSourceKey: 'api.diagnostics';
    type: DiagnosticsAPIPayload['type'];
}

const isApiDiagnosticsHeader: HeaderGuard<DiagnosticsApiSubscribedHeader> = (
    header
): header is DiagnosticsApiSubscribedHeader => (
    header.dataSourceKey === 'api.diagnostics' &&
    ['StaleSessionSweep'].includes(header.type)
)

export const isApiDiagnosticsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsAPIPayload,
    DiagnosticsApiSubscribedHeader
>(isApiDiagnosticsHeader)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

const apiDiagnosticsSerializer = {
    serialize: ({ content }: { content: DiagnosticsAPIPayload; header: { type: string } }) => ({ ...content })
}

export const sendApiDiagnosticsEvent = (
    bus: Bus,
    content: DiagnosticsAPIPayload,
    laneId?: string
) => {
    const timestamp = Date.now()
    const envelope = createInternalOriginEnvelope(
        {
            dataSourceKey: 'api.diagnostics',
            streamKey: 'ingress',
            timestamp,
            type: content.type
        },
        content,
        apiDiagnosticsSerializer
    )
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.diagnostics',
        streamKey: 'ingress',
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp
    }, laneId)
}
