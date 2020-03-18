import messages from './messages.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'

describe('Messages reducer', () => {
    it('should return an empty array by default', () => {
        expect(messages()).toEqual([])
    })

    it('should add an element to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                message: 'I can do this all day'
            }
        })).toEqual([{
            name: 'Steve Rogers',
            message: 'I can do this all day'
        }])
    })

    it('should append an element to an existing array', () => {
        expect(messages([{
            name: 'Tony Stark',
            message: 'I am Iron Man'
        },
        {
            name: 'Natasha Romanov',
            message: "I don't see how that is a party"
        }], {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Bruce Banner',
                message: "That's my secret, Captain..."
            }
        })).toEqual([
            {
                name: 'Tony Stark',
                message: 'I am Iron Man'
            },
            {
                name: 'Natasha Romanov',
                message: "I don't see how that is a party"
            },
            {
                name: 'Bruce Banner',
                message: "That's my secret, Captain..."
            }
        ])
    })
})
