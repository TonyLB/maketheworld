import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import {
    DiagnosticsEventSerializer,
    DiagnosticsPresenceCoverDriftFindingEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'
import type { DBHandlerItem } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses'

import { classifyHost, presenceGraphViewOf } from './classification'
import type { PresenceCoverDriftClassification } from './classification'

type HostMetaRow = {
    EphemeraId: string
    DataCategory: string
    ludicGraph?: unknown
}

/** A host with drift the heal cannot repair: reported in the result, never emitted as a finding. */
export type PresenceCoverDriftUnrepairable = Pick<PresenceCoverDriftClassification, 'noBase' | 'findings'> & {
    ephemeraId: string
}

export type PresenceCoverDriftSweepResult = {
    emittedCount: number
    ephemeraIds: EphemeraMembershipHostId[]
    unrepairable: PresenceCoverDriftUnrepairable[]
}

export type PresenceCoverDriftSweepDependencies = {
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

// Every host kind can be a host (its graph lists members) and a member (its graph holds the
// pointer), and the comparison joins the two, so every host row is read.
const HOST_DATA_CATEGORIES = ['Meta::Room', 'Meta::Feature', 'Meta::Area', 'Meta::Object', 'Meta::Character'] as const

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
    const internalEvent: DiagnosticsPresenceCoverDriftFindingEvent = {
        type: 'Presence Cover Drift Finding',
        ephemeraId: args.ephemeraId,
        diagnosticRunId: args.diagnosticRunId,
        timestamp: new Date(args.nowMs).toISOString(),
    }
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: args.nowMs,
        type: 'Presence Cover Drift Finding' as const,
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
 * Read-only diagnostics sweep for pointer-versus-cover drift (the contract's presence cover drift self-heal): a
 * member's `fromHostPresences` govern, and the host's `cover` is a stored index of it. Joins each
 * host's row with its members' rows (`classification.ts`; the comparison is shared with the heal).
 *
 * Emits one `Presence Cover Drift Finding` per row with drift the heal can rewrite: a **host** whose covers
 * disagree with its members' pointers, or a **member** whose pointer names a host that holds the named binding
 * but lacks the member's node (an orphan; the heal re-seats it with a same-pointer `repairPresenceBinding`).
 * An orphan whose host row or named binding is absent is report-only. Everything else (an unbound, duplicated or
 * stale member binding; a host with members and no remainder) the heal cannot repair without
 * minting a binding, so it is listed under `unrepairable` and never emitted: a report-only finding
 * would keep the second run from reading `emittedCount: 0`. Performs no repair itself.
 */
export const presenceCoverDriftSweep = async (
    params?: {
        diagnosticRunId?: string
        nowMs?: number
    },
    deps?: PresenceCoverDriftSweepDependencies
): Promise<PresenceCoverDriftSweepResult> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('presenceCoverDriftSweep requires EVENT_BUS_NAME')
    }

    const nowMs = params?.nowMs ?? Date.now()
    const diagnosticRunId = params?.diagnosticRunId ?? uuidv4()
    const resolvedDeps = {
        listCandidateRows: deps?.listCandidateRows ?? defaultListCandidateRows,
        emitFinding: deps?.emitFinding ?? defaultEmitFinding,
    }

    const rows = await resolvedDeps.listCandidateRows()
    const views = new Map(rows.flatMap((row) => {
        const view = presenceGraphViewOf(row.EphemeraId, row.ludicGraph)
        return view ? [[row.EphemeraId, view] as const] : []
    }))
    const viewOf = (hostId: string) => views.get(hostId)

    const healable: EphemeraMembershipHostId[] = []
    const unrepairable: PresenceCoverDriftUnrepairable[] = []
    for (const [ephemeraId, host] of [...views].sort(([a], [b]) => a.localeCompare(b))) {
        const classification = classifyHost(host, viewOf)
        if (classification.healable && isEphemeraMembershipHostId(ephemeraId)) {
            healable.push(ephemeraId)
        }
        if (classification.noBase || classification.findings.length) {
            unrepairable.push({ ephemeraId, noBase: classification.noBase, findings: classification.findings })
        }
    }

    for (const ephemeraId of healable) {
        await resolvedDeps.emitFinding({ ephemeraId, diagnosticRunId, nowMs, eventBusName })
    }

    return {
        emittedCount: healable.length,
        ephemeraIds: healable,
        unrepairable,
    }
}

export { classifyHost, presenceGraphViewOf } from './classification'
