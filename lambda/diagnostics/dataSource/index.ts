import { DataSource } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { DiagnosticsEventSerializer, DiagnosticsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isSessionDisconnectProblemEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import messageBus from '../messageBus'
import { roomOccupancyDriftSweep } from '../roomOccupancyDriftSweep'
import { componentVerticalMisalignmentSweep } from '../componentVerticalMisalignmentSweep'
import { playerMisalignmentSweep } from '../playerMisalignmentSweep'
import { renderCacheDriftSweep } from '../renderCacheDriftSweep'
import { staleSessionSweep } from '../staleSessionSweep'
import {
    DiagnosticsSubscribedContent,
    isConnectionsProblemEnvelope,
    isDiagnosticsApiRoomOccupancyDriftSweepEnvelope,
    isDiagnosticsApiComponentVerticalMisalignmentSweepEnvelope,
    isDiagnosticsApiPlayerMisalignmentSweepEnvelope,
    isDiagnosticsApiRenderCacheDriftSweepEnvelope,
    isDiagnosticsApiStaleSessionSweepEnvelope,
    isDiagnosticsSubscribedEnvelope
} from './subscribedEvents'

const diagnosticsEventSerializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())

export const processDiagnosticsSubscribedEvents = async (events: any[]) => {
    const preparedEvents = await Promise.all(events.map(async (event) => {
        if (!isConnectionsProblemEnvelope(event as any)) {
            return { event, normalizedContent: null }
        }
        const content = await event.getContent()
        return {
            event,
            normalizedContent: {
                ...(typeof content === 'object' && content !== null ? content : {}),
                type: event.header.type
            }
        }
    }))

    const dedupedEvents = preparedEvents.reduce<typeof preparedEvents>((previous, entry) => {
        if (!isConnectionsProblemEnvelope(entry.event as any)) {
            return [...previous, entry]
        }
        if (!isSessionDisconnectProblemEvent(entry.normalizedContent)) {
            console.log(JSON.stringify({
                event: 'diagnostics-intake-drop',
                reason: 'invalid-connections-event-payload',
                source: entry.event.header.dataSourceKey,
                detailType: entry.event.header.type
            }))
            return previous
        }
        const alreadyIncluded = previous.some(
            ({ normalizedContent }) =>
                isSessionDisconnectProblemEvent(normalizedContent) &&
                normalizedContent.dedupeKey === entry.normalizedContent.dedupeKey
        )
        if (alreadyIncluded) {
            return previous
        }
        return [...previous, entry]
    }, [])

    await Promise.all(dedupedEvents.map(async ({ event }) => {
        try {
            if (isConnectionsProblemEnvelope(event as any)) {
                await staleSessionSweep()
                return
            }
            if (isDiagnosticsApiStaleSessionSweepEnvelope(event as any)) {
                const content = await event.getContent()
                const result = await staleSessionSweep({
                    diagnosticRunId: typeof content.diagnosticRunId === 'string' ? content.diagnosticRunId : undefined,
                    nowMs: typeof content.nowMs === 'number' ? content.nowMs : undefined
                })
                messageBus.send({
                    type: 'ReturnValue',
                    body: result as Record<string, any>
                })
                return
            }
            if (isDiagnosticsApiRoomOccupancyDriftSweepEnvelope(event as any)) {
                const content = await event.getContent()
                const result = await roomOccupancyDriftSweep({
                    diagnosticRunId: typeof content.diagnosticRunId === 'string' ? content.diagnosticRunId : undefined,
                    nowMs: typeof content.nowMs === 'number' ? content.nowMs : undefined
                })
                messageBus.send({
                    type: 'ReturnValue',
                    body: result as Record<string, any>
                })
                return
            }
            if (isDiagnosticsApiPlayerMisalignmentSweepEnvelope(event as any)) {
                const content = await event.getContent()
                const result = await playerMisalignmentSweep({
                    diagnosticRunId: typeof content.diagnosticRunId === 'string' ? content.diagnosticRunId : undefined,
                    nowMs: typeof content.nowMs === 'number' ? content.nowMs : undefined
                })
                messageBus.send({
                    type: 'ReturnValue',
                    body: result as Record<string, any>
                })
                return
            }
            if (isDiagnosticsApiComponentVerticalMisalignmentSweepEnvelope(event as any)) {
                const content = await event.getContent()
                if (typeof content.assetId !== 'string' || !content.assetId.length) {
                    messageBus.send({
                        type: 'Error',
                        body: { error: 'ComponentVerticalMisalignmentSweep requires assetId', statusCode: 400 }
                    })
                    return
                }
                const result = await componentVerticalMisalignmentSweep({
                    assetId: content.assetId,
                    diagnosticRunId: typeof content.diagnosticRunId === 'string' ? content.diagnosticRunId : undefined,
                    nowMs: typeof content.nowMs === 'number' ? content.nowMs : undefined
                })
                messageBus.send({
                    type: 'ReturnValue',
                    body: result as Record<string, any>
                })
                return
            }
            if (isDiagnosticsApiRenderCacheDriftSweepEnvelope(event as any)) {
                const content = await event.getContent()
                if (!Array.isArray(content.roomIds)) {
                    messageBus.send({
                        type: 'Error',
                        body: { error: 'RenderCacheDriftSweep requires roomIds array', statusCode: 400 }
                    })
                    return
                }
                const result = await renderCacheDriftSweep({
                    roomIds: content.roomIds,
                    diagnosticRunId: typeof content.diagnosticRunId === 'string' ? content.diagnosticRunId : undefined,
                    nowMs: typeof content.nowMs === 'number' ? content.nowMs : undefined
                })
                messageBus.send({
                    type: 'ReturnValue',
                    body: result as Record<string, any>
                })
                return
            }
        }
        catch (error) {
            messageBus.send({
                type: 'Error',
                body: {
                    error: error instanceof Error ? error.message : String(error),
                    statusCode: 500
                }
            })
        }
    }))
}

export const diagnosticsDataSource = new DataSource<
    never,
    DiagnosticsEventUpdate,
    DiagnosticsSubscribedContent,
    any,
    'ConnectionId'
>({
    dynamo: connectionDB as any,
    sns: {
        send: async () => undefined
    },
    messageBus: messageBus,
    primaryKeyName: 'ConnectionId',
    dataSourceKey: 'mtw.diagnostics',
    feedbackTopicArn: process.env.FEEDBACK_TOPIC ?? '',
    replayable: false,
    eventSerializer: diagnosticsEventSerializer,
    subscribedEventTypeGuard: isDiagnosticsSubscribedEnvelope as any,
    receiveEvents: async ({ events }) => {
        await processDiagnosticsSubscribedEvents(events)
    }
})

diagnosticsDataSource.subscribe()
