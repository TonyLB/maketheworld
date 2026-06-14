import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildCharacterMovedFact } from './buildCharacterMovedFact'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const ANCHOR = 1_700_000_000_000

describe('buildCharacterMovedFact', () => {
    it('builds a Character Moved payload from apply result', () => {
        const fact = buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            applyResult: {
                from: FROM_ROOM,
                to: TO_ROOM,
                beatAnchorTime: ANCHOR,
            },
            characterName: 'Test',
        })

        expect(fact).toEqual({
            type: 'Character Moved',
            characterId: CHARACTER_ID,
            from: FROM_ROOM,
            to: TO_ROOM,
            beatAnchorTime: ANCHOR,
            characterName: 'Test',
        })
        expect(fact).not.toHaveProperty('legalExits')
    })

    it('omits characterName when not provided', () => {
        const fact = buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            applyResult: {
                from: null,
                to: TO_ROOM,
                beatAnchorTime: ANCHOR,
            },
        })

        expect(fact).toEqual({
            type: 'Character Moved',
            characterId: CHARACTER_ID,
            from: null,
            to: TO_ROOM,
            beatAnchorTime: ANCHOR,
        })
    })

    it('returns undefined when beatAnchorTime is missing', () => {
        expect(buildCharacterMovedFact({
            characterId: CHARACTER_ID,
            applyResult: {
                from: FROM_ROOM,
                to: TO_ROOM,
            },
        })).toBeUndefined()
    })
})
