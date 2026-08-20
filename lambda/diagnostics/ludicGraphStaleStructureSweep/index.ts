import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import {
    DiagnosticsEventSerializer,
    DiagnosticsLudicGraphStaleStructureFindingEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'

import { isLudicGraphStructurallyStale } from './classification'

type HostMetaRow = {
    EphemeraId: string
    DataCategory: string
    ludicGraph?: unknown
}

export type LudicGraphStaleStructureSweepResult = {
    emittedCount: number
    ephemeraIds: EphemeraMembershipHostId[]
}

export type LudicGraphStaleStructureSweepDependencies = {
    listCandidateRows?: () => Promise<HostMetaRow[]>
    emitFinding?: (args: {
        ephemeraId: EphemeraMembershipHostId
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

// The five host kinds LP0 widened `EphemeraMembershipHostId` to --- every `Meta::*` row that
// can carry a `ludicGraph` field.
const HOST_DATA_CATEGORIES = ['Meta::Room', 'Meta::Character', 'Meta::Object', 'Meta::Feature', 'Meta::Area'] as const

const defaultListCandidateRows = async (): Promise<HostMetaRow[]> => {
    const rowsByCategory = await Promise.all(
        HOST_DATA_CATEGORIES.map((dataCategory) => queryAllEphemeraRowsByDataCategory<HostMetaRow>({
            dataCategory,
            projectionFields: ['EphemeraId', 'DataCategory', 'ludicGraph'],
        }))
    )
    return rowsByCategory.flat()
}

const defaultEmitFinding = async (args: {
    ephemeraId: EphemeraMembershipHostId
    diagnosticRunId: string
    nowMs: number
    eventBusName: string
}): Promise<void> => {
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const internalEvent: DiagnosticsLudicGraphStaleStructureFindingEvent = {
        type: 'Ludic Graph Stale Structure Finding',
        ephemeraId: args.ephemeraId,
        diagnosticRunId: args.diagnosticRunId,
        timestamp: new Date(args.nowMs).toISOString(),
    }
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: args.nowMs,
        type: 'Ludic Graph Stale Structure Finding' as const,
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

/**
 * Read-only diagnostics sweep for `ludicGraph` structural staleness (LP4i). Scans every
 * `Meta::*` host row that can carry a `ludicGraph` field and flags one iff the shipped shape
 * guard (`isEphemeraLudicGraphFieldPayload`) rejects its stored payload --- currently reachable
 * only via clause 3's root-in-nodes gap, since nothing else in the shape has drifted. Report-only:
 * emits `Ludic Graph Stale Structure Finding` and performs no repair (that is `ephemera`'s, via
 * the self-heal consumer this finding triggers).
 */
export const ludicGraphStaleStructureSweep = async (
    params?: {
        diagnosticRunId?: string
        nowMs?: number
    },
    deps?: LudicGraphStaleStructureSweepDependencies
): Promise<LudicGraphStaleStructureSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('ludicGraphStaleStructureSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const resolvedDeps = {
        listCandidateRows: deps?.listCandidateRows ?? defaultListCandidateRows,
        emitFinding: deps?.emitFinding ?? defaultEmitFinding,
    }

    const rows = await resolvedDeps.listCandidateRows()
    const staleEphemeraIds: EphemeraMembershipHostId[] = []
    for (const row of rows) {
        if (!isEphemeraMembershipHostId(row.EphemeraId)) {
            continue
        }
        if (isLudicGraphStructurallyStale(row.ludicGraph)) {
            staleEphemeraIds.push(row.EphemeraId)
        }
    }
    staleEphemeraIds.sort()

    for (const ephemeraId of staleEphemeraIds) {
        await resolvedDeps.emitFinding({
            ephemeraId,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
    }

    return {
        emittedCount: staleEphemeraIds.length,
        ephemeraIds: staleEphemeraIds,
    }
}

export { isLudicGraphStructurallyStale } from './classification'
