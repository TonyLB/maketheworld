import { coreFormatToStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import messageBus from './messageBus'
import { sendApiDiagnosticsEvent } from './dataSource/apiDiagnostics'
import './dataSource'

const enqueueDiagnosticsEnvelope = async (envelope: any) => {
    messageBus.send({
        type: 'StreamingEvent',
        dataSourceKey: envelope.header.dataSourceKey,
        streamKey: envelope.header.streamKey,
        timestamp: envelope.header.timestamp,
        header: envelope.header,
        getContent: envelope.getContent
    })
}

const normalizeConnectionsEventBridgeIngress = async (event: any) => {
    const coreFormat = fromEventBridgeFormat(event)
    const envelope = coreFormatToStreamingEnvelope(coreFormat, async () => coreFormat.update)
    await enqueueDiagnosticsEnvelope(envelope)
}

const normalizeApiDiagnosticsIngress = async (event: any) => {
    switch (event.type) {
        case 'StaleSessionSweep':
            sendApiDiagnosticsEvent(messageBus, {
                type: 'StaleSessionSweep',
                ...(typeof event.diagnosticRunId === 'string' ? { diagnosticRunId: event.diagnosticRunId } : {}),
                ...(typeof event.nowMs === 'number' ? { nowMs: event.nowMs } : {})
            })
            return
        case 'RoomOccupancyDriftSweep':
            sendApiDiagnosticsEvent(messageBus, {
                type: 'RoomOccupancyDriftSweep',
                ...(typeof event.diagnosticRunId === 'string' ? { diagnosticRunId: event.diagnosticRunId } : {}),
                ...(typeof event.nowMs === 'number' ? { nowMs: event.nowMs } : {})
            })
            return
    }
}

export const routeDiagnosticsIngress = async (event: any) => {
    if (event?.source && event?.['detail-type'] && event.source === 'mtw.connections') {
        await normalizeConnectionsEventBridgeIngress(event)
        return
    }
    await normalizeApiDiagnosticsIngress(event)
}
