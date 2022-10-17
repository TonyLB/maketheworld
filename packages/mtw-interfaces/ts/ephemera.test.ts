import { isEphemeraAPIMessage, isEphemeraClientMessage } from './ephemera'

describe('EphemeraAPIMessage typeguard', () => {

    it('should reject non-object entry', () => {
        expect(isEphemeraAPIMessage([{
            message: 'action',
            actionType: 'home',
            payload: { CharacterId: 'CHARACTER#TestABC' }
        }])).toBe(false)
    })

    it('should reject object without message field', () => {
        expect(isEphemeraAPIMessage({
            massage: 'action',
            actionType: 'home',
            payload: { CharacterId: 'CHARACTER#TestABC' }
        })).toBe(false)
    })

    describe('registercharacter', () => {

        it('should reject when no CharacterId', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                PersonId: 'CHARACTER#Test'
            })).toBe(false)
        })

        it('should reject when wrong type CharacterId', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                CharacterId: 1234
            })).toBe(false)
        })

        it('should reject when wrong format CharacterId', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                CharacterId: 'Test1234'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isEphemeraAPIMessage({
                message: 'registercharacter',
                CharacterId: 'CHARACTER#TestABC'
            })).toBe(true)
        })

    })

    describe('action', () => {

        it('should reject when no actionType', () => {
            expect(isEphemeraAPIMessage({
                message: 'action'
            })).toBe(false)
        })

        it('should reject when bad payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'home',
                payload: 'CHARACTER#TestABC'
            })).toBe(false)
        })

        it('should reject mistyped look CharacterId payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'TestABC',
                    EphemeraId: 'ROOM#VORTEX'
                }
            })).toBe(false)
        })

        it('should reject mistyped look EphemeraId payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#TestABC',
                    EphemeraId: 'VORTEX'
                }
            })).toBe(false)
        })

        it('should accept correct look payload', () => {
            expect(isEphemeraAPIMessage({
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#TestABC',
                    EphemeraId: 'ROOM#VORTEX'
                }
            })).toBe(true)
        })

    })
})

describe('EphemeraClientMessage typeguard', () => {

    it('should reject non-object entry', () => {
        expect(isEphemeraClientMessage([{
            messageType: 'Ephemera',
            updates: []
        }])).toBe(false)
    })

    it('should reject object without message field', () => {
        expect(isEphemeraClientMessage({
            massageType: 'Ephemera',
            updates: []
        })).toBe(false)
    })

    describe('EphemeraUpdate', () => {

        it('should reject illegal update content type', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Ephemera',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#TestABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 123,
                    Color: 'green'
                }]
            })).toBe(false)
        })

        it('should reject illegal CharacterId', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Ephemera',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'TestABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 'Tess',
                    Color: 'green'
                }]
            })).toBe(false)
        })

        it('should reject illegal RoomId', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Ephemera',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#TestABC',
                    Connected: true,
                    RoomId: 'VORTEX',
                    Name: 'Tess',
                    Color: 'green'
                }]
            })).toBe(false)
        })

        it('should reject illegal character color', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Ephemera',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#TestABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 'Tess',
                    Color: 'mauve'
                }]
            })).toBe(false)
        })

        it('should accept legal character update', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Ephemera',
                updates: [{
                    type: 'CharacterInPlay',
                    CharacterId: 'CHARACTER#TestABC',
                    Connected: true,
                    RoomId: 'ROOM#VORTEX',
                    Name: 'Tess',
                    Color: 'green'
                }]
            })).toBe(true)
        })

    })

    describe('Messages', () => {

        it('should reject illegal structure', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: 'TestABC',
                    Message: {
                        tag: 'String',
                        value: 'Test'
                    }
                }]
            })).toBe(false)
        })

        it('should reject illegal DisplayProtocol', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'Announcement',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: 'TestABC',
                    Message: [{
                        tag: 'String',
                        value: 'Test'
                    }]
                }]
            })).toBe(false)
        })

        it('should reject illegal message content', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: 'TestABC',
                    Message: [{
                        tag: 'String',
                        value: 'Test'
                    },
                    {
                        tag: 'Sting',
                        value: 'Wrong'
                    }]
                }]
            })).toBe(false)
        })

        it('should reject illegal message', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: ['TestABC'],
                    Message: [{
                        tag: 'String',
                        value: 'Test'
                    }]
                }]
            })).toBe(false)
        })

        it('should accept legal message', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: 'TestABC',
                    Message: [{
                        tag: 'String',
                        value: 'Test'
                    }]
                }]
            })).toBe(true)
        })

    })
})