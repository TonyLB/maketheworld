import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { isStandardAreaData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/area'
import type { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { StreamEventDeserializedPayload } from '../slices/dataSource/streamEventPubSub'
import type { RecentEventEnvelope } from '../slices/dataSource/baseClasses'
import { INSTRUMENTATION_KEYS } from './scopedInstrumentation'

export const WML_STREAM_SYNC_INSTRUMENTATION_KEY = INSTRUMENTATION_KEYS.WML_STREAM_SYNC

const SESSION_STORAGE_KEY = 'mtw-instrumentation'
const MATERIALIZED_VIEW_DIGEST_MAX_CHARS = 500

/**
 * Enable WML stream-sync logs from the browser console (no rebuild):
 *
 *   sessionStorage.setItem('mtw-instrumentation', '["wml-stream-sync"]')
 *
 * Disable:
 *
 *   sessionStorage.removeItem('mtw-instrumentation')
 */
export const isWmlStreamSyncEnabled = (): boolean => {
    if (typeof sessionStorage === 'undefined') {
        return false
    }
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
        if (!raw) {
            return false
        }
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) && parsed.includes(WML_STREAM_SYNC_INSTRUMENTATION_KEY)
    } catch {
        return false
    }
}

export const logWmlStreamSync = (event: string, detail: Record<string, unknown>): void => {
    if (!isWmlStreamSyncEnabled()) {
        return
    }
    console.log(`[wml-stream-sync] ${event}`, detail)
}

type EnvelopeContext = {
    dataSourceKey: string
    streamKey: string
    headerType: string
    timestamp: number
    requestIds?: string[]
}

export const envelopeContext = (payload: StreamEventDeserializedPayload): EnvelopeContext => ({
    dataSourceKey: payload.dataSourceKey,
    streamKey: payload.streamKey,
    headerType: payload.header.type,
    timestamp: payload.timestamp,
    requestIds: requestIdsFromHeader(payload.header)
})

export const requestIdsFromHeader = (header: StreamingEventHeader & Record<string, unknown>): string[] | undefined => {
    const requestIds = header.RequestIds
    if (Array.isArray(requestIds) && requestIds.length > 0) {
        return requestIds
    }
    const requestId = header.RequestId
    if (typeof requestId === 'string' && requestId.length > 0) {
        return [requestId]
    }
    return undefined
}

export const replayAtFromRawUpdate = (
    update: { type?: string; [key: string]: unknown } | undefined,
    headerType: string
): number | undefined => {
    if (headerType !== 'Snapshot' || !update) {
        return undefined
    }
    const replayAt = update.replayAt
    return typeof replayAt === 'number' ? replayAt : undefined
}

export const summarizeRecentEvents = <Payload, Header extends StreamingEventHeader>(
    events: Array<RecentEventEnvelope<Payload, Header>>
): Array<{ type: string; timestamp: number; requestIds?: string[] }> =>
    events.map(({ header, timestamp }) => ({
        type: header.type,
        timestamp,
        requestIds: requestIdsFromHeader(header as Header & Record<string, unknown>)
    }))

const universalKeysFromReferenceListData = (nodes: unknown): string[] => {
    if (!Array.isArray(nodes)) {
        return []
    }
    return nodes.flatMap((entry) => {
        if (typeof entry === 'string') {
            return [entry]
        }
        if (typeof entry === 'object' && entry !== null && 'universalKey' in entry) {
            const universalKey = (entry as { universalKey?: string }).universalKey
            return typeof universalKey === 'string' ? [universalKey] : []
        }
        return []
    })
}

export const positionGraphNodesFromForm = (data: StandardFormData | undefined): string[] => {
    if (!data?.components) {
        return []
    }
    try {
        for (const component of data.components) {
            if (!isStandardAreaData(component)) {
                continue
            }
            const universalKey = component.universalKey
            if (typeof universalKey === 'string' && universalKey.startsWith('AREA#')) {
                return universalKeysFromReferenceListData(component.positionGraph?.nodes)
            }
        }
        const form = new StandardForm(data)
        for (const [key, component] of Object.entries(form.byUniversalId)) {
            if (!key.startsWith('AREA#')) {
                continue
            }
            const graphJson = (component as { positionGraph?: { toJSON?: () => { nodes?: unknown } } }).positionGraph?.toJSON?.()
            if (graphJson?.nodes !== undefined) {
                return universalKeysFromReferenceListData(graphJson.nodes)
            }
        }
    } catch {
        return []
    }
    return []
}

export type WmlProcessEnvelopePath = 'snapshot' | 'event-in-order' | 'event-reagg'

export const logWmlProcessEnvelope = <Payload, Header extends StreamingEventHeader>(params: {
    path: WmlProcessEnvelopePath
    streamKey: string
    incomingTimestamp: number
    latestCachedTimestamp: number
    eventsAfterSnapshotCount?: number
    recentEvents: Array<RecentEventEnvelope<Payload, Header>>
    materializedView: unknown
}): void => {
    if (!isWmlStreamSyncEnabled()) {
        return
    }
    const view = params.materializedView as StandardFormData | undefined
    logWmlStreamSync('processEnvelope', {
        path: params.path,
        streamKey: params.streamKey,
        incomingTimestamp: params.incomingTimestamp,
        latestCachedTimestamp: params.latestCachedTimestamp,
        ...(params.eventsAfterSnapshotCount !== undefined
            ? { eventsAfterSnapshotCount: params.eventsAfterSnapshotCount }
            : {}),
        recentEventsSummary: summarizeRecentEvents(params.recentEvents),
        positionGraphNodes: positionGraphNodesFromForm(view),
        materializedViewDigest: truncatedMaterializedViewDigest(view)
    })
}

export const truncatedMaterializedViewDigest = (data: StandardFormData | undefined): string | undefined => {
    if (!data) {
        return undefined
    }
    try {
        const wml = schemaToWML([new StandardForm(data).schema])
        if (wml.length <= MATERIALIZED_VIEW_DIGEST_MAX_CHARS) {
            return wml
        }
        return `${wml.slice(0, MATERIALIZED_VIEW_DIGEST_MAX_CHARS)}...`
    } catch {
        return undefined
    }
}
