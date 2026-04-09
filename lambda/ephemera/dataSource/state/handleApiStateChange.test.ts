/**
 * Tests for `handleApiStateChangeCommand`. Default marks are resolved inside `computeDefaultMarksForRoom` when
 * needed.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { handleApiStateChangeCommand } from './handleApiStateChange'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import messageBus from '../../messageBus'

jest.mock('./mergePersistMetaRoomMarks', () => ({
    mergePersistMetaRoomMarks: jest.fn(),
}))

jest.mock('../../messageBus', () => ({
    __esModule: true,
    default: {
        send: jest.fn(),
    },
}))

const mergePersistMetaRoomMarksMock = mergePersistMetaRoomMarks as jest.MockedFunction<typeof mergePersistMetaRoomMarks>
const messageBusSendMock = messageBus.send as jest.MockedFunction<typeof messageBus.send>

describe('handleApiStateChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomMarksMock.mockReset()
        mergePersistMetaRoomMarksMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
        messageBusSendMock.mockClear()
    })

    it('calls mergePersistMetaRoomMarks with roomId and incomingMarks', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [{ mark: 'M', value: 'v' }] },
        })
    })

    it('calls mergePersistMetaRoomMarks with empty markState', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [] },
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [] },
        })
    })

    it('does not persist for non-room component ids', async () => {
        await handleApiStateChangeCommand(
            {
                componentId: 'FEATURE#f1',
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomMarksMock).not.toHaveBeenCalled()
        expect(messageBusSendMock).not.toHaveBeenCalled()
    })

    it('sends Error ReturnValue for non-room id when requestId is set', async () => {
        await handleApiStateChangeCommand(
            {
                componentId: 'FEATURE#f1',
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
                requestId: 'rid-1',
            },
            { streamEvent }
        )
        expect(messageBusSendMock).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: 'rid-1',
                message: 'STATE_CHANGE_INVALID_COMPONENT: componentId must be a room id',
            },
        })
    })

    it('sends EphemeraCommandSuccess when requestId is set and merge did not persist', async () => {
        const roomId = 'ROOM#r4' as EphemeraRoomId
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [] },
                requestId: 'rid-2',
            },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBusSendMock).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'EphemeraCommandSuccess',
                RequestId: 'rid-2',
                command: 'stateChange',
                componentId: roomId,
            },
        })
    })

    it('streams State Changed when merge persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        const priorState = { marks: { markValue: [] as { mark: string; value: string }[] } }
        const newState = { marks: { markValue: [{ mark: 'M', value: 'v' }] } }
        mergePersistMetaRoomMarksMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorState,
            newState,
        })
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
            },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'State Changed' },
            update: {
                type: 'State Changed',
                componentId: roomId,
                incomingMarkState: { markValue: [{ mark: 'M', value: 'v' }] },
                priorState,
                newState,
            },
        })
        expect(messageBusSendMock).not.toHaveBeenCalled()
    })

    it('sends EphemeraCommandSuccess when requestId is set and merge persisted', async () => {
        const roomId = 'ROOM#r3b' as EphemeraRoomId
        const priorState = { marks: { markValue: [] as { mark: string; value: string }[] } }
        const newState = { marks: { markValue: [{ mark: 'M', value: 'v' }] } }
        mergePersistMetaRoomMarksMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorState,
            newState,
        })
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
                requestId: 'rid-3',
            },
            { streamEvent }
        )
        expect(messageBusSendMock).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'EphemeraCommandSuccess',
                RequestId: 'rid-3',
                command: 'stateChange',
                componentId: roomId,
            },
        })
    })

    it('sends Error ReturnValue when merge fails and requestId is set', async () => {
        mergePersistMetaRoomMarksMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'no row',
        })
        const roomId = 'ROOM#fail' as EphemeraRoomId
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [{ mark: 'M', value: 'v' }] },
                requestId: 'rid-err',
            },
            { streamEvent }
        )
        expect(messageBusSendMock).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: 'rid-err',
                message: 'STATE_CHANGE_FAILED: no row',
            },
        })
    })

    it('does not stream when merge did not persist', async () => {
        const roomId = 'ROOM#r4' as EphemeraRoomId
        await handleApiStateChangeCommand(
            {
                componentId: roomId,
                markState: { markValue: [] },
            },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })
})
