import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export type DiagnosticsAPIPayload =
    | {
        type: 'StaleSessionSweep'
        diagnosticRunId?: string
        nowMs?: number
    }
    | {
        type: 'RoomOccupancyDriftSweep'
        diagnosticRunId?: string
        nowMs?: number
    }
    | {
        type: 'PlayerMisalignmentSweep'
        diagnosticRunId?: string
        nowMs?: number
    }
    | {
        type: 'ComponentVerticalMisalignmentSweep'
        assetId: string
        diagnosticRunId?: string
        nowMs?: number
    }
    | {
        type: 'RenderCacheDriftSweep'
        roomIds: string[]
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
    ['StaleSessionSweep', 'RoomOccupancyDriftSweep', 'PlayerMisalignmentSweep', 'ComponentVerticalMisalignmentSweep', 'RenderCacheDriftSweep'].includes(header.type)
)

export const isApiDiagnosticsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsAPIPayload,
    DiagnosticsApiSubscribedHeader
>(isApiDiagnosticsHeader)

type Bus = { publish: (payload: StreamingEventMessage) => void }

const apiDiagnosticsSerializer = {
    serialize: ({ content }: { content: DiagnosticsAPIPayload; header: { type: string } }) => ({ ...content })
}

export const sendApiDiagnosticsEvent = (
    bus: Bus,
    content: DiagnosticsAPIPayload
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
    bus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'api.diagnostics',
        streamKey: 'ingress',
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp
    })
}
