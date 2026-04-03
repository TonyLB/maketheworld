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
    beforeEach(() => {
        mergePersistMetaRoomMarksMock.mockReset()
        mergePersistMetaRoomMarksMock.mockResolvedValue({ ok: true })
    })

    it('calls mergePersistMetaRoomMarks with roomId and incomingMarks', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiStateChangeCommand({
            componentId: roomId,
            markState: { markValue: [{ mark: 'M', value: 'v' }] },
        })
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [{ mark: 'M', value: 'v' }] },
        })
    })

    it('calls mergePersistMetaRoomMarks with empty markState', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiStateChangeCommand({
            componentId: roomId,
            markState: { markValue: [] },
        })
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [] },
        })
    })

    it('does not persist for non-room component ids', async () => {
        await handleApiStateChangeCommand({
            componentId: 'FEATURE#f1',
            markState: { markValue: [{ mark: 'M', value: 'v' }] },
        })
        expect(mergePersistMetaRoomMarksMock).not.toHaveBeenCalled()
    })
})
