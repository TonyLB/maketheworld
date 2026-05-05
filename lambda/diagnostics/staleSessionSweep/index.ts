import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { DiagnosticsEventSerializer, DiagnosticsStaleSessionIdFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { connectionDB, META_SESSION_PK, sessionIdFromMetaSortKey, sessionMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isStaleSessionMetaRow } from './classification'

type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
    connections?: string[]
    dropAfter?: number
    player?: string
}

const queryAllMetaSessionRows = async (): Promise<MetaSessionRow[]> => {
    const tablePrefix = process.env.TABLE_PREFIX
    if (!tablePrefix) {
        throw new Error('staleSessionSweep requires TABLE_PREFIX')
    }
    const client = new DynamoDBClient({ region: process.env.AWS_REGION })
    const tableName = `${tablePrefix}_connections`
    const collected: MetaSessionRow[] = []
    let exclusiveStartKey: Record<string, AttributeValue> | undefined

    do {
        const out = await client.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'ConnectionId = :pk AND begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: marshall({
                ':pk': META_SESSION_PK,
                ':prefix': 'SESSION#'
            }),
            ConsistentRead: true,
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        }))
        const batch = (out.Items ?? []).map((item) => unmarshall(item) as MetaSessionRow)
        collected.push(...batch)
        exclusiveStartKey = out.LastEvaluatedKey
    } while (exclusiveStartKey)

    return collected
}

const streamSubscriptionRowsForSession = async (sessionId: string): Promise<{ ConnectionId: string }[]> => {
    const rows = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        IndexName: 'DataCategoryIndex',
        Key: { DataCategory: sessionMetaSortKey(sessionId) },
        ProjectionFields: ['ConnectionId']
    })
    return (rows ?? []).filter(({ ConnectionId }) => ConnectionId.startsWith('STREAM#'))
}

const characterAdjacencyRowsForSession = async (sessionId: string) =>
    connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        Key: { ConnectionId: `SESSION#${sessionId}` },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': 'CHARACTER#'
        },
        ProjectionFields: ['DataCategory']
    })

/**
 * Evaluates stream subscriptions and session/character adjacency for sessions whose meta row is stale.
 * Reports are aggregated per player; emission requires a non-empty `player` on the meta row.
 */
export const staleSessionSweep = async (params?: {
    diagnosticRunId?: string
    nowMs?: number
}): Promise<{ emittedCount: number; players: string[] }> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('staleSessionSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())

    const metaRows = await queryAllMetaSessionRows()
    const affectedPlayers = new Set<string>()

    for (const row of metaRows) {
        const sessionId = sessionIdFromMetaSortKey(row.DataCategory)
        if (!sessionId) {
            continue
        }

        const staleMeta = isStaleSessionMetaRow({
            connections: row.connections,
            dropAfter: row.dropAfter,
            nowMs
        })

        if (!staleMeta) {
            continue
        }

        const player = typeof row.player === 'string' ? row.player.trim() : ''
        if (!player) {
            continue
        }

        // Evaluate stream subscriptions and adjacency for stale sessions (report-only; informs operators).
        await streamSubscriptionRowsForSession(sessionId)
        await characterAdjacencyRowsForSession(sessionId)

        affectedPlayers.add(player)
    }

    const players = [...affectedPlayers].sort()
    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })

    let emittedCount = 0
    for (const player of players) {
        const internalEvent: DiagnosticsStaleSessionIdFindingEvent = {
            type: 'Stale SessionId Finding',
            player,
            diagnosticRunId,
            timestamp: new Date(nowMs).toISOString()
        }

        const header = {
            dataSourceKey: 'mtw.diagnostics' as const,
            streamKey: 'global',
            timestamp: nowMs,
            type: 'Stale SessionId Finding' as const
        }

        const { eventBridgeEvent } = publishStreamEvent({
            header,
            content: internalEvent,
            serializer: serializer as StreamEventPublisherSerializer<typeof header>
        })

        await ebClient.send(new PutEventsCommand({
            Entries: [{
                Source: eventBridgeEvent.Source,
                DetailType: eventBridgeEvent.DetailType,
                EventBusName: eventBusName,
                Detail: JSON.stringify(eventBridgeEvent.Detail)
            }]
        }))
        emittedCount += 1
    }

    return { emittedCount, players }
}

export { hasActiveConnections, isStaleSessionMetaRow, STALE_BUFFER_MS } from './classification'

