/**
 * Outgoing stream payloads for mtw.ephemera.affordanceCache (bus-only DataSource).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isPerspective, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ProjectedRoomTopology } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology/result'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import type { AffordanceCacheRow } from './baseClasses'

export const AFFORDANCE_CACHE_DATA_SOURCE_KEY = 'mtw.ephemera.affordanceCache' as const

export const AFFORDANCE_CACHE_PUBLISHED_EVENT_TYPES = [
    'Affordances Pertain',
    'Cache Error',
] as const

export type AffordanceCachePublishedEventType = (typeof AFFORDANCE_CACHE_PUBLISHED_EVENT_TYPES)[number]

export type AffordancesPertainPayload = {
    type: 'Affordances Pertain';
    roomId: EphemeraRoomId;
    perspective: Perspective;
    perspectiveKey: string;
    affordanceRow: AffordanceCacheRow;
    topology: ProjectedRoomTopology;
}

export type AffordanceCacheErrorPayload = {
    type: 'Cache Error';
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    errorCode: string;
    errorMessage: string;
}

export type AffordanceCacheUpdatePayload = AffordancesPertainPayload | AffordanceCacheErrorPayload

const hasValidAffordancesPertainRouting = (v: Record<string, unknown>): boolean => (
    typeof v.roomId === 'string'
    && isEphemeraRoomId(v.roomId)
    && isPerspective(v.perspective)
    && typeof v.perspectiveKey === 'string'
)

export const isAffordancesPertainPayload = (value: unknown): value is AffordancesPertainPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.type === 'Affordances Pertain' && hasValidAffordancesPertainRouting(v)
}

export const isAffordanceCacheUpdatePayload = (value: unknown): value is AffordanceCacheUpdatePayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type === 'Affordances Pertain') {
        return isAffordancesPertainPayload(value)
    }
    if (v.type === 'Cache Error') {
        return (
            typeof v.roomId === 'string'
            && isEphemeraRoomId(v.roomId)
            && typeof v.perspectiveKey === 'string'
            && typeof v.errorCode === 'string'
            && typeof v.errorMessage === 'string'
        )
    }
    return false
}

export const isAffordanceCachePublishedStreamEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AffordanceCacheUpdatePayload> => (
    envelope.header.dataSourceKey === AFFORDANCE_CACHE_DATA_SOURCE_KEY
    && (AFFORDANCE_CACHE_PUBLISHED_EVENT_TYPES as readonly string[]).includes(envelope.header.type)
)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

const affordanceCachePublishSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

export function sendAffordanceCachePublish(
    bus: Bus,
    streamKey: string,
    content: AffordanceCacheUpdatePayload,
    laneId?: string,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: content.type,
    }
    const envelope = createInternalOriginEnvelope(header, content, affordanceCachePublishSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    if (laneId !== undefined && laneId !== '') {
        bus.send(message, laneId)
    } else {
        bus.send(message)
    }
}

export type PublishAffordanceCacheStreamOptions = {
    laneId?: string;
}

export async function publishAffordanceCacheStreamEvent(
    streamEvent: StreamEventFunction<AffordanceCacheUpdatePayload>,
    streamKey: string,
    content: AffordanceCacheUpdatePayload,
    options?: PublishAffordanceCacheStreamOptions,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey,
        header: { type: content.type },
        ...(options?.laneId !== undefined ? { laneId: options.laneId } : {}),
    })
}
