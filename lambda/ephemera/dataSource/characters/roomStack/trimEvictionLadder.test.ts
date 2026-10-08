import { resolveLegalRoomIdFromRoomStack } from './trimEvictionLadder'

describe('resolveLegalRoomIdFromRoomStack', () => {
    it('returns top frame of trimmed ladder', () => {
        expect(resolveLegalRoomIdFromRoomStack(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
            ],
            ['primitives', 'TownCenter']
        )).toBe('ROOM#TownSquare')
    })

    it('defaults to VORTEX when stack normalizes empty', () => {
        expect(resolveLegalRoomIdFromRoomStack(undefined, [])).toBe('ROOM#VORTEX')
    })
})
