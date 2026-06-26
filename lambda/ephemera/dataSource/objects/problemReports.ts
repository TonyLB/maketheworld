import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    buildSpawnCompensationDedupeKey,
    EphemeraObjectsEventSerializer,
    EphemeraObjectsSpawnCompensationProblemEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/objects'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { asyncSuppressExceptions } from '@tonylb/mtw-utilities/ts/errors'

const serializer = new EphemeraObjectsEventSerializer(createNodeDataSourceEnvironment())

export type StreamSpawnCompensationProblemParams = {
    objectId: EphemeraObjectId;
    targetRoomId: EphemeraRoomId;
    placementError: string;
    deleteError: string;
    sourceOperation?: string;
    attemptCount?: number;
    nowMs?: number;
    eventBridgeClient?: EventBridgeClient;
}

export const streamSpawnCompensationProblem = async (
    params: StreamSpawnCompensationProblemParams
): Promise<void> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('streamSpawnCompensationProblem requires EVENT_BUS_NAME')
    }

    const nowMs = params.nowMs ?? Date.now()
    const sourceOperation = params.sourceOperation ?? 'spawnOneImprovisationObject'
    const attemptCount = params.attemptCount ?? 1
    const dedupeKey = buildSpawnCompensationDedupeKey(params.objectId, attemptCount)

    const internalEvent: EphemeraObjectsSpawnCompensationProblemEvent = {
        type: 'Spawn Compensation Problem',
        objectId: params.objectId,
        targetRoomId: params.targetRoomId,
        sourceOperation,
        placementError: params.placementError,
        deleteError: params.deleteError,
        attemptCount,
        dedupeKey,
        timestamp: new Date(nowMs).toISOString(),
    }

    const header = {
        dataSourceKey: 'mtw.ephemera.objects' as const,
        streamKey: 'global',
        timestamp: nowMs,
        type: 'Spawn Compensation Problem' as const,
    }

    const { eventBridgeEvent } = publishStreamEvent({
        header,
        content: internalEvent,
        serializer: serializer as StreamEventPublisherSerializer<typeof header>,
    })

    const ebClient = params.eventBridgeClient ?? new EventBridgeClient({ region: process.env.AWS_REGION })

    await asyncSuppressExceptions(async () => {
        await ebClient.send(new PutEventsCommand({
            Entries: [{
                Source: eventBridgeEvent.Source,
                DetailType: eventBridgeEvent.DetailType,
                EventBusName: eventBusName,
                Detail: JSON.stringify(eventBridgeEvent.Detail),
            }],
        }))
    })
}
