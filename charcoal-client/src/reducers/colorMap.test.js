import colorMap from './colorMap.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'
import { SET_NAME } from '../actions/name.js'

describe('ColorMap reducer', () => {
    it('should return an empty object by default', () => {
        expect(colorMap()).toEqual({})
    })

    it('should add a new element to an empty object on playerMessage', () => {
        expect(colorMap({}, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                protocol: 'playerMessage',
                message: 'I can do this all day'
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'pink',
                light: 'lightpink'
            }
        })
    })

    it('should recognize repeated elements on playerMessage', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        }, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                protocol: 'playerMessage',
                message: 'I can do this all day'
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should add a new element to an existing map on playerMessage', () => {
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
                protocol: 'playerMessage',
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

    it('should add a new element to an empty object on setName', () => {
        expect(colorMap({}, {
            type: SET_NAME,
            payload: { name: 'Steve Rogers' }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should override previous mapping on setName', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'pink',
                light: 'lightpink'
            }
        }, {
            type: SET_NAME,
            payload: { name: 'Steve Rogers' }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should add a new element to an existing map on setName', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'green',
                light: 'lightgreen'
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
            type: SET_NAME,
            payload: { name: 'Bruce Banner' }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'green',
                light: 'lightgreen'
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
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should add a new element to an empty object on roomDescription', () => {
        expect(colorMap({}, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Downtown Manhattan',
                protocol: 'roomDescription',
                players: [{ name: 'Steve Rogers' }]
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'pink',
                light: 'lightpink'
            }
        })
    })

    it('should recognize repeated elements on roomDescription', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        }, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Downtown Manhattan',
                protocol: 'roomDescription',
                players: [{ name: 'Steve Rogers' }]
            }
        })).toEqual({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            }
        })
    })

    it('should add only new elements to an existing map on roomDescription', () => {
        expect(colorMap({
            ['Steve Rogers']: {
                primary: 'blue',
                light: 'lightblue'
            },
            ['Tony Stark']: {
                primary: 'pink',
                light: 'lightpink'
            },
        }, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Downtown Manhattan',
                protocol: 'roomDescription',
                players: [
                    { name: 'Steve Rogers' },
                    { name: 'Natasha Romanov' },
                    { name: 'Tony Stark' },
                    { name: 'Bruce Banner' }
                ]
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
