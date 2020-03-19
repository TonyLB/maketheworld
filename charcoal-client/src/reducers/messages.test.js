import messages from './messages.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage
} from '../store/messages'


describe('Messages reducer', () => {
    it('should return an empty array by default', () => {
        expect(messages()).toEqual([])
    })

    it('should add a playermessage to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Steve Rogers',
                protocol: 'playerMessage',
                message: 'I can do this all day'
            }
        })).toEqual([new playerMessage({
            name: 'Steve Rogers',
            message: 'I can do this all day'
        })])
    })

    it('should add a worldmessage to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGE,
            payload: {
                protocol: 'worldMessage',
                message: 'The tesseract pulses ominously'
            }
        })).toEqual([new worldMessage({
            message: 'The tesseract pulses ominously'
        })])
    })

    it('should append a playermessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                name: 'Tony Stark',
                message: "I'm bringing the party to you"
            }),
            new worldMessage({
                message: "A gigantic carrier leviathan crashes through a building and turns toward you."
            }),
            new playerMessage({
                name: 'Natasha Romanov',
                message: "I don't see how that's a party"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                name: 'Bruce Banner',
                protocol: 'playerMessage',
                message: "That's my secret, Captain..."
            }
        })).toEqual([
            ...startingList,
            new playerMessage({
                name: 'Bruce Banner',
                message: "That's my secret, Captain..."
            })
        ])
    })

    it('should append a playermessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                name: 'Peter Parker',
                message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                protocol: 'worldMessage',
                message: "Peter's phone sits mockingly silent."
            }
        })).toEqual([
            ...startingList,
            new worldMessage({
                message: "Peter's phone sits mockingly silent."
            })
        ])
    })
})
