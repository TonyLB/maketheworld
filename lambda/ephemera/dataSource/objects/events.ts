/**
 * Streaming payloads and envelope guards for the `mtw.ephemera.objects` DataSource (outbound).
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isEphemeraObjectId, type EphemeraObjectId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export const EPHEMERA_OBJECTS_DATA_SOURCE_KEY = 'mtw.ephemera.objects' as const

export type ObjectsChangedPayload = {
    type: 'Objects Changed';
    componentId: EphemeraRoomId;
    add: EphemeraMetaRoomObject[];
    remove: EphemeraObjectId[];
    priorObjects: EphemeraMetaRoomObject[];
    newObjects: EphemeraMetaRoomObject[];
}

export const isObjectsChangedPayload = (value: unknown): value is ObjectsChangedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Objects Changed' || typeof v.componentId !== 'string') {
        return false
    }
    if (!Array.isArray(v.add) || !v.add.every((x) => isEphemeraMetaRoomObject(x))) {
        return false
    }
    if (!Array.isArray(v.remove) || !v.remove.every((x) => typeof x === 'string' && isEphemeraObjectId(x))) {
        return false
    }
    if (!Array.isArray(v.priorObjects) || !v.priorObjects.every((x) => isEphemeraMetaRoomObject(x))) {
        return false
    }
    if (!Array.isArray(v.newObjects) || !v.newObjects.every((x) => isEphemeraMetaRoomObject(x))) {
        return false
    }
    return true
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
