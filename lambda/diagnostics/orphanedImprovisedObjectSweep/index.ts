import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import { extractObjectIdsFromLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    DiagnosticsEventSerializer,
    DiagnosticsOrphanedImprovisedObjectFindingEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import {
    EphemeraObjectId,
    IMPROVISATION_ASSET_ID,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'

import internalCache from '../internalCache'
import { isOrphanedImprovisedObject } from './classification'

type HostMetaRow = {
    EphemeraId: string
    DataCategory: string
    ludicGraph?: EphemeraLudicGraphFieldPayload
}

type ImprovisationPairRow = {
    EphemeraId: string
    DataCategory: string
}

export type OrphanedImprovisedObjectSweepResult = {
    emittedCount: number
    objectIds: EphemeraObjectId[]
}

export type OrphanedImprovisedObjectSweepDependencies = {
    getPairRow?: (objectId: EphemeraObjectId) => Promise<ImprovisationPairRow | undefined>
    getMetaObject?: (objectId: EphemeraObjectId) => ReturnType<typeof internalCache.ObjectEphemeraMeta.get>
    getMembershipContainers?: (objectId: EphemeraObjectId) => ReturnType<typeof internalCache.Positions.getMembershipContainers>
    loadGraphObjectIds?: () => Promise<Set<EphemeraObjectId>>
    listImprovisationObjectIds?: () => Promise<EphemeraObjectId[]>
    emitFinding?: (args: {
        objectId: EphemeraObjectId
        diagnosticRunId: string
        nowMs: number
        eventBusName: string
    }) => Promise<void>
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

const queryAllEphemeraRowsByDataCategory = async <T extends DBHandlerItem<'EphemeraId'>>(args: {
    dataCategory: string
    projectionFields: string[]
}): Promise<T[]> => {
    const firstPage = await ephemeraDB.query<T>({
        IndexName: 'DataCategoryIndex',
        Key: {
            DataCategory: args.dataCategory,
        },
        ProjectionFields: args.projectionFields,
        pagination: true,
    }) as unknown as QueryPageEnvelope<T>
    return await unfoldPages<T>(firstPage)
}

const defaultGetPairRow = async (objectId: EphemeraObjectId): Promise<ImprovisationPairRow | undefined> =>
    ephemeraDB.getItem<ImprovisationPairRow>({
        Key: { EphemeraId: objectId, DataCategory: IMPROVISATION_ASSET_ID },
        ProjectionFields: ['EphemeraId', 'DataCategory'],
    })

/**
 * Every object id reachable as a *member* of some host's graph --- the "not orphaned" set.
 *
 * **`Meta::Object` is scanned too, and must be.** An object hosted On/In/PartOf another object
 * lives in that host's own shard, not in any room or character graph (CC3). Scanning only
 * Room and Character rows (as this did until 2026-09-03) makes every legitimately nested object
 * --- a cup genuinely sitting on a table --- look orphaned, and a finding here routes straight to
 * `persistDeleteImprovisationObject` with no further guard. That is a deletion of live data, so
 * the omission was a latent data-loss bug, not just an incomplete scan.
 *
 * Scanning the third DataCategory covers arbitrary nesting depth in one pass: a nested object is
 * a member of *some* host's stored graph regardless of how deep it sits, so no recursive descent
 * is needed here (contrast `collectNestedObjectIds`, which walks downward from a known root set).
 */
const defaultLoadGraphObjectIds = async (): Promise<Set<EphemeraObjectId>> => {
    const [roomRows, characterRows, objectRows] = await Promise.all([
        queryAllEphemeraRowsByDataCategory<HostMetaRow>({
            dataCategory: 'Meta::Room',
            projectionFields: ['EphemeraId', 'DataCategory', 'ludicGraph'],
        }),
        queryAllEphemeraRowsByDataCategory<HostMetaRow>({
            dataCategory: 'Meta::Character',
            projectionFields: ['EphemeraId', 'DataCategory', 'ludicGraph'],
        }),
        queryAllEphemeraRowsByDataCategory<HostMetaRow>({
            dataCategory: 'Meta::Object',
            projectionFields: ['EphemeraId', 'DataCategory', 'ludicGraph'],
        }),
    ])

    const objectIds = new Set<EphemeraObjectId>()
    for (const row of [...roomRows, ...characterRows, ...objectRows]) {
        if (!row.ludicGraph) {
            continue
        }
        for (const graphObjectId of extractObjectIdsFromLudicGraph(row.ludicGraph)) {
            // An object-hosted graph lists its own root among `nodes`; that self-reference says
            // nothing about whether anything hosts *it*, so it must not count as being held.
            if (isEphemeraObjectId(graphObjectId) && graphObjectId !== row.EphemeraId) {
                objectIds.add(graphObjectId)
            }
        }
    }
    return objectIds
}

const defaultListImprovisationObjectIds = async (): Promise<EphemeraObjectId[]> => {
    const rows = await queryAllEphemeraRowsByDataCategory<ImprovisationPairRow>({
        dataCategory: IMPROVISATION_ASSET_ID,
        projectionFields: ['EphemeraId', 'DataCategory'],
    })
    const seen = new Set<EphemeraObjectId>()
    const objectIds: EphemeraObjectId[] = []
    for (const row of rows) {
        if (isEphemeraObjectId(row.EphemeraId) && !seen.has(row.EphemeraId)) {
            seen.add(row.EphemeraId)
            objectIds.push(row.EphemeraId)
        }
    }
    return objectIds.sort()
}

const normalizeObjectIds = (objectIds: string[] | undefined): EphemeraObjectId[] => {
    if (!Array.isArray(objectIds)) {
        return []
    }
    const seen = new Set<EphemeraObjectId>()
    const normalized: EphemeraObjectId[] = []
    for (const id of objectIds) {
        if (typeof id !== 'string' || !isEphemeraObjectId(id) || seen.has(id)) {
            continue
        }
        seen.add(id)
        normalized.push(id)
    }
    return normalized.sort()
}

const defaultEmitFinding = async (args: {
    objectId: EphemeraObjectId
    diagnosticRunId: string
    nowMs: number
    eventBusName: string
}): Promise<void> => {
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const internalEvent: DiagnosticsOrphanedImprovisedObjectFindingEvent = {
        type: 'Orphaned Improvised Object Finding',
        objectId: args.objectId,
        diagnosticRunId: args.diagnosticRunId,
        timestamp: new Date(args.nowMs).toISOString(),
    }
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: args.nowMs,
        type: 'Orphaned Improvised Object Finding' as const,
    }
    const { eventBridgeEvent } = publishStreamEvent({
        header,
        content: internalEvent,
        serializer: serializer as StreamEventPublisherSerializer<typeof header>,
    })
    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    await ebClient.send(new PutEventsCommand({
        Entries: [{
            Source: eventBridgeEvent.Source,
            DetailType: eventBridgeEvent.DetailType,
            EventBusName: args.eventBusName,
            Detail: JSON.stringify(eventBridgeEvent.Detail),
        }],
    }))
}

const classifyObject = async (
    objectId: EphemeraObjectId,
    deps: Required<Pick<
        OrphanedImprovisedObjectSweepDependencies,
        'getPairRow' | 'getMetaObject' | 'getMembershipContainers' | 'loadGraphObjectIds'
    >>,
    graphObjectIds: Set<EphemeraObjectId>
): Promise<boolean> => {
    const [pairRow, metaRow, membershipContainers] = await Promise.all([
        deps.getPairRow(objectId),
        deps.getMetaObject(objectId),
        deps.getMembershipContainers(objectId),
    ])
    return isOrphanedImprovisedObject({
        objectId,
        hasPairRow: Boolean(pairRow),
        hasMetaRow: Boolean(metaRow),
        membershipContainers,
        onAnyLudicGraph: graphObjectIds.has(objectId),
    })
}

/**
 * Read-only diagnostics sweep for orphaned improvised objects (existence without placement).
 */
export const orphanedImprovisedObjectSweep = async (
    params?: {
        objectIds?: string[]
        diagnosticRunId?: string
        nowMs?: number
    },
    deps?: OrphanedImprovisedObjectSweepDependencies
): Promise<OrphanedImprovisedObjectSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('orphanedImprovisedObjectSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const resolvedDeps = {
        getPairRow: deps?.getPairRow ?? defaultGetPairRow,
        getMetaObject: deps?.getMetaObject ?? ((objectId) => internalCache.ObjectEphemeraMeta.get(objectId)),
        getMembershipContainers: deps?.getMembershipContainers
            ?? ((objectId) => internalCache.Positions.getMembershipContainers(objectId)),
        loadGraphObjectIds: deps?.loadGraphObjectIds ?? defaultLoadGraphObjectIds,
        listImprovisationObjectIds: deps?.listImprovisationObjectIds ?? defaultListImprovisationObjectIds,
        emitFinding: deps?.emitFinding ?? defaultEmitFinding,
    }

    const candidateIds = params?.objectIds !== undefined
        ? normalizeObjectIds(params.objectIds)
        : await resolvedDeps.listImprovisationObjectIds()

    const graphObjectIds = await resolvedDeps.loadGraphObjectIds()
    const confirmedOrphans: EphemeraObjectId[] = []

    for (const objectId of candidateIds) {
        const isOrphan = await classifyObject(objectId, resolvedDeps, graphObjectIds)
        if (isOrphan) {
            confirmedOrphans.push(objectId)
        }
    }

    for (const objectId of confirmedOrphans) {
        await resolvedDeps.emitFinding({
            objectId,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
    }

    return {
        emittedCount: confirmedOrphans.length,
        objectIds: confirmedOrphans,
    }
}

export { isOrphanedImprovisedObject } from './classification'
