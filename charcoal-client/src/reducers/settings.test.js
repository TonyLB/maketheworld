import settings from './settings.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const testState = {
    ChatPrompt: 'Test One'
}

describe('settings reducer', () => {
    it('should return default', () => {
        expect(settings()).toEqual({ ChatPrompt: 'What do you do?' })
    })

    it('should return unchanged settings on empty array', () => {
        expect(settings(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: []
        })).toEqual(testState)
    })

    it('should return unchanged map on other action type', () => {
        expect(settings(testState, {
            type: 'NO-OP',
            data: []
        })).toEqual(testState)
    })

    it('should update map on new passed data', () => {
        expect(settings(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Settings: {
                    ChatPrompt: 'Speak your truth'
                }
            }]
        })).toEqual({
            ChatPrompt: 'Speak your truth'
        })
    })

})
