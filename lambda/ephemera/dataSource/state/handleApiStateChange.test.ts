/**
 * Tests for `handleApiStateChangeCommand`. Optional `assetStack` on commands exercises TEMPORARY State Change
 * plumbing (see `StateChangeCommand` in `localApiEvents.ts`); prefer removing those cases once defaults use a
 * canonical resolver.
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

    it('calls mergePersistMetaRoomMarks for room ids with optional assetStack (TEMPORARY field)', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiStateChangeCommand({
            componentId: roomId,
            markState: { markValue: [{ mark: 'M', value: 'v' }] },
            assetStack: ['ASSET#a' as `ASSET#${string}`],
        })
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [{ mark: 'M', value: 'v' }] },
            perspective: { assetStack: ['ASSET#a'] },
        })
    })

    it('uses empty assetStack when omitted (TEMPORARY field)', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiStateChangeCommand({
            componentId: roomId,
            markState: { markValue: [] },
        })
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [] },
            perspective: { assetStack: [] },
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
