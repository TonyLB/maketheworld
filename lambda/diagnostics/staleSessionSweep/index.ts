import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import { DiagnosticsEventSerializer, DiagnosticsStaleSessionIdFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { assetDB, connectionDB, META_SESSION_PK, playerSessionsPK, sessionIdFromMetaSortKey, sessionMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import { isStaleSessionMetaRow } from './classification'

type PlayerMetaRow = {
    AssetId: string
    DataCategory: 'Meta::Player'
}

const playerFromPlayerMetaAssetId = (assetId: string): string | null => {
    if (!assetId.startsWith('PLAYER#')) {
        return null
    }
    const player = assetId.slice('PLAYER#'.length)
    return player.length ? player : null
}

const unfoldPages = async <T>(firstPage: QueryPageEnvelope<T>): Promise<T[]> => {
    const collected: T[] = []
    let page = firstPage
    let nextPage = page.nextPage
    do {
        collected.push(...page.items)
        nextPage = page.nextPage
        if (nextPage) {
            page = await nextPage()
        }
    } while (nextPage)
    return collected
}

const queryAllPlayerNames = async (): Promise<string[]> => {
    const firstPage = await assetDB.query<PlayerMetaRow>({
        IndexName: 'DataCategoryIndex',
        Key: {
            DataCategory: 'Meta::Player'
        },
        ProjectionFields: ['AssetId', 'DataCategory'],
        pagination: true
    }) as unknown as QueryPageEnvelope<PlayerMetaRow>
    const rows = await unfoldPages<PlayerMetaRow>(firstPage)
    return rows
        .map(({ AssetId }) => (playerFromPlayerMetaAssetId(AssetId)))
        .filter((player): player is string => Boolean(player))
}

/**
 * Maintains the player -> session reverse-index pointer rows (D3): backfills a pointer for every
 * currently-existing session meta row that has a player but no pointer, and prunes pointer rows
 * whose session meta row is gone. Pointer rows are payload-free and idempotent, so both directions
 * are safe to run unconditionally on every sweep invocation.
 */
const maintainSessionPointers = async (metaRows: MetaSessionRow[]): Promise<void> => {
    const activeSessionIds = new Set(
        metaRows
            .map((row) => (sessionIdFromMetaSortKey(row.DataCategory)))
            .filter((sessionId): sessionId is string => Boolean(sessionId))
    )

    await Promise.all(metaRows.map(async (row) => {
        const sessionId = sessionIdFromMetaSortKey(row.DataCategory)
        const player = typeof row.player === 'string' ? row.player.trim() : ''
        if (!sessionId || !player) {
            return
        }
        const existing = await connectionDB.getItem<{ ConnectionId: string }>({
            Key: {
                ConnectionId: playerSessionsPK(player),
                DataCategory: sessionMetaSortKey(sessionId)
            },
            ProjectionFields: ['ConnectionId']
        })
        if (!existing) {
            await connectionDB.putItem({
                ConnectionId: playerSessionsPK(player),
                DataCategory: sessionMetaSortKey(sessionId)
            })
        }
    }))

    const players = await queryAllPlayerNames()
    await Promise.all(players.map(async (player) => {
        const pointerRows = await connectionDB.query<{ DataCategory: string }>({
            Key: { ConnectionId: playerSessionsPK(player) },
            ProjectionFields: ['DataCategory']
        })
        await Promise.all((pointerRows ?? []).map(async (pointerRow) => {
            const sessionId = sessionIdFromMetaSortKey(pointerRow.DataCategory)
            if (sessionId && !activeSessionIds.has(sessionId)) {
                await connectionDB.deleteItem({
                    ConnectionId: playerSessionsPK(player),
                    DataCategory: pointerRow.DataCategory
                })
            }
        }))
    }))
}

type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
    connections?: string[]
    dropAfter?: number
    player?: string
}

const queryAllMetaSessionRows = async (): Promise<MetaSessionRow[]> => {
    const collected: MetaSessionRow[] = []
    let nextPage: (() => Promise<QueryPageEnvelope<MetaSessionRow>>) | undefined
    let page = await connectionDB.query<MetaSessionRow>({
        Key: {
            ConnectionId: META_SESSION_PK
        },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': 'SESSION#'
        },
        ProjectionFields: ['ConnectionId', 'DataCategory', 'connections', 'dropAfter', 'player'],
        ConsistentRead: true,
        pagination: true
    })
    do {
        collected.push(...page.items)
        nextPage = page.nextPage
        if (nextPage) {
            page = await nextPage()
        }
    } while (nextPage)

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

const emitStaleSessionIdFinding = async (params: {
    player: string
    diagnosticRunId: string
    nowMs: number
    eventBusName: string
    serializer: DiagnosticsEventSerializer
    ebClient: EventBridgeClient
}): Promise<void> => {
    const { player, diagnosticRunId, nowMs, eventBusName, serializer, ebClient } = params
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
}

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
    await maintainSessionPointers(metaRows)
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
        await emitStaleSessionIdFinding({ player, diagnosticRunId, nowMs, eventBusName, serializer, ebClient })
        emittedCount += 1
    }

    return { emittedCount, players }
}

/**
 * Player-scoped counterpart to `staleSessionSweep`, driven by connect-time detection (`Stale Session
 * Problem` on `mtw.players`). Resolves only the reported player's reverse-index pointers -- no
 * whole-table scan, no pointer maintenance (that stays exclusively with the full sweep) -- and emits
 * the same `Stale SessionId Finding` if that player has any currently-stale session.
 */
export const evaluateStaleSessionsForPlayer = async (params: {
    player: string
    diagnosticRunId?: string
    nowMs?: number
}): Promise<{ emittedCount: number; players: string[] }> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('evaluateStaleSessionsForPlayer requires EVENT_BUS_NAME')
    }

    const player = params.player.trim()
    if (!player) {
        return { emittedCount: 0, players: [] }
    }

    const nowMs = params.nowMs ?? Date.now()
    const diagnosticRunId = params.diagnosticRunId ?? uuidv4()
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())

    const pointers = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        Key: { ConnectionId: playerSessionsPK(player) },
        ProjectionFields: ['DataCategory'],
        ConsistentRead: true
    })

    const sessionIds = [...new Set(
        (pointers || [])
            .map(({ DataCategory }) => sessionIdFromMetaSortKey(DataCategory))
            .filter((sessionId): sessionId is string => Boolean(sessionId))
    )]

    if (!sessionIds.length) {
        return { emittedCount: 0, players: [] }
    }

    const rows = await connectionDB.getItems<MetaSessionRow>({
        Keys: sessionIds.map((sessionId) => ({
            ConnectionId: META_SESSION_PK,
            DataCategory: sessionMetaSortKey(sessionId)
        })),
        ProjectionFields: ['ConnectionId', 'DataCategory', 'connections', 'dropAfter'],
        ConsistentRead: true
    })

    const hasStaleRow = rows.some((row) => isStaleSessionMetaRow({
        connections: row.connections,
        dropAfter: row.dropAfter,
        nowMs
    }))

    if (!hasStaleRow) {
        return { emittedCount: 0, players: [] }
    }

    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    await emitStaleSessionIdFinding({ player, diagnosticRunId, nowMs, eventBusName, serializer, ebClient })

    return { emittedCount: 1, players: [player] }
}

export { hasActiveConnections, isStaleSessionMetaRow, STALE_BUFFER_MS } from './classification'

