import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { computeDropDiff } from './computeDropDiff'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const OTHER_CHARACTER = 'CHARACTER#Beta' as EphemeraCharacterId

describe('computeDropDiff', () => {
    it('detects drop from character to room', () => {
        const { diff, roomDiff, characterDiff } = computeDropDiff({
            priorContainers: [CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [CHARACTER_ID],
            to: ROOM_ID,
            changed: true,
        })
        expect(roomDiff).toEqual({ froms: [], to: ROOM_ID, changed: true })
        expect(characterDiff).toEqual({ froms: [CHARACTER_ID], to: null, changed: true })
    })

    it('is idempotent when object is already solely in destination room', () => {
        const { diff } = computeDropDiff({
            priorContainers: [ROOM_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [],
            to: ROOM_ID,
            changed: false,
        })
    })

    it('removes from character when object is on source character and destination room (drift)', () => {
        const { diff, roomDiff, characterDiff } = computeDropDiff({
            priorContainers: [ROOM_ID, CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff.changed).toBe(true)
        expect(diff.froms).toEqual([CHARACTER_ID])
        expect(roomDiff.changed).toBe(false)
        expect(characterDiff.changed).toBe(true)
    })

    it('is unchanged when object is on another character in destination room', () => {
        const { diff, characterDiff } = computeDropDiff({
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [],
            to: ROOM_ID,
            changed: false,
        })
        expect(characterDiff.changed).toBe(false)
    })
})
