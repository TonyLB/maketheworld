import characters from './characters.js'
import { RECEIVE_CHARACTER_CHANGES } from '../actions/characters.js'

const testState = {
    TEST: {
        CharacterId: 'TEST',
        Name: 'Testy'
    }
}

describe('Characters reducer', () => {
    it('should return an empty map by default', () => {
        expect(characters()).toEqual({})
    })

    it('should return unchanged on a different action type', () => {
        expect(characters(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on an empty array', () => {
        expect(characters(testState, { type: RECEIVE_CHARACTER_CHANGES, characterChanges: [] })).toEqual(testState)
    })

    it('should add a new character', () => {
        expect(characters(testState, {
            type: RECEIVE_CHARACTER_CHANGES,
            characterChanges: [{
                CharacterId: 'STEVE',
                Name: 'Steve Rogers'
            }]
        })).toEqual({
            TEST: {
                CharacterId: 'TEST',
                Name: 'Testy',
            },
            STEVE: {
                CharacterId: 'STEVE',
                Name: 'Steve Rogers'
            }
        })
    })

    it('should update an existing character', () => {
        expect(characters(testState, {
            type: RECEIVE_CHARACTER_CHANGES,
            characterChanges: [{
                CharacterId: 'TEST',
                Name: 'Testina'
            }]
        })).toEqual({
            TEST: {
                CharacterId: 'TEST',
                Name: 'Testina'
            }
        })
    })

})
