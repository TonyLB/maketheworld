import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { ephemeraActionsDataSource } from './index'
import { MULTIPLE_COMMANDS_PLAYER_MESSAGE } from './multipleCommandsPlayerMessage'
import messageBus from '../../messageBus'
import { parseCommand } from './parseCommand'
import { navigationIntentErrorMessages, objectManipulationErrorMessages } from './parseCommand'
import { collectCoyoteOccupiedStableKeys } from './stableKey/collectCoyoteOccupiedStableKeys'
import { finalizeStableKeysDeterministic } from './stableKey/finalizeStableKeysDeterministic'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import { getHeldInventoryCatalogForCharacter } from './heldInventoryCatalogForCharacter'
import { getRoomObjectCatalogForCharacter } from './roomObjectCatalogForCharacter'
import { resolveHomeTargetForCharacter } from './resolveHomeTargetForCharacter'
import { runAcmeOrderAffinitiesHarness } from './actionHandlers/runAcmeOrderAffinitiesHarness'
import { runCoyoteEngineTestHarness } from '../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness'
import { isCoyoteGameRoom } from '../coyoteGame/utilities/isCoyoteGameRoom'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'
import internalCache from '../../internalCache'

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
jest.mock('../../internalCache')
jest.mock('./roomExitTargetsForCharacter', () => ({
    getRoomExitTargetsForCharacter: jest.fn(),
}))
jest.mock('./roomObjectCatalogForCharacter', () => ({
    getRoomObjectCatalogForCharacter: jest.fn(),
    roomObjectLabelsFromCatalog: jest.requireActual('./roomObjectCatalogForCharacter').roomObjectLabelsFromCatalog,
}))
jest.mock('./heldInventoryCatalogForCharacter', () => ({
    getHeldInventoryCatalogForCharacter: jest.fn(),
}))
jest.mock('./resolveHomeTargetForCharacter', () => ({
    resolveHomeTargetForCharacter: jest.fn(),
}))
jest.mock('./parseCommand', () => ({
    ...jest.requireActual<typeof import('./parseCommand')>('./parseCommand'),
    parseCommand: jest.fn(),
}))
jest.mock('./stableKey/collectCoyoteOccupiedStableKeys', () => ({
    collectCoyoteOccupiedStableKeys: jest.fn(),
}))
jest.mock('../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness', () => ({
    runCoyoteEngineTestHarness: jest.fn(),
}))
jest.mock('../coyoteGame/utilities/isCoyoteGameRoom', () => ({
    isCoyoteGameRoom: jest.fn(),
}))
jest.mock('./actionHandlers/runAcmeOrderAffinitiesHarness', () => ({
    runAcmeOrderAffinitiesHarness: jest.fn(),
}))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const mockSendPerceptionThreadRegistered = sendPerceptionThreadRegistered as jest.MockedFunction<typeof sendPerceptionThreadRegistered>
const mockSendRenderRequested = sendRenderRequested as jest.MockedFunction<typeof sendRenderRequested>
const mockedParseCommand = jest.mocked(parseCommand)
const mockedCollectCoyoteOccupiedStableKeys = jest.mocked(collectCoyoteOccupiedStableKeys)
const mockedGetRoomExitTargetsForCharacter = jest.mocked(getRoomExitTargetsForCharacter)
const mockedGetRoomObjectCatalogForCharacter = jest.mocked(getRoomObjectCatalogForCharacter)
const mockedGetHeldInventoryCatalogForCharacter = jest.mocked(getHeldInventoryCatalogForCharacter)
const mockedResolveHomeTargetForCharacter = jest.mocked(resolveHomeTargetForCharacter)
const mockedRunCoyoteEngineTestHarness = jest.mocked(runCoyoteEngineTestHarness)
const mockedIsCoyoteGameRoom = jest.mocked(isCoyoteGameRoom)
const mockedRunAcmeOrderAffinitiesHarness = jest.mocked(runAcmeOrderAffinitiesHarness)
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('ephemeraActionsDataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.publish.mockReturnValue(undefined)
        mockSendPerceptionThreadRegistered.mockClear()
        mockSendRenderRequested.mockClear()
        mockedRunCoyoteEngineTestHarness.mockResolvedValue(undefined)
        mockedRunAcmeOrderAffinitiesHarness.mockResolvedValue(undefined)
        mockedIsCoyoteGameRoom.mockResolvedValue(false)
        mockedCollectCoyoteOccupiedStableKeys.mockResolvedValue(new Set<string>())
        mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
            fromRoomId: null,
            toRoomIds: [],
            exits: [],
        })
        mockedGetRoomObjectCatalogForCharacter.mockResolvedValue({ roomId: null, entries: [] })
        mockedGetHeldInventoryCatalogForCharacter.mockResolvedValue({ entries: [] })
        mockedResolveHomeTargetForCharacter.mockResolvedValue({ type: 'NoExitContext' })
        internalCacheMock.CharacterMeta.get.mockResolvedValue(undefined as any)
        internalCacheMock.ObjectEmbedding.get.mockResolvedValue({})
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

        expect(mockMessageBus.publish).toHaveBeenCalledTimes(3)
        expect(mockMessageBus.publish).toHaveBeenNthCalledWith(1, {
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'CommandTranscriptMessage',
            message: ['look'],
        })
        expect(mockMessageBus.publish).toHaveBeenNthCalledWith(2, {
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['Parse error'],
        })
        expect(mockMessageBus.publish).toHaveBeenNthCalledWith(3, {
            type: 'ReturnValue',
            body: {
                messageType: 'Success',
                RequestId: 'req-1',
                message: 'parse_request_handled',
            },
        })
    })

    it('maps NavigationIntent no-exit-context parse error to room guidance copy', async () => {
        mockedParseCommand.mockResolvedValue({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.noExitContext,
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
                    command: 'head north',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['You are not in a room, so you cannot go anywhere.'],
        })
    })

    it('maps NavigationIntent no-match parse error to missing-exit copy', async () => {
        mockedParseCommand.mockResolvedValue({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.noMatch,
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
                    command: 'head north',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['There is no exit to that place from here.'],
        })
    })

    it('maps NavigationIntent ambiguous parse error to ambiguity copy', async () => {
        mockedParseCommand.mockResolvedValue({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.ambiguousMatch,
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
                    command: 'head north',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.publish).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ["I can't tell which exit you mean from here."],
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

        expect(mockMessageBus.publish).toHaveBeenCalledTimes(2)
        expect(mockMessageBus.publish).toHaveBeenNthCalledWith(1, {
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'CommandTranscriptMessage',
            message: ['look'],
        })
        expect(mockMessageBus.publish).toHaveBeenNthCalledWith(2, {
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
            mockedParseCommand.mockResolvedValue({
                type: 'Navigation',
                targetId: dest,
                exitName: 'north',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [dest],
                exits: [{ normalizedName: 'north', toRoomId: dest }],
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
                    exitName: 'north',
                },
            })
            expect(mockedParseCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomExits: [{ normalizedName: 'north', targetId: dest }],
                }),
                { messageBus: mockMessageBus }
            )
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-nav',
                    message: 'parse_request_handled',
                },
            })
        })

        it('publishes WorldOOCMessage when character has no current room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Navigation', targetId: dest, confidence: 0.9 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: null,
                toRoomIds: [],
                exits: [],
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
                exits: [{ normalizedName: 'north', toRoomId: 'ROOM#other' as EphemeraRoomId }],
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['There is no exit to that place from here.'],
            })
        })
    })

    describe('ParseCommandHomeResult', () => {
        const from = 'ROOM#from' as EphemeraRoomId
        const home = 'ROOM#home' as EphemeraRoomId

        it('emits Character Home streamEvent for bare home command', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Home', confidence: 1 })
            mockedResolveHomeTargetForCharacter.mockResolvedValue({
                type: 'Resolved',
                fromRoomId: from,
                toRoomId: home,
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
                        command: 'home',
                        requestId: 'req-home',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Home' },
                update: {
                    type: 'Character Home',
                    characterId: 'CHARACTER#123',
                    fromRoomId: from,
                    toRoomId: home,
                },
            })
        })

        it('publishes WorldOOCMessage when already at home', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Home', confidence: 1 })
            mockedResolveHomeTargetForCharacter.mockResolvedValue({ type: 'AlreadyHome' })

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
                        command: 'home',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are already home.'],
            })
        })
    })

    describe('Action Assessed Navigation', () => {
        const dest = 'ROOM#dest' as EphemeraRoomId
        const from = 'ROOM#from' as EphemeraRoomId

        it('streams Character Navigate without CommandTranscriptMessage or parseCommand', async () => {
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [dest],
                exits: [{ normalizedName: 'north', toRoomId: dest }],
            })
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'Navigation' as const,
                            targetId: dest,
                            exitName: 'north',
                            confidence: 1,
                        },
                        source: 'uiExit' as const,
                        requestId: 'req-ui',
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedParseCommand).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({
                displayProtocol: 'CommandTranscriptMessage',
            }))
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Navigate' },
                update: {
                    type: 'Character Navigate',
                    characterId: 'CHARACTER#123',
                    fromRoomId: from,
                    toRoomId: dest,
                    exitName: 'north',
                },
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-ui',
                    message: 'action_assessed_handled',
                },
            })
        })

        it('publishes WorldOOCMessage when assessed target is not a valid exit', async () => {
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: ['ROOM#other' as EphemeraRoomId],
                exits: [{ normalizedName: 'north', toRoomId: 'ROOM#other' as EphemeraRoomId }],
            })

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'Navigation' as const,
                            targetId: dest,
                            confidence: 1,
                        },
                        source: 'uiExit' as const,
                    }),
                } as any],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['There is no exit to that place from here.'],
            })
        })
    })

    describe('Action Assessed Home', () => {
        const from = 'ROOM#from' as EphemeraRoomId
        const home = 'ROOM#home' as EphemeraRoomId

        it('streams Character Home without CommandTranscriptMessage or parseCommand', async () => {
            mockedResolveHomeTargetForCharacter.mockResolvedValue({
                type: 'Resolved',
                fromRoomId: from,
                toRoomId: home,
            })
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'Home' as const,
                            confidence: 1,
                        },
                        source: 'uiHome' as const,
                        requestId: 'req-ui-home',
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedParseCommand).not.toHaveBeenCalled()
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Home' },
                update: {
                    type: 'Character Home',
                    characterId: 'CHARACTER#123',
                    fromRoomId: from,
                    toRoomId: home,
                },
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-ui-home',
                    message: 'action_assessed_handled',
                },
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
                exits: [],
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
                exits: [],
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
                    componentId: currentRoom,
                    confidence: 1,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-look',
                    message: 'parse_request_handled',
                },
            })
        })

        it('streams Look Command Requested for discriminate-intent LookRoom (paraphrase) with confidence from parse', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'LookRoom', confidence: 0.91 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: currentRoom,
                toRoomIds: [],
                exits: [],
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
                    componentId: currentRoom,
                    confidence: 0.91,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
        })
    })

    describe('Action Assessed LookComponent', () => {
        it('streams Look Command Requested for room component without parseCommand', async () => {
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'LookComponent' as const,
                            componentId: 'ROOM#explicit' as const,
                            confidence: 1,
                        },
                        source: 'uiLook' as const,
                        requestId: 'req-ui-look-room',
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedParseCommand).not.toHaveBeenCalled()
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#123',
                    componentId: 'ROOM#explicit',
                    confidence: 1,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-ui-look-room',
                    message: 'action_assessed_handled',
                },
            })
        })

        it('streams Look Command Requested for feature component', async () => {
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'LookComponent' as const,
                            componentId: 'FEATURE#door' as const,
                            confidence: 1,
                        },
                        source: 'link' as const,
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#123',
                    componentId: 'FEATURE#door',
                    confidence: 1,
                },
            })
            expect(mockSendPerceptionThreadRegistered).not.toHaveBeenCalled()
            expect(mockSendRenderRequested).not.toHaveBeenCalled()
        })

        it('streams Look Command Requested for knowledge with directResponse', async () => {
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'LookComponent' as const,
                            componentId: 'KNOWLEDGE#lore' as const,
                            confidence: 1,
                            directResponse: true,
                        },
                        source: 'link' as const,
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#123',
                    componentId: 'KNOWLEDGE#lore',
                    confidence: 1,
                    directResponse: true,
                },
            })
        })
    })

    describe('Action Assessed CharacterSpoke', () => {
        const room = 'ROOM#456' as EphemeraRoomId

        it('streams Character Spoke when character is in a room', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: room,
                RoomStack: [],
                HomeId: room,
                assets: [],
                Color: 'blue',
            })
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'CharacterSpoke' as const,
                            message: 'Hello',
                            displayProtocol: 'SayMessage' as const,
                            confidence: 1,
                        },
                        source: 'uiSpeech' as const,
                        requestId: 'req-speech',
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedParseCommand).not.toHaveBeenCalled()
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Spoke' },
                update: {
                    type: 'Character Spoke',
                    characterId: 'CHARACTER#123',
                    message: 'Hello',
                    displayProtocol: 'SayMessage',
                    confidence: 1,
                },
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-speech',
                    message: 'action_assessed_handled',
                },
            })
        })

        it('does not gate Character Spoke on legacy CharacterMeta.RoomId', async () => {
            // Room targeting is narration's job (resolveCharacterRoomId); this layer must not consult legacy RoomId.
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'CharacterSpoke' as const,
                            message: 'Hello',
                            displayProtocol: 'SayMessage' as const,
                            confidence: 1,
                        },
                        source: 'uiSpeech' as const,
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(internalCacheMock.CharacterMeta.get).not.toHaveBeenCalled()
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Character Spoke' },
                update: {
                    type: 'Character Spoke',
                    characterId: 'CHARACTER#123',
                    message: 'Hello',
                    displayProtocol: 'SayMessage',
                    confidence: 1,
                },
            })
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'ReturnValue' })
            )
        })

        it('does not publish bare ReturnValue Success without RequestId', async () => {
            internalCacheMock.CharacterMeta.get.mockResolvedValue({
                EphemeraId: 'CHARACTER#123',
                Name: 'TestCharacter',
                RoomId: room,
                RoomStack: [],
                HomeId: room,
                assets: [],
                Color: 'blue',
            })
            const streamEvent = jest.fn(async () => {})

            await ephemeraActionsDataSource.receiveEvents!({
                events: [{
                    header: {
                        dataSourceKey: 'api.ephemera',
                        streamKey: 'CHARACTER#123',
                        timestamp: Date.now(),
                        type: 'Action Assessed',
                    },
                    getContent: async () => ({
                        characterId: 'CHARACTER#123' as const,
                        assessed: {
                            type: 'CharacterSpoke' as const,
                            message: 'Hello',
                            displayProtocol: 'SayMessage' as const,
                            confidence: 1,
                        },
                        source: 'uiSpeech' as const,
                    }),
                } as any],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalled()
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'ReturnValue' })
            )
        })
    })

    describe('ParseCommandAcmeOrderResult', () => {
        it('passes occupiedStableKeys from collectCoyoteOccupiedStableKeys into parseCommand', async () => {
            mockedCollectCoyoteOccupiedStableKeys.mockResolvedValue(new Set(['alpha', 'beta']))
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'widget', stableKey: 'widget' }],
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
            expect(mockedParseCommand).toHaveBeenCalledWith(
                {
                    command: 'order widget',
                    characterId: 'CHARACTER#123',
                    roomExits: [],
                    roomObjectLabels: [],
                    roomObjectCatalog: [],
                    heldInventoryCatalog: [],
                    occupiedStableKeys: ['alpha', 'beta'],
                },
                { messageBus: mockMessageBus }
            )
        })

        it('passes heldInventoryCatalog from parallel fetch into parseCommand', async () => {
            const heldEntry = { objectId: 'OBJECT#Broom' as const, normalizedShortName: 'broom' }
            mockedGetHeldInventoryCatalogForCharacter.mockResolvedValue({ entries: [heldEntry] })
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: 'held only',
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
                        command: 'drop broom',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedGetHeldInventoryCatalogForCharacter).toHaveBeenCalledWith('CHARACTER#123')
            expect(mockedParseCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    heldInventoryCatalog: [{ ...heldEntry, embedding: undefined }],
                }),
                { messageBus: mockMessageBus }
            )
        })

        it('batch-loads ObjectEmbedding rows and attaches embeddings to catalog entries for parseCommand', async () => {
            const broomId = 'OBJECT#Broom' as EphemeraObjectId
            const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
            const pouchId = 'OBJECT#Pouch' as EphemeraObjectId
            const broomEmbedding = SemanticEmbedding.fromFloat32(
                Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0)),
                { modelId: 'amazon.titan-embed-text-v2:0' }
            )
            const pouchEmbedding = SemanticEmbedding.fromFloat32(
                Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) => (index === 1 ? 1 : 0)),
                { modelId: 'amazon.titan-embed-text-v2:0' }
            )
            mockedGetRoomObjectCatalogForCharacter.mockResolvedValue({
                roomId: 'ROOM#Bridge' as EphemeraRoomId,
                entries: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: anvilId, normalizedShortName: 'anvil' },
                ],
            })
            mockedGetHeldInventoryCatalogForCharacter.mockResolvedValue({
                entries: [
                    { objectId: broomId, normalizedShortName: 'held broom' },
                    { objectId: pouchId, normalizedShortName: 'pouch' },
                ],
            })
            internalCacheMock.ObjectEmbedding.get.mockResolvedValue({
                [broomId]: broomEmbedding,
                [pouchId]: pouchEmbedding,
            })
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: 'embedding ingress',
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
                        command: 'take broom',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(internalCacheMock.ObjectEmbedding.get).toHaveBeenCalledWith([broomId, anvilId, pouchId])
            expect(mockedParseCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomObjectCatalog: [
                        { objectId: broomId, normalizedShortName: 'broom', embedding: broomEmbedding },
                        { objectId: anvilId, normalizedShortName: 'anvil', embedding: undefined },
                    ],
                    heldInventoryCatalog: [
                        { objectId: broomId, normalizedShortName: 'held broom', embedding: broomEmbedding },
                        { objectId: pouchId, normalizedShortName: 'pouch', embedding: pouchEmbedding },
                    ],
                }),
                { messageBus: mockMessageBus }
            )
        })

        it('skips ObjectEmbedding.get when both catalogs are empty', async () => {
            mockedGetRoomObjectCatalogForCharacter.mockResolvedValue({ roomId: null, entries: [] })
            mockedGetHeldInventoryCatalogForCharacter.mockResolvedValue({ entries: [] })
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: 'empty catalogs',
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

            expect(internalCacheMock.ObjectEmbedding.get).not.toHaveBeenCalled()
        })

        it('publishes Acme Order streamEvent and WorldMessage delivery line when valid orders exist', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rocket-powered roller skates',
                    stableKey: 'rocket-powered-roller-skates',
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
                    }],
                    confidence: 0.9,
                },
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
                    orders: [{ shortName: 'rocket-powered roller skates', stableKey: expectedStableKey }],
                }),
            }))
            expect(expectedStableKey).toBe('rocket-powered-roller-skates1')
        })

        it('includes invalid-order apology lines in WorldMessage', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [
                    { valid: true, name: 'anvil', stableKey: 'anvil' },
                    {
                        valid: false,
                        name: 'justice',
                        errorType: 'Not tangible',
                    },
                    {
                        valid: false,
                        name: "Jupiter's moon Ganymede",
                        errorType: 'Too large',
                    },
                    {
                        valid: false,
                        name: 'Glooblethwoats, flensed',
                        errorType: 'Not a thing',
                    },
                    {
                        valid: false,
                        name: 'Justice Sonia Sotomayor',
                        errorType: 'Celebrity cameo',
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
                        { shortName: 'anvil', stableKey: expectedAnvilKey },
                    ],
                    confidence: 0.88,
                },
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
                    { data: { tag: 'br' }, children: [] },
                    'The courier apologizes: Acme no longer arranges celebrity cameos. Complaints about this policy should be directed to Yakko, Wakko, and Dot at the Warner lot. They know what they did.',
                ],
            })
        })

        it('publishes structured trope-first orders', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'Beehive',
                    stableKey: 'beehive',
                    tropeAffinities: [{ trope: 'Finishing Move', aptness: 'Good', narrowing: 'point payload' }],
                }, {
                    valid: true,
                    name: 'broken dynamite',
                    stableKey: 'broken-dynamite',
                    tropeAffinities: [],
                    tropeAffinitiesFailed: true,
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
                        { shortName: 'Beehive', stableKey: beeDynamiteKeys[0], tropeAffinities: [{ trope: 'Finishing Move', aptness: 'Good', narrowing: 'point payload' }] },
                        { shortName: 'broken dynamite', stableKey: beeDynamiteKeys[1], tropeAffinities: [], tropeAffinitiesFailed: true },
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
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Awaiting Road Runner'],
            })
        })
    })

    describe('ParseCommandPredictHypothesisResult', () => {
        const coyoteRoom = 'ROOM#VORTEX' as EphemeraRoomId
        const nonCoyoteRoom = 'ROOM#other' as EphemeraRoomId

        it('publishes WorldOOCMessage when character has no current room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'PredictHypothesis', confidence: 1 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: null,
                toRoomIds: [],
                exits: [],
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
                        command: 'predict',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You can only predict your Coyote plan from a Coyote Game room.'],
            })
        })

        it('publishes WorldOOCMessage when character is not in a Coyote Game room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'PredictHypothesis', confidence: 0.91 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: nonCoyoteRoom,
                toRoomIds: [],
                exits: [],
            })
            mockedIsCoyoteGameRoom.mockResolvedValue(false)
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
                        command: "what's my plan",
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedIsCoyoteGameRoom).toHaveBeenCalledWith(nonCoyoteRoom)
            expect(streamEvent).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You can only predict your Coyote plan from a Coyote Game room.'],
            })
        })

        it('publishes Predict Hypothesis streamEvent without WorldOOCMessage when in a Coyote Game room', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'PredictHypothesis', confidence: 1 })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: coyoteRoom,
                toRoomIds: [],
                exits: [],
            })
            mockedIsCoyoteGameRoom.mockResolvedValue(true)
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
                        command: 'predict',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedIsCoyoteGameRoom).toHaveBeenCalledWith(coyoteRoom)
            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Predict Hypothesis' },
                update: {
                    type: 'Predict Hypothesis',
                    characterId: 'CHARACTER#123',
                    confidence: 1,
                },
            })
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    displayProtocol: 'WorldOOCMessage',
                })
            )
        })
    })

    describe('ParseCommandObjectManipulationResult', () => {
        const from = 'ROOM#from' as EphemeraRoomId

        it('emits Object Take Hold streamEvent when takeHold is grounded', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'ObjectManipulation',
                operationKind: 'takeHold',
                objectId: 'OBJECT#Broom',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [],
                exits: [],
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
                        command: 'pick up the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Object Take Hold' },
                update: {
                    type: 'Object Take Hold',
                    characterId: 'CHARACTER#123',
                    objectId: 'OBJECT#Broom',
                    roomId: from,
                    confidence: 0.9,
                },
            })
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    displayProtocol: 'WorldOOCMessage',
                })
            )
        })

        it('emits Object Drop streamEvent when drop is grounded', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'ObjectManipulation',
                operationKind: 'drop',
                objectId: 'OBJECT#Broom',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [],
                exits: [],
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
                        command: 'drop the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Object Drop' },
                update: {
                    type: 'Object Drop',
                    characterId: 'CHARACTER#123',
                    objectId: 'OBJECT#Broom',
                    roomId: from,
                    confidence: 0.9,
                },
            })
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    displayProtocol: 'WorldOOCMessage',
                })
            )
        })

        it('emits correlated ReturnValue when requestId is present', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'ObjectManipulation',
                operationKind: 'takeHold',
                objectId: 'OBJECT#Broom',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [],
                exits: [],
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
                        command: 'pick up the broom',
                        requestId: 'req-takehold',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-takehold',
                    message: 'parse_request_handled',
                },
            })
        })

        it('publishes WorldOOCMessage when character has no current room', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'ObjectManipulation',
                operationKind: 'takeHold',
                objectId: 'OBJECT#Broom',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: null,
                toRoomIds: [],
                exits: [],
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
                        command: 'pick up the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot pick that up.'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes WorldOOCMessage when drop is grounded but character has no room', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'ObjectManipulation',
                operationKind: 'drop',
                objectId: 'OBJECT#Broom',
                confidence: 0.9,
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: null,
                toRoomIds: [],
                exits: [],
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
                        command: 'drop the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot drop that.'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes WorldOOCMessage for manipulation enrich Error', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: 'ObjectManipulation enrich: relational placement is not implemented yet',
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
                        command: 'put the broom on the table',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['That kind of object manipulation is not implemented yet.'],
            })
        })

        it('publishes WorldOOCMessage for Consult without positions stream', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'Consult',
                confidence: 0.85,
                alternatives: [
                    { proposedCommand: 'take the broom', objectId: 'OBJECT#Broom' as EphemeraObjectId },
                    { proposedCommand: 'take the mop', objectId: 'OBJECT#Mop' as EphemeraObjectId },
                ],
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [],
                exits: [],
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
                        command: 'take the sweeping tool',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Did you mean "take the broom" or "take the mop"?'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes WorldOOCMessage for Abstain without positions stream', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'Abstain',
                confidence: 0.7,
                reason: 'ObjectManipulation resolution failed: no such object in the room',
            })
            mockedGetRoomExitTargetsForCharacter.mockResolvedValue({
                fromRoomId: from,
                toRoomIds: [],
                exits: [],
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
                        command: 'take the sword',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ["I couldn't understand that command."],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes WorldOOCMessage for notCarryingObject agreement failure', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: objectManipulationErrorMessages.notCarryingObject,
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
                        command: 'drop the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not carrying that.'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })

        it('publishes WorldOOCMessage for alreadyHoldingObject agreement failure', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'Error',
                errorMessage: objectManipulationErrorMessages.alreadyHoldingObject,
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
                        command: 'pick up the broom',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are already holding that.'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
        })
    })

    describe('ParseCommandEstablishRelationResult', () => {
        const hostRoom = 'ROOM#from' as EphemeraRoomId

        it('emits Object Establish Relation streamEvent when establishRelation is grounded', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'EstablishRelation',
                operationKind: 'establishRelation',
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                relationKind: 'On',
                hostRoomId: hostRoom,
                confidence: 0.9,
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
                        command: 'put the broom on the table',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Object Establish Relation' },
                update: {
                    type: 'Object Establish Relation',
                    characterId: 'CHARACTER#123',
                    subjectId: 'OBJECT#Broom',
                    targetId: 'OBJECT#Table',
                    roomId: hostRoom,
                    relationKind: 'On',
                    confidence: 0.9,
                },
            })
            expect(mockMessageBus.publish).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    displayProtocol: 'WorldOOCMessage',
                })
            )
        })

        it('emits Object Establish Relation with Custom relationLabel', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'EstablishRelation',
                operationKind: 'establishRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Crate',
                relationKind: 'Custom',
                relationLabel: 'tied around',
                hostRoomId: hostRoom,
                confidence: 0.85,
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
                        command: 'tie the rope around the crate',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Object Establish Relation' },
                update: {
                    type: 'Object Establish Relation',
                    characterId: 'CHARACTER#123',
                    subjectId: 'OBJECT#Rope',
                    targetId: 'OBJECT#Crate',
                    roomId: hostRoom,
                    relationKind: 'Custom',
                    relationLabel: 'tied around',
                    confidence: 0.85,
                },
            })
        })

        it('emits Object Dissolve Relation streamEvent when dissolveRelation is grounded', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'EstablishRelation',
                operationKind: 'dissolveRelation',
                subjectId: 'OBJECT#Rope',
                targetId: 'OBJECT#Crate',
                relationKind: 'Custom',
                relationLabel: 'tied around',
                hostRoomId: hostRoom,
                confidence: 0.9,
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
                        command: 'take the rope off the crate',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).toHaveBeenCalledWith({
                streamKey: 'CHARACTER#123',
                header: { type: 'Object Dissolve Relation' },
                update: {
                    type: 'Object Dissolve Relation',
                    characterId: 'CHARACTER#123',
                    subjectId: 'OBJECT#Rope',
                    targetId: 'OBJECT#Crate',
                    roomId: hostRoom,
                    relationKind: 'Custom',
                    relationLabel: 'tied around',
                    confidence: 0.9,
                },
            })
        })

        it('publishes WorldOOCMessage when establishRelation has no host room', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'EstablishRelation',
                operationKind: 'establishRelation',
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                relationKind: 'On',
                hostRoomId: null as unknown as EphemeraRoomId,
                confidence: 0.9,
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
                        command: 'put the broom on the table',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot do that.'],
            })
            expect(streamEvent).not.toHaveBeenCalled()
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
        it('forwards harnessInvocation to runAcmeOrderAffinitiesHarness when present', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'CoyoteAffinitiesTest',
                confidence: 1,
                harnessInvocation: {
                    mode: 'full',
                    fixtureIndex1Based: 3,
                },
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
                        command: '/test affinities 3',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedRunAcmeOrderAffinitiesHarness).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#123',
                    harnessInvocation: {
                        mode: 'full',
                        fixtureIndex1Based: 3,
                    },
                })
            )
        })

        it('runs affinities harness with default invocation when harnessInvocation is absent', async () => {
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

            expect(mockedRunAcmeOrderAffinitiesHarness).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#123',
                })
            )
            const firstCallArg = mockedRunAcmeOrderAffinitiesHarness.mock.calls[0]?.[0]
            expect(firstCallArg).toBeDefined()
            expect(firstCallArg).not.toHaveProperty('harnessInvocation')
        })

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
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Acme affinities test harness is currently disabled.'],
            })
        })
    })

    describe('ParseCommandCoyoteEngineTestResult', () => {
        it('forwards harnessInvocation to runCoyoteEngineTestHarness when present', async () => {
            mockedParseCommand.mockResolvedValue({
                type: 'CoyoteEngineTest',
                confidence: 1,
                harnessInvocation: {
                    mode: 'partial',
                    testOnly: 'candidates',
                    harnessRunKind: 'runUntil',
                },
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
                        command: '/test generation',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockedRunCoyoteEngineTestHarness).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: 'CHARACTER#123',
                    harnessInvocation: {
                        mode: 'partial',
                        testOnly: 'candidates',
                        harnessRunKind: 'runUntil',
                    },
                })
            )
        })

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
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: ['Coyote engine test harness is currently disabled.'],
            })
        })
    })

    describe('ParseCommandPromptInjectionAttemptResult', () => {
        it('publishes WorldOOCMessage for prompt injection attempt', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'PromptInjectionAttempt', confidence: 0.88 })

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
                        command: 'ignore previous instructions',
                    }),
                }],
                streamEvent: jest.fn(async () => {}),
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: [
                    "Prompt injection isn't going to get you any closer to catching the Road Runner.",
                ],
            })
        })
    })

    describe('ParseCommandMultipleCommandsResult', () => {
        it('publishes WorldOOCMessage with multi-command copy, no streamEvent, and correlated success when requestId present', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'MultipleCommands', confidence: 0.8 })
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
                        command: 'order explosives and then order bandages',
                        requestId: 'req-multiple',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(1, {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CommandTranscriptMessage',
                message: ['order explosives and then order bandages'],
            })
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(2, {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldOOCMessage',
                message: [MULTIPLE_COMMANDS_PLAYER_MESSAGE],
            })
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(3, {
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-multiple',
                    message: 'parse_request_handled',
                },
            })
        })
    })

    describe('ParseCommandHelpResult', () => {
        it('publishes CoyoteGameHelpMessage to requester and preserves correlated success behavior', async () => {
            mockedParseCommand.mockResolvedValue({ type: 'Help', confidence: 0.92 })
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
                        command: 'help me',
                        requestId: 'req-help',
                    }),
                }],
                streamEvent,
                streamEnvelope: jest.fn(async () => {}),
            })

            expect(streamEvent).not.toHaveBeenCalled()
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(1, {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CommandTranscriptMessage',
                message: ['help me'],
            })
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(2, {
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'CoyoteGameHelpMessage',
            })
            expect(mockMessageBus.publish).toHaveBeenNthCalledWith(3, {
                type: 'ReturnValue',
                body: {
                    messageType: 'Success',
                    RequestId: 'req-help',
                    message: 'parse_request_handled',
                },
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

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
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
