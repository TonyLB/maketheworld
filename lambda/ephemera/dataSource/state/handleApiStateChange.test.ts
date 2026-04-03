/**
 * Tests for `handleApiStateChangeCommand`. Default marks are resolved inside `computeDefaultMarksForRoom` when
 * needed.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { handleApiStateChangeCommand } from './handleApiStateChange'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'

jest.mock('./mergePersistMetaRoomMarks', () => ({
    mergePersistMetaRoomMarks: jest.fn(),
}))

const mergePersistMetaRoomMarksMock = mergePersistMetaRoomMarks as jest.MockedFunction<typeof mergePersistMetaRoomMarks>

describe('handleApiStateChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomMarksMock.mockReset()
        mergePersistMetaRoomMarksMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
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
