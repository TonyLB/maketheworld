import messageBus from '../messageBus'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { EphemeraCharacterId, EphemeraRoomId, EphemeraFeatureId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { sendPerceptionThreadRegistered } from './perception/subscribedEvents'
import { sendRenderRequested } from './renderOrchestration/subscribedEvents'
import { sendActionAssessed } from './apiEphemera'
import { routeTrustedUiAction } from './routeTrustedUiAction'

jest.mock('../messageBus', () => ({
    __esModule: true,
    default: {
        publish: jest.fn(),
    },
}))
jest.mock('./perception/subscribedEvents', () => {
    const actual = jest.requireActual('./perception/subscribedEvents') as object
    return {
        ...actual,
        sendPerceptionThreadRegistered: jest.fn(),
    }
})
jest.mock('./renderOrchestration/subscribedEvents', () => {
    const actual = jest.requireActual('./renderOrchestration/subscribedEvents') as object
    return {
        ...actual,
        sendRenderRequested: jest.fn(),
    }
})
jest.mock('./apiEphemera', () => {
    const actual = jest.requireActual('./apiEphemera') as object
    return {
        ...actual,
        sendActionAssessed: jest.fn(),
    }
})

const MockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const mockSendPerceptionThreadRegistered = sendPerceptionThreadRegistered as jest.MockedFunction<typeof sendPerceptionThreadRegistered>
const mockSendRenderRequested = sendRenderRequested as jest.MockedFunction<typeof sendRenderRequested>
const mockSendActionAssessed = sendActionAssessed as jest.MockedFunction<typeof sendActionAssessed>

describe('routeTrustedUiAction', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        MockMessageBus.publish.mockClear()
        mockSendPerceptionThreadRegistered.mockClear()
        mockSendRenderRequested.mockClear()
        mockSendActionAssessed.mockClear()
    })

    describe('look action', () => {
        it('should send Action Assessed LookComponent for room look', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    EphemeraId: 'ROOM#456' as EphemeraRoomId
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(true)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'LookComponent',
                        componentId: 'ROOM#456',
                        confidence: 1,
                    },
                    source: 'uiLook',
                }
            )
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
            expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'Perception' })
            )
        })

        it('should send Action Assessed LookComponent for feature look', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'look',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    EphemeraId: 'FEATURE#789' as EphemeraFeatureId
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(true)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'LookComponent',
                        componentId: 'FEATURE#789',
                        confidence: 1,
                    },
                    source: 'uiLook',
                }
            )
            expect(MockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'Perception' })
            )
        })
    })

    describe('move action', () => {
        it('should send Action Assessed Navigation for move action', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    RoomId: 'ROOM#789' as EphemeraRoomId,
                    ExitName: 'north'
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(true)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'Navigation',
                        targetId: 'ROOM#789',
                        exitName: 'north',
                        confidence: 1,
                    },
                    source: 'uiExit',
                }
            )
        })

        it('should send Action Assessed Navigation for move action without exit name', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'move',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    RoomId: 'ROOM#789' as EphemeraRoomId
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(true)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'Navigation',
                        targetId: 'ROOM#789',
                        confidence: 1,
                    },
                    source: 'uiExit',
                }
            )
        })
    })

    describe('home action', () => {
        it('should send Action Assessed Home for home action', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'home',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(true)

            expect(mockSendActionAssessed).toHaveBeenCalledWith(
                MockMessageBus,
                'CHARACTER#123',
                {
                    characterId: 'CHARACTER#123',
                    assessed: {
                        type: 'Home',
                        confidence: 1,
                    },
                    source: 'uiHome',
                }
            )
        })
    })

    describe('unhandled action types', () => {
        it('returns false for speech actions', () => {
            const request: ActionAPIMessage = {
                message: 'action',
                actionType: 'SayMessage',
                payload: {
                    CharacterId: 'CHARACTER#123' as EphemeraCharacterId,
                    Message: 'Hello'
                }
            }

            expect(routeTrustedUiAction(MockMessageBus, request)).toBe(false)
            expect(mockSendActionAssessed).not.toHaveBeenCalled()
        })
    })
})
