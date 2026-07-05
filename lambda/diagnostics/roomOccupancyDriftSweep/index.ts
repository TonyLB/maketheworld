import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import { DiagnosticsEventSerializer, DiagnosticsRoomOccupancyDriftFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isEphemeraCharacterId, type EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { queryMembershipContainersFromDynamo } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { connectionDB, ephemeraDB, META_SESSION_PK, sessionIdFromMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'
import {
    listGraphCharacterIds,
    normalizeRoomId,
    roomHasOccupancyDrift,
} from './classification'

type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
}

type RoomMetaRow = {
    EphemeraId: string
    DataCategory: string
    positionGraph?: EphemeraPositionGraphFieldPayload
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

const queryAllMetaSessionRows = async (): Promise<MetaSessionRow[]> => {
    const firstPage = await connectionDB.query<MetaSessionRow>({
        Key: {
            ConnectionId: META_SESSION_PK
        },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': 'SESSION#'
        },
        ProjectionFields: ['ConnectionId', 'DataCategory'],
        ConsistentRead: true,
        pagination: true
    }) as unknown as QueryPageEnvelope<MetaSessionRow>
    return await unfoldPages<MetaSessionRow>(firstPage)
}

const queryAllEphemeraRowsByDataCategory = async <T extends DBHandlerItem<'EphemeraId'>>(args: {
    dataCategory: string
    projectionFields: string[]
}): Promise<T[]> => {
    const firstPage = await ephemeraDB.query<T>({
        IndexName: 'DataCategoryIndex',
        Key: {
            DataCategory: args.dataCategory
        },
        ProjectionFields: args.projectionFields,
        pagination: true
    }) as unknown as QueryPageEnvelope<T>
    return await unfoldPages<T>(firstPage)
}

const adjacencyCharactersForSession = async (sessionId: string): Promise<string[]> => {
    const rows = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        Key: { ConnectionId: `SESSION#${sessionId}` },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': 'CHARACTER#'
        },
        ProjectionFields: ['DataCategory']
    })
    return [...new Set((rows ?? []).map(({ DataCategory }) => DataCategory).filter(Boolean))].sort()
}

/**
 * Read-only diagnostics sweep for room occupancy drift (graph-forward, S2-6-DR).
 * Compares Meta::Room.positionGraph character nodes against connections session adjacency
 * and membership adjacency reverse index. Does not detect stale adjacency without a graph node.
 */
export const roomOccupancyDriftSweep = async (params?: {
    diagnosticRunId?: string
    nowMs?: number
}): Promise<{ emittedCount: number; roomIds: string[] }> => {
    const tablePrefix = process.env.TABLE_PREFIX
    if (!tablePrefix) {
        throw new Error('roomOccupancyDriftSweep requires TABLE_PREFIX')
    }
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('roomOccupancyDriftSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())

    const [metaSessionRows, roomMetaRows] = await Promise.all([
        queryAllMetaSessionRows(),
        queryAllEphemeraRowsByDataCategory<RoomMetaRow>({
            dataCategory: 'Meta::Room',
            projectionFields: ['EphemeraId', 'DataCategory', 'positionGraph']
        })
    ])

    const sessionIds = metaSessionRows
        .map(({ DataCategory }) => sessionIdFromMetaSortKey(DataCategory))
        .filter((value): value is string => Boolean(value))

    const adjacencySessionsByCharacter = new Map<string, Set<string>>()
    await Promise.all(sessionIds.map(async (sessionId) => {
        const characters = await adjacencyCharactersForSession(sessionId)
        for (const characterId of characters) {
            if (!adjacencySessionsByCharacter.has(characterId)) {
                adjacencySessionsByCharacter.set(characterId, new Set())
            }
            adjacencySessionsByCharacter.get(characterId)?.add(sessionId)
        }
    }))

    const graphCharacterIds = new Set<EphemeraCharacterId>()
    for (const room of roomMetaRows) {
        for (const characterId of listGraphCharacterIds(room.positionGraph)) {
            if (isEphemeraCharacterId(characterId)) {
                graphCharacterIds.add(characterId)
            }
        }
    }

    const membershipContainersByCharacter = new Map<string, string[]>()
    await Promise.all([...graphCharacterIds].map(async (characterId) => {
        const containers = await queryMembershipContainersFromDynamo(ephemeraDB, characterId)
        membershipContainersByCharacter.set(characterId, containers)
    }))

    const driftRoomIds = new Set<string>()

    for (const room of roomMetaRows) {
        const roomId = normalizeRoomId(room.EphemeraId)
        if (!roomId) {
            continue
        }
        const characterIdsOnGraph = listGraphCharacterIds(room.positionGraph)
        const drift = roomHasOccupancyDrift({
            roomId,
            graphCharacterIds: characterIdsOnGraph,
            adjacencySessionsByCharacter,
            membershipContainersByCharacter,
        })
        if (drift) {
            driftRoomIds.add(roomId)
        }
    }

    const roomIds = [...driftRoomIds].sort()
    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    let emittedCount = 0

    for (const roomId of roomIds) {
        const normalizedRoomId = roomId as `ROOM#${string}`
        const internalEvent: DiagnosticsRoomOccupancyDriftFindingEvent = {
            type: 'Room Occupancy Drift Finding',
            roomId: normalizedRoomId,
            diagnosticRunId,
            timestamp: new Date(nowMs).toISOString()
        }

        const header = {
            dataSourceKey: 'mtw.diagnostics' as const,
            streamKey: 'global',
            timestamp: nowMs,
            type: 'Room Occupancy Drift Finding' as const
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
        roomIds,
    }
}

export { roomHasOccupancyDrift, normalizeRoomId, listGraphCharacterIds } from './classification'
