/**
 * Cross-layer integration: positions DataSource receiveEvents routes all ingress
 * envelopes through the real messageBus subscription wiring.
 */
jest.mock('./navigate/orchestrateCharacterMove', () => ({
    orchestrateCharacterMove: jest.fn(),
}))

jest.mock('./manipulation/membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

jest.mock('./manipulation/membership/repairRoomOccupancyDrift', () => ({
    repairRoomOccupancyDrift: jest.fn(),
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        Positions: { getMembershipContainers: jest.fn() },
    },
}))

jest.mock('./manipulation/membership/orchestrateObjectMove', () => ({
    orchestrateObjectMove: jest.fn(),
}))

jest.mock('./manipulation/commitAttempt', () => ({
    commitAttempt: jest.fn(),
}))

import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { orchestrateCharacterMove } from './navigate/orchestrateCharacterMove'
import { resolveConnectTargetRoom } from './manipulation/membership/resolveConnectTargetRoom'
import { repairRoomOccupancyDrift } from './manipulation/membership/repairRoomOccupancyDrift'
import { orchestrateObjectMove } from './manipulation/membership/orchestrateObjectMove'
import { commitAttempt } from './manipulation/commitAttempt'
import { CommandAttempt, type CommandAttemptData } from '../actions/commandAttempt'

import './index'

const orchestrateCharacterMoveMock = orchestrateCharacterMove as jest.MockedFunction<
    typeof orchestrateCharacterMove
>
const resolveConnectTargetRoomMock = resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnectTargetRoom
>
const repairRoomOccupancyDriftMock = repairRoomOccupancyDrift as jest.MockedFunction<
    typeof repairRoomOccupancyDrift
>
const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
>
const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const orchestrateObjectMoveMock = orchestrateObjectMove as jest.MockedFunction<
    typeof orchestrateObjectMove
>
const commitAttemptMock = commitAttempt as jest.MockedFunction<
    typeof commitAttempt
>

const CHARACTER_ID = 'CHARACTER#alpha' as const
const ROOM_A = 'ROOM#TownSquare' as const

const publishPositionsStreamingEvent = (
    dataSourceKey: string,
    type: string,
    content: object
): void => {
    const ts = Date.now()
    messageBus.publish({
        type: 'StreamingEvent',
        dataSourceKey,
        streamKey: CHARACTER_ID,
        timestamp: ts,
        header: {
            dataSourceKey,
            streamKey: CHARACTER_ID,
            timestamp: ts,
            type,
        },
        getContent: () => Promise.resolve(content),
    })
}

describe('positions receive paths (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        orchestrateCharacterMoveMock.mockResolvedValue({
            ok: true,
            froms: [ROOM_A],
            to: null,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        resolveConnectTargetRoomMock.mockResolvedValue({
            targetRoomId: ROOM_A,
            characterMeta: {
                EphemeraId: CHARACTER_ID,
                Name: 'Alpha',
                RoomId: ROOM_A,
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
                HomeId: 'ROOM#VORTEX',
                assets: [],
                Pronouns: 'they/them',
            },
            trimmedRoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
        })
        orchestrateObjectMoveMock.mockResolvedValue(undefined)
        commitAttemptMock.mockResolvedValue(undefined)
        getMembershipContainersMock.mockResolvedValue([ROOM_A])
        repairRoomOccupancyDriftMock.mockResolvedValue({ ghostsPurged: 0, adjacencySynced: 0 })
        characterMetaGetMock.mockResolvedValue({
            EphemeraId: CHARACTER_ID,
            Name: 'Alpha',
            RoomId: ROOM_A,
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: 'they/them',
        } as any)
    })

    describe('Character Disconnected', () => {
        it('routes mtw.connections.characters disconnect through orchestrateCharacterMove', async () => {
            publishPositionsStreamingEvent('mtw.connections.characters', 'Character Disconnected', {
                type: 'Character Disconnected',
                characterId: CHARACTER_ID,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })

            await messageBus.flushAndSettle()

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: null,
                    intentKind: 'disconnect',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
        })
    })

    describe('Character Connected', () => {
        it('routes mtw.connections.characters connect through resolve + orchestrateCharacterMove', async () => {
            publishPositionsStreamingEvent('mtw.connections.characters', 'Character Connected', {
                type: 'Character Connected',
                characterId: CHARACTER_ID,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })

            await messageBus.flushAndSettle()

            expect(resolveConnectTargetRoomMock).toHaveBeenCalledWith(CHARACTER_ID)
            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: ROOM_A,
                    intentKind: 'connect',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
        })
    })

    describe('Character Navigate', () => {
        it('routes mtw.ephemera.actions navigate through orchestrateCharacterMove', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Character Navigate', {
                type: 'Character Navigate',
                characterId: CHARACTER_ID,
                fromRoomId: ROOM_A,
                toRoomId: 'ROOM#Market',
            })

            await messageBus.flushAndSettle()

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: 'ROOM#Market',
                    intentKind: 'navigate',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
        })
    })

    describe('Character Home', () => {
        it('routes mtw.ephemera.actions home through orchestrateCharacterMove', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Character Home', {
                type: 'Character Home',
                characterId: CHARACTER_ID,
                fromRoomId: ROOM_A,
                toRoomId: 'ROOM#VORTEX',
            })

            await messageBus.flushAndSettle()

            expect(orchestrateCharacterMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: 'ROOM#VORTEX',
                    intentKind: 'home',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
        })
    })

    describe('Ludic Network Change Requested', () => {
        it('routes the generalized hand-off through commitAttempt (AP-9, replacing Object Take Hold/Drop/Establish Relation/Dissolve Relation)', async () => {
            const attemptData: CommandAttemptData = {
                words: 'pick up the broom',
                referents: [{ refKey: 'primaryObject', id: 'OBJECT#Broom', shortName: 'broom' }],
                actions: [{ kind: 'position', desiredResultDescription: 'Take: broom', challenges: [] }],
            }

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Ludic Network Change Requested', {
                type: 'Ludic Network Change Requested',
                characterId: CHARACTER_ID,
                attempt: attemptData,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(commitAttemptMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attempt: expect.any(CommandAttempt),
                    characterId: CHARACTER_ID,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
            expect(orchestrateObjectMoveMock).not.toHaveBeenCalled()
        })

        it('a published attempt round-trips through fromJSON and reaches commitAttempt with its actions, challenges and verdicts intact', async () => {
            const attemptData: CommandAttemptData = {
                words: 'take the entire coil of rope',
                referents: [{ refKey: 'primaryObject', id: 'OBJECT#Rope', shortName: 'rope' }],
                actions: [
                    { kind: 'position', desiredResultDescription: 'Take: rope', challenges: [] },
                    {
                        kind: 'position',
                        desiredResultDescription: 'Dissolve: is lashed to',
                        challenges: [
                            {
                                kind: 'customEdge',
                                id: 'challenge-1',
                                edge: { from: 'OBJECT#Rope', to: 'OBJECT#Post', kind: 'Custom', relationLabel: 'is lashed to' },
                                description: 'Boundary relation to dissolve: is lashed to.',
                                verdict: { kind: 'met' },
                            },
                        ],
                    },
                ],
            }

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Ludic Network Change Requested', {
                type: 'Ludic Network Change Requested',
                characterId: CHARACTER_ID,
                attempt: attemptData,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(commitAttemptMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    attempt: expect.any(CommandAttempt),
                })
            )
            const [call] = commitAttemptMock.mock.calls
            const attempt = call?.[0].attempt as CommandAttempt
            expect(attempt.words).toBe('take the entire coil of rope')
            expect(attempt.actions()).toHaveLength(2)
            expect(attempt.actions()[1]?.challenges()).toHaveLength(1)
            expect(attempt.actions()[1]?.challenges()[0]?.describe()).toBe('Boundary relation to dissolve: is lashed to.')
            // Adjudicate ran actions-side; positions only reconstructs, so the met verdict arrives
            // as published and its edge is what the commit side will honor.
            expect(attempt.result.status).toBe('succeeded')
            expect(attempt.metPropagations()).toEqual([
                { from: 'OBJECT#Rope', to: 'OBJECT#Post', kind: 'Custom', relationLabel: 'is lashed to' },
            ])
        })
    })

    describe('Room Occupancy Drift Finding', () => {
        it('routes mtw.diagnostics finding through repairRoomOccupancyDrift', async () => {
            publishPositionsStreamingEvent('mtw.diagnostics', 'Room Occupancy Drift Finding', {
                type: 'Room Occupancy Drift Finding',
                roomId: ROOM_A,
                diagnosticRunId: 'diag-1',
                timestamp: '2026-05-06T10:00:00.000Z',
            })

            await messageBus.flushAndSettle()

            expect(repairRoomOccupancyDriftMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_A,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(orchestrateCharacterMoveMock).not.toHaveBeenCalled()
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
        })
    })
})
