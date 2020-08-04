import messages from './messages.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'
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
            type: RECEIVE_MESSAGE,
            payload: {
                DisplayProtocol: 'Player',
                CharacterMessage: {
                    Message: 'I can do this all day',
                    CharacterId: 'Steve Rogers'
                }
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
                WorldMessage: {
                    Message: 'The tesseract pulses ominously'
                }
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
                DisplayProtocol: 'Player',
                CharacterMessage: {
                    CharacterId: 'Bruce Banner',
                    Message: "That's my secret, Captain..."
                }
            }
        })).toEqual([
            ...startingList,
            new playerMessage({
                CharacterId: 'Bruce Banner',
                Message: "That's my secret, Captain..."
            })
        ])
    })

    it('should append a worldmessage to an existing array', () => {
        const startingList = [
            new playerMessage({
                name: 'Peter Parker',
                Message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                WorldMessage: {
                    Message: "Peter's phone sits mockingly silent."
                }
            }
        })).toEqual([
            ...startingList,
            new worldMessage({
                Message: "Peter's phone sits mockingly silent."
            })
        ])
    })

    it('should append a room description message to an existing array', () => {
        const startingList = [
            new playerMessage({
                name: 'Peter Parker',
                Message: "I just feel like I could be doing more"
            })
        ]

        expect(messages(startingList, {
            type: RECEIVE_MESSAGE,
            payload: {
                DisplayProtocol: 'RoomDescription',
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
            }
        })).toEqual([
            ...startingList,
            new roomDescription({
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
