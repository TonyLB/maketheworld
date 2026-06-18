/**
 * Streaming payloads and envelope guards for the `mtw.ephemera.objects` DataSource (outbound).
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const EPHEMERA_OBJECTS_DATA_SOURCE_KEY = 'mtw.ephemera.objects' as const

/** I4 existence fact: which OBJECT# ids were created or destroyed (not room-list snapshots). */
export type ObjectsChangedPayload = {
    type: 'Objects Changed';
    createdIds: EphemeraObjectId[];
    destroyedIds: EphemeraObjectId[];
}

export const isObjectsChangedPayload = (value: unknown): value is ObjectsChangedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Objects Changed') {
        return false
    }
    if (!Array.isArray(v.createdIds) || !v.createdIds.every((x) => typeof x === 'string' && isEphemeraObjectId(x))) {
        return false
    }
    if (!Array.isArray(v.destroyedIds) || !v.destroyedIds.every((x) => typeof x === 'string' && isEphemeraObjectId(x))) {
        return false
    }
    return true
}

export const streamObjectsChangedFact = async (
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
        streamKey: string;
        createdIds: EphemeraObjectId[];
        destroyedIds: EphemeraObjectId[];
    }
): Promise<void> => {
    if (deps.createdIds.length === 0 && deps.destroyedIds.length === 0) {
        return
    }
    await deps.streamEvent({
        streamKey: deps.streamKey,
        header: { type: 'Objects Changed' },
        update: {
            type: 'Objects Changed',
            createdIds: deps.createdIds,
            destroyedIds: deps.destroyedIds,
        },
    })
}

const isEphemeraObjectsObjectsChangedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_OBJECTS_DATA_SOURCE_KEY; type: 'Objects Changed' }
> = (
    h
): h is StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_OBJECTS_DATA_SOURCE_KEY; type: 'Objects Changed' } =>
    h.dataSourceKey === EPHEMERA_OBJECTS_DATA_SOURCE_KEY && h.type === 'Objects Changed'

export const isEphemeraObjectsObjectsChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectsChangedPayload,
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_OBJECTS_DATA_SOURCE_KEY; type: 'Objects Changed' }
>(isEphemeraObjectsObjectsChangedHeader)

export { isEphemeraObjectsObjectsChangedHeader }
