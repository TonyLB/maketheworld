/**
 * Streaming payloads and envelope guards for the `mtw.ephemera.state` DataSource (outbound and subscriber typing).
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomState } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheMarkState } from '../../renderCache/baseClasses'

export const EPHEMERA_STATE_DATA_SOURCE_KEY = 'mtw.ephemera.state' as const

export type StateChangedPayload = {
    type: 'State Changed';
    componentId: EphemeraRoomId;
    incomingMarkState: EphemeraCacheMarkState;
    priorState: EphemeraRoomState;
    newState: EphemeraRoomState;
}

export const isStateChangedPayload = (value: unknown): value is StateChangedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'State Changed' || typeof v.componentId !== 'string') {
        return false
    }
    if (!v.incomingMarkState || typeof v.incomingMarkState !== 'object') {
        return false
    }
    if (!Array.isArray((v.incomingMarkState as { markValue?: unknown }).markValue)) {
        return false
    }
    if (!v.priorState || typeof v.priorState !== 'object') {
        return false
    }
    if (!v.newState || typeof v.newState !== 'object') {
        return false
    }
    const priorMarks = (v.priorState as { marks?: unknown }).marks
    const newMarks = (v.newState as { marks?: unknown }).marks
    if (!priorMarks || typeof priorMarks !== 'object' || !Array.isArray((priorMarks as { markValue?: unknown }).markValue)) {
        return false
    }
    if (!newMarks || typeof newMarks !== 'object' || !Array.isArray((newMarks as { markValue?: unknown }).markValue)) {
        return false
    }
    return true
}

const isEphemeraStateStateChangedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_STATE_DATA_SOURCE_KEY; type: 'State Changed' }
> = (
    h
): h is StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_STATE_DATA_SOURCE_KEY; type: 'State Changed' } =>
    h.dataSourceKey === EPHEMERA_STATE_DATA_SOURCE_KEY && h.type === 'State Changed'

export const isEphemeraStateStateChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    StateChangedPayload,
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_STATE_DATA_SOURCE_KEY; type: 'State Changed' }
>(isEphemeraStateStateChangedHeader)

export { isEphemeraStateStateChangedHeader }
