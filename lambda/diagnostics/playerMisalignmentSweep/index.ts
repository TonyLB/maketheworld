import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import { coyoteGameEnabled } from '@tonylb/mtw-base/ts/coyoteGame'
import { DiagnosticsEventSerializer, DiagnosticsPlayerMisalignmentFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'

type PlayerMetaRow = {
    AssetId: string
    DataCategory: 'Meta::Player'
    guestName?: string
    guestId?: string
}

type AssetPlayerRow = {
    AssetId: string
    DataCategory: 'Meta::Asset' | 'Meta::Character'
    player?: string
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

const queryAllByDataCategory = async <T extends { AssetId: string; DataCategory: string }>(dataCategory: string, projectionFields: string[]): Promise<T[]> => {
    const firstPage = await assetDB.query<T>({
        IndexName: 'DataCategoryIndex',
        Key: {
            DataCategory: dataCategory
        },
        ProjectionFields: projectionFields,
        pagination: true
    }) as unknown as QueryPageEnvelope<T>
    return await unfoldPages<T>(firstPage)
}

const playerFromPlayerMetaAssetId = (assetId: string): string | null => {
    if (!assetId.startsWith('PLAYER#')) {
        return null
    }
    const player = assetId.slice('PLAYER#'.length)
    return player.length ? player : null
}

/**
 * Read-only diagnostics sweep for player misalignment.
 * Emits one finding per player where assets-table evidence suggests healPlayer should run.
 */
export const playerMisalignmentSweep = async (params?: {
    diagnosticRunId?: string
    nowMs?: number
}): Promise<{ emittedCount: number; players: string[] }> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('playerMisalignmentSweep requires EVENT_BUS_NAME')
    }
    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const [playerRows, assetRows, characterRows] = await Promise.all([
        queryAllByDataCategory<PlayerMetaRow>('Meta::Player', ['AssetId', 'DataCategory', 'guestName', 'guestId']),
        queryAllByDataCategory<AssetPlayerRow>('Meta::Asset', ['AssetId', 'DataCategory', 'player']),
        queryAllByDataCategory<AssetPlayerRow>('Meta::Character', ['AssetId', 'DataCategory', 'player'])
    ])

    const playersWithMeta = new Set<string>()
    const misalignedPlayers = new Set<string>()
    for (const row of playerRows) {
        const player = playerFromPlayerMetaAssetId(row.AssetId)
        if (!player) {
            continue
        }
        playersWithMeta.add(player)
        const coyoteGuestNameNeedsUpdate = coyoteGameEnabled && row.guestName !== player
        if (!row.guestName || !row.guestId || coyoteGuestNameNeedsUpdate) {
            misalignedPlayers.add(player)
        }
    }

    for (const row of [...assetRows, ...characterRows]) {
        if (!row.player || !row.player.length) {
            continue
        }
        if (!playersWithMeta.has(row.player)) {
            misalignedPlayers.add(row.player)
        }
    }

    const players = [...misalignedPlayers].sort()
    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    let emittedCount = 0

    for (const player of players) {
        const internalEvent: DiagnosticsPlayerMisalignmentFindingEvent = {
            type: 'Player Misalignment Finding',
            player,
            diagnosticRunId,
            timestamp: new Date(nowMs).toISOString()
        }
        const header = {
            dataSourceKey: 'mtw.diagnostics' as const,
            streamKey: 'global',
            timestamp: nowMs,
            type: 'Player Misalignment Finding' as const
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

    return {
        emittedCount,
        players
    }
}

