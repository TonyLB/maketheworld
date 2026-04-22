import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendRoomEphemeraStateChange } from './ephemeraStateChange'
import { socketDispatchPromise } from '../../../slices/lifeLine'

vi.mock('../../../slices/lifeLine', () => ({
    socketDispatchPromise: vi.fn(),
}))

describe('sendRoomEphemeraStateChange', () => {
    const markState = {
        markValue: [
            { mark: 'weather', value: 'rain' },
            { mark: 'light', value: 'dim' },
        ],
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('builds the expected state-change payload and targets ephemera service', async () => {
        const dispatch = vi.fn().mockResolvedValue({
            messageType: 'EphemeraCommandSuccess',
            command: 'stateChange',
            componentId: 'ROOM#abc',
            RequestId: 'request-123',
        })
        ;(socketDispatchPromise as any).mockReturnValue({ type: 'SOCKET_ACTION' })

        await sendRoomEphemeraStateChange({
            componentId: 'ROOM#abc',
            markState,
            requestId: 'request-123',
        })(dispatch)

        expect(socketDispatchPromise).toHaveBeenCalledWith(
            {
                message: 'ephemeraStateChange',
                componentId: 'ROOM#abc',
                markState,
                RequestId: 'request-123',
            },
            { service: 'ephemera' }
        )
        expect(dispatch).toHaveBeenCalledWith({ type: 'SOCKET_ACTION' })
    })

    it('returns success result for stateChange ack', async () => {
        const dispatch = vi.fn().mockResolvedValue({
            messageType: 'EphemeraCommandSuccess',
            command: 'stateChange',
            componentId: 'ROOM#abc',
        })
        ;(socketDispatchPromise as any).mockReturnValue({ type: 'SOCKET_ACTION' })

        const result = await sendRoomEphemeraStateChange({
            componentId: 'ROOM#abc',
            markState,
            requestId: 'request-123',
        })(dispatch)

        expect(result).toEqual({
            ok: true,
            message: 'Runtime room state updated.',
        })
    })

    it('maps META_ROOM_MISSING server errors to user-facing error string', async () => {
        const dispatch = vi.fn().mockRejectedValue({
            messageType: 'Error',
            message: 'State change rejected',
            error: 'META_ROOM_MISSING',
        })
        ;(socketDispatchPromise as any).mockReturnValue({ type: 'SOCKET_ACTION' })

        const result = await sendRoomEphemeraStateChange({
            componentId: 'ROOM#abc',
            markState,
            requestId: 'request-123',
        })(dispatch)

        expect(result).toEqual({
            ok: false,
            message: 'Room state is unavailable for this room (META_ROOM_MISSING).',
        })
    })

    it('falls back to a generic error message for unknown failures', async () => {
        const dispatch = vi.fn().mockRejectedValue(undefined)
        ;(socketDispatchPromise as any).mockReturnValue({ type: 'SOCKET_ACTION' })

        const result = await sendRoomEphemeraStateChange({
            componentId: 'ROOM#abc',
            markState,
            requestId: 'request-123',
        })(dispatch)

        expect(result).toEqual({
            ok: false,
            message: 'Failed to update runtime room state.',
        })
    })
})
