import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { ephemeraActionsDataSource } from './index'
import messageBus from '../../messageBus'
import { parseCommand } from './parseCommand'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'

jest.mock('../../messageBus')
jest.mock('./roomExitTargetsForCharacter', () => ({
    getRoomExitTargetsForCharacter: jest.fn(),
}))
jest.mock('./parseCommand', () => {
    const actual = jest.requireActual<typeof import('./parseCommand')>('./parseCommand')
    return {
        ...actual,
        parseCommand: jest.fn((input: Parameters<typeof actual.parseCommand>[0]) => actual.parseCommand(input)),
    }
})

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const mockedParseCommand = jest.mocked(parseCommand)
const mockedGetRoomExitTargetsForCharacter = jest.mocked(getRoomExitTargetsForCharacter)

describe('ephemeraActionsDataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.send.mockReturnValue(undefined)
        mockedParseCommand.mockImplementation((input) =>
            jest.requireActual<typeof import('./parseCommand')>('./parseCommand').parseCommand(input)
        )
    })

    it('emits immediate correlated success when Parse Requested carries requestId', async () => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'CHARACTER#123',
                    timestamp: Date.now(),
                    type: 'Parse Requested',
                },
                getContent: async () => ({
                    characterId: 'CHARACTER#123',
                    command: 'look',
                    requestId: 'req-1',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.send).toHaveBeenCalledTimes(2)
        expect(mockMessageBus.send).toHaveBeenNthCalledWith(1, {
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['Parse error'],
        })
        expect(mockMessageBus.send).toHaveBeenNthCalledWith(2, {
            type: 'ReturnValue',
            body: {
                messageType: 'Success',
                RequestId: 'req-1',
                message: 'Parse request accepted',
            },
        })
    })

    it('does not emit correlated success when requestId is missing', async () => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'CHARACTER#123',
                    timestamp: Date.now(),
                    type: 'Parse Requested',
                },
                getContent: async () => ({
                    characterId: 'CHARACTER#123',
                    command: 'look',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.send).toHaveBeenCalledTimes(1)
        expect(mockMessageBus.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['Parse error'],
        })
    })

    describe('ParseCommandNavigationResult', () => {
        const dest = 'ROOM#dest' as EphemeraRoomId
        const from = 'ROOM#from' as EphemeraRoomId

        it('emits Character Navigate streamEvent when target is a valid exit', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [dest],
            })
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'go north',
                        requestId: 'req-nav',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Navigate' },
                update: {
                    type: 'Character Navigate',
                    characterId: 'CHARACTER#123',
                    fromRoomId: from,
                    toRoomId: dest,
                },
            })
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-nav',
                    message: 'Parse request accepted',
                },
            })
        })

        it('publishes WorldOOCMessage when character has no current room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: null,
                toRoomIds: [],
            })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'go',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot go anywhere.'],
            })
        })

        it('publishes WorldOOCMessage when target room is not reachable by an exit', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: ['ROOM#other' as EphemeraRoomId],
            })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'go',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['There is no exit to that place from here.'],
            })
        })
    })

    describe('ParseCommandAcmeOrderResult', () => {
        it('publishes WorldOOCMessage with Acme Order prefix', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                order: 'rocket-powered roller skates',
            })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'order rocket skates',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Acme Order: rocket-powered roller skates'],
            })
        })
    })

    describe('ParseCommandAwaitRoadrunnerResult', () => {
        it('publishes WorldOOCMessage Awaiting Road Runner', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'AwaitRoadRunner' })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'wait',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Awaiting Road Runner'],
            })
        })
    })

    describe('ParseCommandUnimplementedResult', () => {
        it('publishes WorldOOCMessage for unimplemented intent', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Unimplemented' })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'future feature',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: [
                    "I can tell you're trying to do something that hasn't been implemented in the game yet, sorry.",
                ],
            })
        })
    })

    describe('ParseCommandUnknownResult', () => {
        it('publishes WorldOOCMessage for unknown intent', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Unknown' })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Parse Requested',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123',
                        command: 'gibberish',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: [
                    "I'm sorry, I can't tell what you're trying to tell me to do.",
                ],
            })
        })
    })
})
