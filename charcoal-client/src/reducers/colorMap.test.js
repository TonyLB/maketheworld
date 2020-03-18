import colorMap from './colorMap.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'

describe('ColorMap reducer', () => {
    it('should return an empty object by default', () => {
        expect(colorMap()).toEqual({})
    })

    it('should add a new element to an empty object', () => {
        expect(colorMap({}, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                message: 'I can do this all day'
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should recognize repeated elements', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        }, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                message: 'I can do this all day'
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should add a new element to an existing map', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            },
            ['Tony Stark']: {
                primary: 'pink',
                light: 'lightpink'
            },
            ['Natasha Romanov']: {
                primary: 'purple',
                light: 'lightpurple'
            }
        }, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Bruce Banner',
                message: "That's my secret, Captain..."
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            },
            ['Tony Stark']: {
                primary: 'pink',
                light: 'lightpink'
            },
            ['Natasha Romanov']: {
                primary: 'purple',
                light: 'lightpurple'
            },
            ['Bruce Banner']: {
                primary: 'green',
                light: 'lightgreen'
            }
        })
    })
})
