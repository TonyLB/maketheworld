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
                CharacterId: 'Steve Rogers',
                DisplayProtocol: 'Player',
                Message: 'I can do this all day'
            }
        })).toEqual([new playerMessage({
            CharacterId: 'Steve Rogers',
            Message: 'I can do this all day'
        })])
    })

    it('should add a worldmessage to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGE,
            payload: {
                DisplayProtocol: '',
                Message: 'The tesseract pulses ominously'
            }
        })).toEqual([new worldMessage({
            Message: 'The tesseract pulses ominously'
        })])
    })

    it('should append a playermessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                CharacterId: 'Tony Stark',
                Message: "I'm bringing the party to you"
            }),
            new worldMessage({
                Message: "A gigantic carrier leviathan crashes through a building and turns toward you."
            }),
            new playerMessage({
                CharacterId: 'Natasha Romanov',
                Message: "I don't see how that's a party"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                CharacterId: 'Bruce Banner',
                DisplayProtocol: 'Player',
                Message: "That's my secret, Captain..."
            }
        })).toEqual([
            ...startingList,
            new playerMessage({
                CharacterId: 'Bruce Banner',
                Message: "That's my secret, Captain..."
            })
        ])
    })

    it('should append a playermessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                name: 'Peter Parker',
                Message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                Message: "Peter's phone sits mockingly silent."
            }
        })).toEqual([
            ...startingList,
            new worldMessage({
                Message: "Peter's phone sits mockingly silent."
            })
        ])
    })
})
