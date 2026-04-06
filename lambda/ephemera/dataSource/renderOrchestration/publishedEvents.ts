/**
 * Outgoing stream payloads for mtw.ephemera.renderOrchestration (bus-only DataSource).
 * See taskPlanning/.../AGENT.passThrough.contract.planning.md (Limited refinement, six outbounds).
 */
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isPerspective, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isEphemeraFeatureId,
    isEphemeraMapId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCacheDynamoItem,
    type EphemeraCacheDynamoItem,
} from '../../renderCache/baseClasses'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import type { RenderComponentId } from './events'

export const RENDER_ORCHESTRATION_DATA_SOURCE_KEY = 'mtw.ephemera.renderOrchestration' as const

/** Provisional strings for payload.type and StreamingEventHeader.type (uncertainty 8). */
export const RENDER_ORCHESTRATION_PUBLISHED_EVENT_TYPES = [
    'Current Cache Valid',
    'Exact Match Found',
    'Generation Started',
    'Render Generated',
    'Orchestration Error',
    'Generation Deferred',
] as const

export type RenderOrchestrationPublishedEventType =
    (typeof RENDER_ORCHESTRATION_PUBLISHED_EVENT_TYPES)[number]

/** Lean routing on orchestration outbounds (contract: componentId, perspective, perspectiveKey). */
export type RenderOrchestrationPublishedRouting = {
    componentId: RenderComponentId;
    perspective: Perspective;
    perspectiveKey: string;
}

export type RenderOrchestrationCurrentCacheValidPayload = RenderOrchestrationPublishedRouting & {
    type: 'Current Cache Valid';
    cacheId: EphemeraCacheId;
}

export type RenderOrchestrationExactMatchFoundPayload = RenderOrchestrationPublishedRouting & {
    type: 'Exact Match Found';
    cacheId: EphemeraCacheId;
}

export type RenderOrchestrationGenerationStartedPayload = RenderOrchestrationPublishedRouting & {
    type: 'Generation Started';
    /**
     * Optional hook for forward compatibility if we later distinguish sub-states under
     * Generation Started (e.g. additional phase literals). Omitted today; not required for routing.
     */
    phase?: 'generating';
}

export type RenderOrchestrationRenderGeneratedPayload = RenderOrchestrationPublishedRouting & {
    type: 'Render Generated';
    cacheId: EphemeraCacheId;
    /** Full generated content is on `cacheRecord.renderedContent` (not duplicated at payload top level). */
    cacheRecord: EphemeraCacheDynamoItem;
}

export type RenderOrchestrationOrchestrationErrorPayload = RenderOrchestrationPublishedRouting & {
    type: 'Orchestration Error';
    errorCode: string;
    errorMessage: string;
}

export type RenderOrchestrationGenerationDeferredPayload = RenderOrchestrationPublishedRouting & {
    type: 'Generation Deferred';
    reason: string;
    policy?: string;
}

export type RenderOrchestrationPublishedPayload =
    | RenderOrchestrationCurrentCacheValidPayload
    | RenderOrchestrationExactMatchFoundPayload
    | RenderOrchestrationGenerationStartedPayload
    | RenderOrchestrationRenderGeneratedPayload
    | RenderOrchestrationOrchestrationErrorPayload
    | RenderOrchestrationGenerationDeferredPayload

const isRenderComponentId = (value: unknown): value is RenderComponentId => (
    typeof value === 'string' && (isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraMapId(value))
)

const isEphemeraCacheIdString = (value: unknown): value is EphemeraCacheId => (
    typeof value === 'string' && value.startsWith('CACHE#')
)

const hasValidRouting = (v: Record<string, unknown>): boolean => (
    isRenderComponentId(v.componentId)
    && isPerspective(v.perspective)
    && typeof v.perspectiveKey === 'string'
)

export const isRenderOrchestrationCurrentCacheValidPayload = (
    value: unknown
): value is RenderOrchestrationCurrentCacheValidPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Current Cache Valid'
        && hasValidRouting(v)
        && isEphemeraCacheIdString(v.cacheId)
    )
}

export const isRenderOrchestrationExactMatchFoundPayload = (
    value: unknown
): value is RenderOrchestrationExactMatchFoundPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Exact Match Found'
        && hasValidRouting(v)
        && isEphemeraCacheIdString(v.cacheId)
    )
}

export const isRenderOrchestrationGenerationStartedPayload = (
    value: unknown
): value is RenderOrchestrationGenerationStartedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Generation Started' || !hasValidRouting(v)) {
        return false
    }
    if (v.phase !== undefined && v.phase !== 'generating') {
        return false
    }
    return true
}

export const isRenderOrchestrationRenderGeneratedPayload = (
    value: unknown
): value is RenderOrchestrationRenderGeneratedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Render Generated' || !hasValidRouting(v) || !isEphemeraCacheIdString(v.cacheId)) {
        return false
    }
    if (!isEphemeraCacheDynamoItem(v.cacheRecord)) {
        return false
    }
    if (v.cacheRecord.DataCategory !== v.cacheId) {
        return false
    }
    return true
}

export const isRenderOrchestrationOrchestrationErrorPayload = (
    value: unknown
): value is RenderOrchestrationOrchestrationErrorPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Orchestration Error'
        && hasValidRouting(v)
        && typeof v.errorCode === 'string'
        && typeof v.errorMessage === 'string'
    )
}

export const isRenderOrchestrationGenerationDeferredPayload = (
    value: unknown
): value is RenderOrchestrationGenerationDeferredPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Generation Deferred' || !hasValidRouting(v) || typeof v.reason !== 'string') {
        return false
    }
    if (v.policy !== undefined && typeof v.policy !== 'string') {
        return false
    }
    return true
}

export const isRenderOrchestrationPublishedPayload = (
    value: unknown
): value is RenderOrchestrationPublishedPayload => (
    isRenderOrchestrationCurrentCacheValidPayload(value)
    || isRenderOrchestrationExactMatchFoundPayload(value)
    || isRenderOrchestrationGenerationStartedPayload(value)
    || isRenderOrchestrationRenderGeneratedPayload(value)
    || isRenderOrchestrationOrchestrationErrorPayload(value)
    || isRenderOrchestrationGenerationDeferredPayload(value)
)

type Bus = { send: (payload: StreamingEventMessage) => void }

const orchestrationPublishSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

/**
 * Publish a render-orchestration outbound on the process message bus (same envelope shape as other DataSource stream events).
 */
export function sendRenderOrchestrationPublish(bus: Bus, streamKey: string, content: RenderOrchestrationPublishedPayload): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: content.type,
    }
    const envelope = createInternalOriginEnvelope(header, content, orchestrationPublishSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}
