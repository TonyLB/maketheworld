import {
    isEphemeraAPIMessage,
    isEphemeraClientMessage,
    isConversationCorrelatedPayload,
    isEphemeraClientMessageConversationStep,
    isTerminalConversationStep,
    isEphemeraClientMessageEphemeraCommandSuccess,
    isEphemeraClientMessageError,
} from './ephemera'

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
                    DisplayName: 123,
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
                    DisplayName: 'Tess',
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
                    DisplayName: 'Tess',
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
                    DisplayName: 'Tess',
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
                    DisplayName: 'Tess',
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
                    Target: 'CHARACTER#TestABC',
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
                    Target: 'CHARACTER#TestABC',
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
                    Target: 'CHARACTER#TestABC',
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

        it('should reject illegal message target type', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: ['CHARACTER#TestABC'],
                    Message: [{
                        tag: 'String',
                        value: 'Test'
                    }]
                }]
            })).toBe(false)
        })

        it('should reject illegal message format', () => {
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
            })).toBe(false)
        })

        it('should accept legal message', () => {
            expect(isEphemeraClientMessage({
                messageType: 'Messages',
                messages: [{
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'TestID',
                    CreatedTime: 5,
                    Target: 'CHARACTER#TestABC',
                    Message: ['Test']
                }]
            })).toBe(true)
        })

    })

    describe('ConversationStep (generic envelope)', () => {

        it('should reject legacy GenerateRoomPreview message type', () => {
            expect(isEphemeraClientMessage({
                messageType: 'GenerateRoomPreview',
                generateRoomPreview: { success: true, renderedContent: 'x' }
            })).toBe(false)
        })

        it('should accept ConversationStep generating', () => {
            expect(isEphemeraClientMessage({
                messageType: 'ConversationStep',
                conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                pipeline: 'roomStateRender',
                step: 'generating'
            })).toBe(true)
        })

        it('should reject ConversationStep with legacy generateRoomPreview field', () => {
            expect(isEphemeraClientMessage({
                messageType: 'ConversationStep',
                conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                pipeline: 'roomStateRender',
                step: 'generating',
                generateRoomPreview: { success: true }
            })).toBe(false)
        })

        it('should accept ConversationStep complete with payload', () => {
            expect(isEphemeraClientMessage({
                messageType: 'ConversationStep',
                conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                pipeline: 'roomStateRender',
                step: 'complete',
                payload: { result: 'ok' }
            })).toBe(true)
        })

        it('should reject empty pipeline', () => {
            expect(isEphemeraClientMessage({
                messageType: 'ConversationStep',
                conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                pipeline: '',
                step: 'generating'
            })).toBe(false)
        })
    })
})

describe('ephemera API wire (client and server)', () => {
    it('isEphemeraAPIMessage accepts ephemeraStateChange', () => {
        expect(
            isEphemeraAPIMessage({
                message: 'ephemeraStateChange',
                componentId: 'ROOM#x',
                markState: { markValue: [{ mark: 'm', value: 'v' }] },
            })
        ).toBe(true)
    })

    it('isEphemeraClientMessageEphemeraCommandSuccess', () => {
        expect(
            isEphemeraClientMessageEphemeraCommandSuccess({
                messageType: 'EphemeraCommandSuccess',
                RequestId: 'rid',
                command: 'stateChange',
                componentId: 'ROOM#x',
            })
        ).toBe(true)
        expect(
            isEphemeraClientMessageEphemeraCommandSuccess({
                messageType: 'EphemeraCommandSuccess',
                command: 'bad',
                componentId: 'ROOM#x',
            })
        ).toBe(false)
    })

    it('isEphemeraClientMessageError', () => {
        expect(
            isEphemeraClientMessageError({
                messageType: 'Error',
                RequestId: 'rid',
                message: 'failed',
            })
        ).toBe(true)
        expect(
            isEphemeraClientMessage({
                messageType: 'Error',
                RequestId: 'rid',
                message: 'failed',
            })
        ).toBe(true)
    })
})

describe('conversation correlation helpers', () => {

    it('isConversationCorrelatedPayload', () => {
        expect(isConversationCorrelatedPayload({ conversationId: 'cid' })).toBe(true)
        expect(isConversationCorrelatedPayload({ conversationId: '' })).toBe(false)
        expect(isConversationCorrelatedPayload({})).toBe(false)
    })

    it('isEphemeraClientMessageConversationStep', () => {
        const gen = {
            messageType: 'ConversationStep',
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pipeline: 'roomStateRender',
            step: 'generating'
        }
        expect(isEphemeraClientMessageConversationStep(gen)).toBe(true)
        expect(isEphemeraClientMessageConversationStep({
            messageType: 'GenerateRoomPreview',
            generateRoomPreview: { success: true }
        })).toBe(false)
        expect(isEphemeraClientMessageConversationStep({
            messageType: 'ConversationStep',
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pipeline: 'x',
            step: 'complete',
            payload: {}
        })).toBe(true)
    })

    it('isTerminalConversationStep', () => {
        expect(isTerminalConversationStep({ messageType: 'Error', error: 'x' })).toBe(true)
        expect(isTerminalConversationStep({
            messageType: 'GenerateRoomPreview',
            generateRoomPreview: { success: true }
        })).toBe(false)
        expect(isTerminalConversationStep({
            messageType: 'ConversationStep',
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pipeline: 'roomStateRender',
            step: 'generating'
        })).toBe(false)
        expect(isTerminalConversationStep({
            messageType: 'ConversationStep',
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pipeline: 'roomStateRender',
            step: 'complete',
            payload: { ok: true }
        })).toBe(true)
        expect(isTerminalConversationStep({
            messageType: 'ConversationStep',
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pipeline: 'roomStateRender',
            step: 'error',
            payload: { code: 'e' }
        })).toBe(true)
        expect(isTerminalConversationStep({
            messageType: 'Messages',
            messages: []
        })).toBe(false)
    })
})