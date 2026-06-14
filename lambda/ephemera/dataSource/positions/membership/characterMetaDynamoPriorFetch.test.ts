import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    characterMetaDynamoPriorFetch,
    dynamoRoomIdFromCachedEndpoint,
} from './characterMetaDynamoPriorFetch'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const ROOM = 'ROOM#VORTEX' as EphemeraRoomId

describe('characterMetaDynamoPriorFetch', () => {
    it('maps cached EphemeraRoomId to short Dynamo RoomId', () => {
        expect(dynamoRoomIdFromCachedEndpoint(ROOM)).toBe('VORTEX')
    })

    it('builds priorFetch with short RoomId and unchanged RoomStack', () => {
        expect(characterMetaDynamoPriorFetch({
            RoomId: ROOM,
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
            ],
        })).toEqual({
            RoomId: 'VORTEX',
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
            ],
        })
    })

    it('does not embed cache-only character fields in priorFetch', () => {
        const priorFetch = characterMetaDynamoPriorFetch({
            RoomId: ROOM,
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
        })
        expect(priorFetch).not.toHaveProperty('EphemeraId')
        expect(priorFetch).not.toHaveProperty('Name')
        expect(priorFetch).not.toEqual(expect.objectContaining({ RoomId: ROOM }))
    })
})
