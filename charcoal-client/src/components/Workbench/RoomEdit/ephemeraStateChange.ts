import { v4 as uuidv4 } from 'uuid'
import {
    EphemeraApiStateChangeRequest,
    isEphemeraClientMessageEphemeraCommandSuccess,
    isEphemeraClientMessageError,
} from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCacheMarkState } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { socketDispatchPromise } from '../../../slices/lifeLine'

type RoomStateAffordanceResult = {
    ok: boolean
    message: string
}

type SendRoomStateAffordanceArgs = {
    componentId: string
    markState: EphemeraCacheMarkState
    requestId?: string
}

const successMessage = 'Runtime room state updated.'
const fallbackErrorMessage = 'Failed to update runtime room state.'

const errorMessageFromUnknown = (error: unknown): string => {
    if (!error || typeof error !== 'object') {
        return fallbackErrorMessage
    }
    if (isEphemeraClientMessageError(error)) {
        const candidate = error.error ?? error.message
        if (candidate.includes('META_ROOM_MISSING')) {
            return 'Room state is unavailable for this room (META_ROOM_MISSING).'
        }
        return candidate || fallbackErrorMessage
    }
    const record = error as Record<string, unknown>
    if (typeof record.error === 'string' && record.error.length > 0) {
        if (record.error.includes('META_ROOM_MISSING')) {
            return 'Room state is unavailable for this room (META_ROOM_MISSING).'
        }
        return record.error
    }
    if (typeof record.message === 'string' && record.message.length > 0) {
        if (record.message.includes('META_ROOM_MISSING')) {
            return 'Room state is unavailable for this room (META_ROOM_MISSING).'
        }
        return record.message
    }
    return fallbackErrorMessage
}

export const sendRoomEphemeraStateChange = ({ componentId, markState, requestId }: SendRoomStateAffordanceArgs) =>
    async (dispatch: any): Promise<RoomStateAffordanceResult> => {
        const RequestId = requestId ?? uuidv4()
        const payload: EphemeraApiStateChangeRequest & { RequestId: string } = {
            message: 'ephemeraStateChange',
            componentId,
            markState,
            RequestId,
        }
        // Future enhancement: subscribe Room Edit to mtw.ephemera.state for read-back after ack.
        // That subscribe path depends on publishing mtw.ephemera.state to EventBridge first.
        try {
            const response = await dispatch(socketDispatchPromise(payload, { service: 'ephemera' }) as any)
            if (isEphemeraClientMessageEphemeraCommandSuccess(response) && response.command === 'stateChange') {
                return { ok: true, message: successMessage }
            }
            if (isEphemeraClientMessageError(response)) {
                return { ok: false, message: errorMessageFromUnknown(response) }
            }
            return { ok: false, message: fallbackErrorMessage }
        } catch (error) {
            return { ok: false, message: errorMessageFromUnknown(error) }
        }
    }

export type {
    RoomStateAffordanceResult,
    SendRoomStateAffordanceArgs,
}
