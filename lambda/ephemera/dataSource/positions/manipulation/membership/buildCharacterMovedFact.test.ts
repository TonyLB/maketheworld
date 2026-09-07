import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildCharacterMovedFact } from './buildCharacterMovedFact'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

describe('buildCharacterMovedFact', () => {
    it('builds a Character Moved payload from membership diff', () => {
        const fact = buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            diff: {
                froms: [FROM_ROOM],
                to: TO_ROOM,
                changed: true,
            },
            beatAnchorTime: ANCHOR,
            characterName: 'Test',
        })

        expect(fact).toEqual({
            type: 'Character Moved',
            characterId: CHARACTER_ID,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            beatAnchorTime: ANCHOR,
            characterName: 'Test',
        })
        expect(fact).not.toHaveProperty('legalExits')
    })

    it('maps empty froms for arrive-only diff', () => {
        const fact = buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            diff: {
                froms: [],
                to: TO_ROOM,
                changed: true,
            },
            beatAnchorTime: ANCHOR,
        })

        expect(fact).toEqual({
            type: 'Character Moved',
            characterId: CHARACTER_ID,
            froms: [],
            to: TO_ROOM,
            beatAnchorTime: ANCHOR,
        })
    })

    it('returns undefined when diff.changed is false', () => {
        expect(buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            diff: {
                froms: [],
                to: FROM_ROOM,
                changed: false,
            },
            beatAnchorTime: ANCHOR,
        })).toBeUndefined()
    })

    it('emits multi-from on drift scrub diff', () => {
        const fact = buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            diff: {
                froms: [FROM_ROOM, ROOM_C],
                to: TO_ROOM,
                changed: true,
            },
            beatAnchorTime: ANCHOR,
        })

        expect(fact?.froms).toEqual([FROM_ROOM, ROOM_C])
    })
})
