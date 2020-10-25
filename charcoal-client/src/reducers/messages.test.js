import messages from './messages.js'
import { RECEIVE_MESSAGES } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage,
    roomDescription
} from '../store/messages'


describe('Messages reducer', () => {
    it('should return an empty array by default', () => {
        expect(messages()).toEqual([])
    })

    it('should add a playermessage to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGES,
            payload: [{
                DisplayProtocol: 'Player',
                CharacterMessage: {
                    Message: 'I can do this all day',
                    CharacterId: 'Steve Rogers'
                }
            }]
        })).toEqual([new playerMessage({
            CharacterId: 'Steve Rogers',
            Message: 'I can do this all day'
        })])
    })

    it('should add a worldmessage to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGES,
            payload: [{
                DisplayProtocol: '',
                MessageId: '1',
                WorldMessage: {
                    Message: 'The tesseract pulses ominously'
                }
            }]
        })).toEqual([new worldMessage({
            MessageId: '1',
            Message: 'The tesseract pulses ominously'
        })])
    })

    it('should append a playermessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                CharacterId: 'Tony Stark',
                MessageId: '1',
                Message: "I'm bringing the party to you"
            }),
            new worldMessage({
                MessageId: '2',
                Message: "A gigantic carrier leviathan crashes through a building and turns toward you."
            }),
            new playerMessage({
                MessageId: '3',
                CharacterId: 'Natasha Romanov',
                Message: "I don't see how that's a party"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGES,
            payload: [{
                DisplayProtocol: 'Player',
                MessageId: '4',
                CharacterMessage: {
                    CharacterId: 'Bruce Banner',
                    Message: "That's my secret, Captain..."
                }
            }]
        })).toEqual([
            ...startingList,
            new playerMessage({
                MessageId: '4',
                CharacterId: 'Bruce Banner',
                Message: "That's my secret, Captain..."
            })
        ])
    })

    it('should append a worldmessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                MessageId: '1',
                name: 'Peter Parker',
                Message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGES,
            payload: [{
                WorldMessage: {
                    MessageId: '2',
                    Message: "Peter's phone sits mockingly silent."
                }
            }]
        })).toEqual([
            ...startingList,
            new worldMessage({
                MessageId: '2',
                Message: "Peter's phone sits mockingly silent."
            })
        ])
    })

    it('should append a room description message to an existing array', () => {
        const startingList = [
            new playerMessage({
                MessageId: '1',
                name: 'Peter Parker',
                Message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGES,
            payload: [{
                DisplayProtocol: 'RoomDescription',
                MessageId: '2',
                RoomDescription: {
                    RoomId: '123',
                    Players: [{
                        PermanentId: 'ABC',
                        Name: 'Testy'
                    },
                    {
                        PermanentId: 'DEF',
                        Name: 'Testina'
                    }],
                    Name: 'Oubliette',
                    Description: 'A sterile holding cell'
                }
            }]
        })).toEqual([
            ...startingList,
            new roomDescription({
                MessageId: '2',
                RoomId: '123',
                Players: [{
                    PermanentId: 'ABC',
                    Name: 'Testy'
                },
                {
                    PermanentId: 'DEF',
                    Name: 'Testina'
                }],
                Name: 'Oubliette',
                Description: 'A sterile holding cell'
            })
        ])
    })

})
