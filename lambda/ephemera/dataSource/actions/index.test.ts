import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { ephemeraActionsDataSource } from './index'
import messageBus from '../../messageBus'
import { parseCommand } from './parseCommand'
import { collectCoyoteOccupiedStableKeys } from './collectCoyoteOccupiedStableKeys'
import { finalizeStableKeysDeterministic } from './finalizeStableKeysDeterministic'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import { runAcmeOrderAffinitiesHarness } from './runAcmeOrderAffinitiesHarness'
import { runCoyoteEngineTestHarness } from '../coyoteGame/runCoyoteEngineTestHarness'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'

jest.mock('@tonylb/mtw-wml/ts/schema', () => ({
    schemaToWML: jest.fn(() => '<Asset />'),
}))
jest.mock('../perception/subscribedEvents', () => {
    const actual = jest.requireActual('../perception/subscribedEvents') as object
    return {
        ...actual,
        sendPerceptionThreadRegistered: jest.fn(),
    }
})
jest.mock('../renderOrchestration/subscribedEvents', () => {
    const actual = jest.requireActual('../renderOrchestration/subscribedEvents') as object
    return {
        ...actual,
        sendRenderRequested: jest.fn(),
    }
})
jest.mock('../../messageBus')
jest.mock('./roomExitTargetsForCharacter', () => ({
    getRoomExitTargetsForCharacter: jest.fn(),
}))
jest.mock('./parseCommand', () => ({
    ...jest.requireActual<typeof import('./parseCommand')>('./parseCommand'),
    parseCommand: jest.fn(),
}))
jest.mock('./collectCoyoteOccupiedStableKeys', () => ({
    collectCoyoteOccupiedStableKeys: jest.fn(),
}))
jest.mock('../coyoteGame/runCoyoteEngineTestHarness', () => ({
    runCoyoteEngineTestHarness: jest.fn(),
}))
jest.mock('./runAcmeOrderAffinitiesHarness', () => ({
    runAcmeOrderAffinitiesHarness: jest.fn(),
}))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const mockSendPerceptionThreadRegistered = sendPerceptionThreadRegistered as jest.MockedFunction<typeof sendPerceptionThreadRegistered>
const mockSendRenderRequested = sendRenderRequested as jest.MockedFunction<typeof sendRenderRequested>
const mockedParseCommand = jest.mocked(parseCommand)
const mockedCollectCoyoteOccupiedStableKeys = jest.mocked(collectCoyoteOccupiedStableKeys)
const mockedGetRoomExitTargetsForCharacter = jest.mocked(getRoomExitTargetsForCharacter)
const mockedRunCoyoteEngineTestHarness = jest.mocked(runCoyoteEngineTestHarness)
const mockedRunAcmeOrderAffinitiesHarness = jest.mocked(runAcmeOrderAffinitiesHarness)

describe('ephemeraActionsDataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.send.mockReturnValue(undefined)
        mockSendPerceptionThreadRegistered.mockClear()
        mockSendRenderRequested.mockClear()
        mockedRunCoyoteEngineTestHarness.mockResolvedValue(undefined)
        mockedRunAcmeOrderAffinitiesHarness.mockResolvedValue(undefined)
        mockedCollectCoyoteOccupiedStableKeys.mockResolvedValue(new Set<string>())
        mockedParseCommand.mockResolvedValue({
            type: 'Error',
            errorMessage: 'Parse error',
        })
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
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest, confidence: 0.9 })
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
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest, confidence: 0.9 })
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
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest, confidence: 0.9 })
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

    describe('ParseCommandLookRoomResult', () => {
        const currentRoom = 'ROOM#from' as EphemeraRoomId

        it('publishes WorldOOCMessage when character has no current room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'LookRoom', confidence: 1 })
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
                        command: 'look',
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

        it('streams Look Command Requested when in a room (deterministic LookRoom)', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'LookRoom', confidence: 1 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: currentRoom,
                toRoomIds: [],
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
                        command: 'look',
                        requestId: 'req-look',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#123',
                    roomId: currentRoom,
                    confidence: 1,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-look',
                    message: 'Parse request accepted',
                },
            })
        })

        it('streams Look Command Requested for Step A LookRoom (paraphrase) with confidence from parse', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'LookRoom', confidence: 0.91 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: currentRoom,
                toRoomIds: [],
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
                        command: 'examine the room',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#123',
                    roomId: currentRoom,
                    confidence: 0.91,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
        })
    })

    describe('ParseCommandAcmeOrderResult', () => {
        it('passes occupiedStableKeys from collectCoyoteOccupiedStableKeys into parseCommand', async () => {
            mockedCollectCoyoteOccupiedStableKeys.mockResolvedValue(new Set(['alpha', 'beta']))
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'widget', stableKey: 'widget', affinities: [] }],
                confidence: 0.91,
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
                        command: 'order widget',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedCollectCoyoteOccupiedStableKeys).toHaveBeenCalledTimes(1)
            expect(mockedParseCommand).toHaveBeenCalledWith({
                command: 'order widget',
                occupiedStableKeys: ['alpha', 'beta'],
            })
        })

        it('publishes Acme Order streamEvent and WorldMessage delivery line when valid orders exist', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rocket-powered roller skates',
                    stableKey: 'rocket-powered-roller-skates',
                    affinities: [],
                }],
                confidence: 0.9,
            })
            const expectedStableKey = finalizeStableKeysDeterministic(
                [{ name: 'rocket-powered roller skates', proposedStableKey: 'rocket-powered-roller-skates' }],
                new Set(),
            )[0]
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
                        command: 'order rocket skates',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Acme Order' },
                update: {
                    type: 'Acme Order',
                    characterId: 'CHARACTER#123',
                    orders: [{
                        shortName: 'rocket-powered roller skates',
                        stableKey: expectedStableKey,
                        affinities: [],
                    }],
                    confidence: 0.9,
                },
            })
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: ['An Acme courier delivers your order'],
            })
        })

        it('repairs stableKey when Coyote-wide occupancy collides', async () => {
            mockedCollectCoyoteOccupiedStableKeys.mockResolvedValue(new Set(['rocket-powered-roller-skates']))
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rocket-powered roller skates',
                    stableKey: 'rocket-powered-roller-skates',
                    affinities: [],
                }],
                confidence: 0.9,
            })
            const expectedStableKey = finalizeStableKeysDeterministic(
                [{ name: 'rocket-powered roller skates', proposedStableKey: 'rocket-powered-roller-skates' }],
                new Set(['rocket-powered-roller-skates']),
            )[0]
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
                        command: 'order rocket skates',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                update: expect.objectContaining({
                    orders: [{ shortName: 'rocket-powered roller skates', stableKey: expectedStableKey, affinities: [] }],
                }),
            }))
            expect(expectedStableKey).toBe('rocket-powered-roller-skates1')
        })

        it('includes invalid-order apology lines in WorldMessage', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [
                    { valid: true, name: 'anvil', stableKey: 'anvil', affinities: [] },
                    {
                        valid: false,
                        name: 'justice',
                        errorType: 'Not tangible',
                        affinities: [],
                    },
                    {
                        valid: false,
                        name: "Jupiter's moon Ganymede",
                        errorType: 'Too large',
                        affinities: [],
                    },
                    {
                        valid: false,
                        name: 'Glooblethwoats, flensed',
                        errorType: 'Not a thing',
                        affinities: [],
                    },
                ],
                confidence: 0.88,
            })
            const expectedAnvilKey = finalizeStableKeysDeterministic(
                [{ name: 'anvil', proposedStableKey: 'anvil' }],
                new Set(),
            )[0]
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
                        command: 'order anvil and magnet',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Acme Order' },
                update: {
                    type: 'Acme Order',
                    characterId: 'CHARACTER#123',
                    orders: [
                        { shortName: 'anvil', stableKey: expectedAnvilKey, affinities: [] },
                    ],
                    confidence: 0.88,
                },
            })
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: [
                    'An Acme courier delivers your order',
                    { data: { tag: 'br' }, children: [] },
                    "The courier apologizes: Acme only sells tangible objects, justice doesn't qualify",
                    { data: { tag: 'br' }, children: [] },
                    "The courier apologizes: You couldn't afford the shipping on Jupiter's moon Ganymede",
                    { data: { tag: 'br' }, children: [] },
                    'The courier apologizes: Glooblethwoats, flensed is not in the catalog.',
                ],
            })
        })

        it('publishes structured orders with affinities and affinitiesFailed', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'Beehive',
                    stableKey: 'beehive',
                    affinities: [{ role: 'terminal', aptness: 0.7 }],
                }, {
                    valid: true,
                    name: 'broken dynamite',
                    stableKey: 'broken-dynamite',
                    affinities: [],
                    affinitiesFailed: true,
                }],
                confidence: 0.85,
            })
            const beeDynamiteKeys = finalizeStableKeysDeterministic([
                { name: 'Beehive', proposedStableKey: 'beehive' },
                { name: 'broken dynamite', proposedStableKey: 'broken-dynamite' },
            ], new Set())
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
                        command: 'order stuff',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Acme Order' },
                update: {
                    type: 'Acme Order',
                    characterId: 'CHARACTER#123',
                    orders: [
                        { shortName: 'Beehive', stableKey: beeDynamiteKeys[0], affinities: [{ role: 'terminal', aptness: 0.7 }] },
                        { shortName: 'broken dynamite', stableKey: beeDynamiteKeys[1], affinities: [], affinitiesFailed: true },
                    ],
                    confidence: 0.85,
                },
            })
        })
    })

    describe('ParseCommandAwaitRoadrunnerResult', () => {
        it('publishes Await RoadRunner streamEvent and WorldOOCMessage', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'AwaitRoadRunner', confidence: 0.9 })
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
                        command: 'wait',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Await RoadRunner' },
                update: {
                    type: 'Await RoadRunner',
                    characterId: 'CHARACTER#123',
                    confidence: 0.9,
                },
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
            mockedParseCommand.mockResolvedValue({ type: 'Unimplemented', confidence: 0.9 })

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

    describe('ParseCommandCoyoteAffinitiesTestResult', () => {
        it.skip('publishes disabled message and does not run affinities harness', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'CoyoteAffinitiesTest', confidence: 1 })

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
                        command: '/test affinities',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedRunAcmeOrderAffinitiesHarness).not.toHaveBeenCalled()
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Acme affinities test harness is currently disabled.'],
            })
        })
    })

    describe('ParseCommandCoyoteEngineTestResult', () => {
        it.skip('publishes disabled message and does not run harness', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'CoyoteEngineTest', confidence: 0.9 })

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
                        command: 'run coyote engine test',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedRunCoyoteEngineTestHarness).not.toHaveBeenCalled()
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Coyote engine test harness is currently disabled.'],
            })
        })
    })

    describe('ParseCommandUnknownResult', () => {
        it('publishes WorldOOCMessage for unknown intent', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Unknown', confidence: 0.9 })

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
