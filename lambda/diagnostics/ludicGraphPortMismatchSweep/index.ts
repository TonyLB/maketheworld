import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import {
    DiagnosticsEventSerializer,
    DiagnosticsLudicGraphPortMismatchFindingEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isEphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'

// The comparison itself is shared with the ephemera-side self-heal, so it lives in the package
// rather than here (see `classifyLudicGraphPortMismatch.ts`'s own note).
import { classifyLudicGraphPortMismatch } from '@tonylb/mtw-gateways/ts/ephemera/positions'

type HostMetaRow = {
    EphemeraId: string
    DataCategory: string
    ludicGraph?: unknown
}

export type LudicGraphPortMismatchSubject = {
    ephemeraId: EphemeraMembershipHostId
    portId: string
}

export type LudicGraphPortMismatchSweepResult = {
    emittedCount: number
    ports: LudicGraphPortMismatchSubject[]
}

export type LudicGraphPortMismatchSweepDependencies = {
    listCandidateRows?: () => Promise<HostMetaRow[]>
    emitFinding?: (args: {
        ephemeraId: EphemeraMembershipHostId
        portId: string
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

// The five host kinds `EphemeraMembershipHostId` admits --- every `Meta::*` row that can carry a
// `ludicGraph`, and so both every graph that can hold a port and every graph that can refer to one.
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
    portId: string
    diagnosticRunId: string
    nowMs: number
    eventBusName: string
}): Promise<void> => {
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const internalEvent: DiagnosticsLudicGraphPortMismatchFindingEvent = {
        type: 'Ludic Graph Port Mismatch Finding',
        ephemeraId: args.ephemeraId,
        portId: args.portId,
        diagnosticRunId: args.diagnosticRunId,
        timestamp: new Date(args.nowMs).toISOString(),
    }
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: args.nowMs,
        type: 'Ludic Graph Port Mismatch Finding' as const,
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
 * Read-only diagnostics sweep for `ludicGraph` port mismatch (LP6a, LD-18). A port denormalizes
 * two exterior facts --- the referring edge's `kind` and its `Custom` label --- and nothing yet
 * keeps those copies honest across a shard boundary. This sweep compares each port against the
 * edge held by the host the port itself **names**, and reports one finding per disagreeing port.
 *
 * **Separate from [`ludicGraphStaleStructureSweep`](../ludicGraphStaleStructureSweep/) on
 * purpose.** That sweep's honesty comes from being a single-row caller of the shipped shape
 * guard --- one row in, verdict out. A mismatch cannot be judged from one row, so folding it in
 * would give that sweep the second definition of staleness its design deliberately refuses.
 *
 * Report-only: repair is `ephemera`'s, via the self-heal this finding triggers
 * (`healLudicGraphPortMismatch`).
 */
export const ludicGraphPortMismatchSweep = async (
    params?: {
        diagnosticRunId?: string
        nowMs?: number
    },
    deps?: LudicGraphPortMismatchSweepDependencies
): Promise<LudicGraphPortMismatchSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('ludicGraphPortMismatchSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const resolvedDeps = {
        listCandidateRows: deps?.listCandidateRows ?? defaultListCandidateRows,
        emitFinding: deps?.emitFinding ?? defaultEmitFinding,
    }

    const rows = await resolvedDeps.listCandidateRows()
    // One scan supplies both sides of every comparison: a port names its referrer, and the
    // referrer is itself one of the rows already read. No per-port fetch, and no reverse index.
    const ludicGraphByHostId = new Map<string, unknown>(rows.map((row) => [row.EphemeraId, row.ludicGraph]))

    const mismatches: LudicGraphPortMismatchSubject[] = []
    for (const row of rows) {
        if (!isEphemeraMembershipHostId(row.EphemeraId)) {
            continue
        }
        if (!isEphemeraLudicGraphFieldPayload(row.ludicGraph)) {
            continue
        }
        for (const port of row.ludicGraph.ports) {
            const verdict = classifyLudicGraphPortMismatch({
                hostId: row.EphemeraId,
                port,
                referrerLudicGraph: ludicGraphByHostId.get(port.fromHostId),
            })
            if (verdict.mismatch) {
                mismatches.push({ ephemeraId: row.EphemeraId, portId: port.portId })
            }
        }
    }
    mismatches.sort((a, b) => (
        a.ephemeraId === b.ephemeraId ? a.portId.localeCompare(b.portId) : a.ephemeraId.localeCompare(b.ephemeraId)
    ))

    for (const { ephemeraId, portId } of mismatches) {
        await resolvedDeps.emitFinding({
            ephemeraId,
            portId,
            diagnosticRunId,
            nowMs,
            eventBusName,
        })
    }

    return {
        emittedCount: mismatches.length,
        ports: mismatches,
    }
}
