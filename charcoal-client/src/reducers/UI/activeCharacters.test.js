import activeCharacters from './activeCharacters.js'
import {
    ACTIVATE_CHARACTER,
    DEACTIVATE_CHARACTER,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED
} from '../../actions/UI/activeCharacters'

const testState = {
    TESS: {
        CharacterId: 'TESS',
        status: ACTIVE_CHARACTER_FSM_SUBSCRIBED
    }
}

describe('ActiveCharacters reducer', () => {
    it('should return an empty map by default', () => {
        expect(activeCharacters()).toEqual({})
    })

    it('should return unchanged on a different action type', () => {
        expect(activeCharacters(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on activating an already active character', () => {
        expect(activeCharacters(testState, { type: ACTIVATE_CHARACTER, CharacterId: 'TESS' })).toEqual(testState)
    })

    it('should add an activated character on activate', () => {
        expect(activeCharacters(testState, { type: ACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual({
            ...testState,
            MARCO: {
                CharacterId: 'MARCO',
                status: ACTIVE_CHARACTER_FSM_INITIAL
            }
        })
    })

    it('should remove an activated character on deactivate', () => {
        expect(activeCharacters({
            ...testState,
            MARCO: {
                CharacterId: 'MARCO',
                status: ACTIVE_CHARACTER_FSM_SUBSCRIBED
            }
        }, { type: DEACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual(testState)
    })

    it('should return unchanged on deactivating a character that is not activated', () => {
        expect(activeCharacters(testState, { type: DEACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual(testState)
    })
})
