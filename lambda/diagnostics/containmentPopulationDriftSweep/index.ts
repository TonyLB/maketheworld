import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import {
    DiagnosticsContainmentPopulationDriftFindingEvent,
    DiagnosticsEventSerializer,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'

import { containmentDriftParentsOf } from './classification'

type HostMetaRow = {
    EphemeraId: string
    DataCategory: string
    ludicGraph?: unknown
}

export type ContainmentPopulationDriftSweepResult = {
    emittedCount: number
    ephemeraIds: EphemeraMembershipHostId[]
}

export type ContainmentPopulationDriftSweepDependencies = {
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

// The two child kinds cache-time containment population binds (Room-in-Area, Feature-in-Room,
// Feature-in-Feature), whose own rows hold the bindings this sweep classifies, plus Areas, whose
// rows hold the root a Room's carve-out names, plus Characters and Objects, whose root binding the
// Base migration renames.
const CHILD_DATA_CATEGORIES = ['Meta::Room', 'Meta::Feature', 'Meta::Area', 'Meta::Character', 'Meta::Object'] as const

const defaultListCandidateRows = async (): Promise<HostMetaRow[]> => {
    const rowsByCategory = await Promise.all(
        CHILD_DATA_CATEGORIES.map((dataCategory) => queryAllEphemeraRowsByDataCategory<HostMetaRow>({
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
    const internalEvent: DiagnosticsContainmentPopulationDriftFindingEvent = {
        type: 'Containment Population Drift Finding',
        ephemeraId: args.ephemeraId,
        diagnosticRunId: args.diagnosticRunId,
        timestamp: new Date(args.nowMs).toISOString(),
    }
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: args.nowMs,
        type: 'Containment Population Drift Finding' as const,
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
 * Read-only diagnostics sweep for containment-population drift: a Room's, Feature's or Area's presence
 * binding stored in a shape cache-time population would now write differently (see
 * `classification.ts`). Emits one `Containment Population Drift Finding` per **parent** host,
 * since population is keyed on the parent; ephemera's consumer reruns it for that parent with no
 * asset diff needed. Report-only: performs no repair. A clean second run (`emittedCount: 0`) is
 * the check that every heal landed.
 */
export const containmentPopulationDriftSweep = async (
    params?: {
        diagnosticRunId?: string
        nowMs?: number
    },
    deps?: ContainmentPopulationDriftSweepDependencies
): Promise<ContainmentPopulationDriftSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('containmentPopulationDriftSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const resolvedDeps = {
        listCandidateRows: deps?.listCandidateRows ?? defaultListCandidateRows,
        emitFinding: deps?.emitFinding ?? defaultEmitFinding,
    }

    const rows = await resolvedDeps.listCandidateRows()
    const parentIds = [...new Set(rows.flatMap((row) => containmentDriftParentsOf(row.EphemeraId, row.ludicGraph)))].sort()

    for (const ephemeraId of parentIds) {
        await resolvedDeps.emitFinding({
            ephemeraId,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
    }

    return {
        emittedCount: parentIds.length,
        ephemeraIds: parentIds,
    }
}

export { containmentDriftParentsOf } from './classification'
