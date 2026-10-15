import { onCharacterComponentUpdated } from './characterComponentUpdated'

const ALPHA = 'CHARACTER#Alpha' as const
const R1 = 'ROOM#R1' as const
const R2 = 'ROOM#R2' as const

describe('onCharacterComponentUpdated', () => {
    const setup = (roomIds: any[]) => {
        const calls: string[] = []
        const deps = {
            messageBus: { publish: jest.fn((message: any) => { calls.push(`publish:${message.type}:${message.roomId}`) }) },
            invalidateCharacterMeta: jest.fn((id: string) => { calls.push(`meta:${id}`) }),
            getRoomIds: jest.fn().mockResolvedValue(roomIds),
            invalidateRoomMemos: jest.fn((id: string) => { calls.push(`memos:${id}`) }),
        }
        return { calls, deps }
    }

    it('publishes one RoomUpdate per room, after invalidating CharacterMeta and the room memos', async () => {
        const { calls, deps } = setup([R1, R2])
        await onCharacterComponentUpdated(ALPHA, deps)
        expect(calls).toEqual([
            `meta:${ALPHA}`, `memos:${R1}`, `memos:${R2}`,
            `publish:RoomUpdate:${R1}`, `publish:RoomUpdate:${R2}`,
        ])
        expect(deps.messageBus.publish.mock.calls.every(([{ type }]) => type === 'RoomUpdate')).toBe(true)
    })

    it('publishes nothing for a character in no room (CharacterMeta is still invalidated)', async () => {
        const { calls, deps } = setup([])
        await onCharacterComponentUpdated(ALPHA, deps)
        expect(calls).toEqual([`meta:${ALPHA}`])
        expect(deps.messageBus.publish).not.toHaveBeenCalled()
    })
})
