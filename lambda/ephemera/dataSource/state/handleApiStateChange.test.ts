/**
 * Tests for `handleApiStateChangeCommand`. Perspective `assetStack` comes from
 * `resolveCanonAssetStackForRoom` (mocked here). Optional `cmd.assetStack` on commands is unused for merge
 * until removed from `StateChangeCommand` (see `localApiEvents.ts`).
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { handleApiStateChangeCommand } from './handleApiStateChange'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import { resolveCanonAssetStackForRoom } from './resolveAssetStackForRoom'

jest.mock('./mergePersistMetaRoomMarks', () => ({
    mergePersistMetaRoomMarks: jest.fn(),
}))

jest.mock('./resolveAssetStackForRoom', () => ({
    resolveCanonAssetStackForRoom: jest.fn(),
}))

const mergePersistMetaRoomMarksMock = mergePersistMetaRoomMarks as jest.MockedFunction<typeof mergePersistMetaRoomMarks>
const resolveCanonAssetStackForRoomMock = resolveCanonAssetStackForRoom as jest.MockedFunction<
    typeof resolveCanonAssetStackForRoom
>

describe('handleApiStateChangeCommand', () => {
    beforeEach(() => {
        mergePersistMetaRoomMarksMock.mockReset()
        mergePersistMetaRoomMarksMock.mockResolvedValue({ ok: true })
        resolveCanonAssetStackForRoomMock.mockReset()
        resolveCanonAssetStackForRoomMock.mockResolvedValue(['ASSET#resolved' as `ASSET#${string}`])
    })

    it('calls mergePersistMetaRoomMarks with perspective.assetStack from the resolver', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        resolveCanonAssetStackForRoomMock.mockResolvedValueOnce(['ASSET#a' as `ASSET#${string}`, 'ASSET#b' as `ASSET#${string}`])
        await handleApiStateChangeCommand({
            componentId: roomId,
            markState: { markValue: [{ mark: 'M', value: 'v' }] },
            assetStack: ['ASSET#ignored' as `ASSET#${string}`],
        })
        expect(resolveCanonAssetStackForRoomMock).toHaveBeenCalledWith(roomId, expect.anything())
        expect(mergePersistMetaRoomMarksMock).toHaveBeenCalledWith({
            roomId,
            incomingMarks: { markValue: [{ mark: 'M', value: 'v' }] },
            perspective: { assetStack: ['ASSET#a', 'ASSET#b'] },
        })
    })

    it('passes empty assetStack when resolver returns none', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        resolveCanonAssetStackForRoomMock.mockResolvedValueOnce([])
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
        expect(resolveCanonAssetStackForRoomMock).not.toHaveBeenCalled()
    })
})
