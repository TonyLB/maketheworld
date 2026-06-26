import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { computeTakeHoldDiff } from './computeTakeHoldDiff'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const OTHER_CHARACTER = 'CHARACTER#Beta' as EphemeraCharacterId

describe('computeTakeHoldDiff', () => {
    it('detects pick-up from room to character', () => {
        const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [ROOM_ID],
            to: CHARACTER_ID,
            changed: true,
        })
        expect(roomDiff).toEqual({ froms: [ROOM_ID], to: null, changed: true })
        expect(characterDiff).toEqual({ froms: [], to: CHARACTER_ID, changed: true })
    })

    it('is idempotent when object is already solely on target character', () => {
        const { diff } = computeTakeHoldDiff({
            priorContainers: [CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [],
            to: CHARACTER_ID,
            changed: false,
        })
    })

    it('removes from room when object is on target character and source room (drift)', () => {
        const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff.changed).toBe(true)
        expect(diff.froms).toEqual([ROOM_ID])
        expect(roomDiff.changed).toBe(true)
        expect(characterDiff.changed).toBe(false)
    })

    it('moves object between character hosts when also in source room', () => {
        const { characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(characterDiff).toEqual({
            froms: [OTHER_CHARACTER],
            to: CHARACTER_ID,
            changed: true,
        })
    })
})
