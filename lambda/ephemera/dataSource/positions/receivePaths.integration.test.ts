/**
 * Cross-layer integration: positions DataSource receiveEvents routes all ingress
 * envelopes through the real messageBus subscription wiring.
 */
jest.mock('./membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

jest.mock('./membership/resolveConnectTargetRoom', () => ({
    resolveConnectTargetRoom: jest.fn(),
}))

jest.mock('./membership/repairRoomOccupancyDrift', () => ({
    repairRoomOccupancyDrift: jest.fn(),
}))

jest.mock('./membership/orchestrateCharacterDisconnect', () => ({
    orchestrateCharacterDisconnect: jest.fn(),
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        Positions: { getMembershipContainers: jest.fn() },
    },
}))

jest.mock('./navigate/executeCharacterNavigate', () => ({
    executeCharacterNavigate: jest.fn(),
}))

jest.mock('./manipulation/membership/orchestrateObjectMove', () => ({
    orchestrateObjectMove: jest.fn(),
}))

jest.mock('./manipulation/relational/executeObjectEstablishRelation', () => ({
    executeEstablishEdgeChain: jest.fn(),
}))

jest.mock('./manipulation/relational/executeObjectDissolveRelation', () => ({
    executeObjectDissolveRelation: jest.fn(),
}))

import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { applyCharacterRoomMembership } from './membership/applyCharacterRoomMembership'
import { resolveConnectTargetRoom } from './membership/resolveConnectTargetRoom'
import { repairRoomOccupancyDrift } from './membership/repairRoomOccupancyDrift'
import { orchestrateCharacterDisconnect } from './membership/orchestrateCharacterDisconnect'
import { executeCharacterNavigate } from './navigate/executeCharacterNavigate'
import { orchestrateObjectMove } from './manipulation/membership/orchestrateObjectMove'
import { executeEstablishEdgeChain } from './manipulation/relational/executeObjectEstablishRelation'
import { executeObjectDissolveRelation } from './manipulation/relational/executeObjectDissolveRelation'

import './index'

const applyCharacterRoomMembershipMock = applyCharacterRoomMembership as jest.MockedFunction<
    typeof applyCharacterRoomMembership
>
const resolveConnectTargetRoomMock = resolveConnectTargetRoom as jest.MockedFunction<
    typeof resolveConnectTargetRoom
>
const repairRoomOccupancyDriftMock = repairRoomOccupancyDrift as jest.MockedFunction<
    typeof repairRoomOccupancyDrift
>
const orchestrateCharacterDisconnectMock = orchestrateCharacterDisconnect as jest.MockedFunction<
    typeof orchestrateCharacterDisconnect
>
const characterMetaGetMock = internalCache.CharacterMeta.get as jest.MockedFunction<
    typeof internalCache.CharacterMeta.get
>
const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const executeCharacterNavigateMock = executeCharacterNavigate as jest.MockedFunction<
    typeof executeCharacterNavigate
>
const orchestrateObjectMoveMock = orchestrateObjectMove as jest.MockedFunction<
    typeof orchestrateObjectMove
>
const executeEstablishEdgeChainMock = executeEstablishEdgeChain as jest.MockedFunction<
    typeof executeEstablishEdgeChain
>
const executeObjectDissolveRelationMock = executeObjectDissolveRelation as jest.MockedFunction<
    typeof executeObjectDissolveRelation
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
        applyCharacterRoomMembershipMock.mockResolvedValue({
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
        executeCharacterNavigateMock.mockResolvedValue({
            ok: true,
            froms: [ROOM_A],
            to: ROOM_A,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        orchestrateObjectMoveMock.mockResolvedValue(undefined)
        getMembershipContainersMock.mockResolvedValue([ROOM_A])
        repairRoomOccupancyDriftMock.mockResolvedValue({ ghostsPurged: 0, adjacencySynced: 0 })
        orchestrateCharacterDisconnectMock.mockResolvedValue(undefined)
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
        it('routes mtw.connections.characters disconnect through membership apply', async () => {
            publishPositionsStreamingEvent('mtw.connections.characters', 'Character Disconnected', {
                type: 'Character Disconnected',
                characterId: CHARACTER_ID,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })

            await messageBus.flushAndSettle()

            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: null,
                    narrationHandledInline: true,
                    compileMutationSteps: expect.any(Function),
                }),
                expect.objectContaining({ messageBus: expect.any(Object), streamEvent: expect.any(Function) })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })
    })

    describe('Character Connected', () => {
        it('routes mtw.connections.characters connect through resolve + membership apply', async () => {
            publishPositionsStreamingEvent('mtw.connections.characters', 'Character Connected', {
                type: 'Character Connected',
                characterId: CHARACTER_ID,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            })

            await messageBus.flushAndSettle()

            expect(resolveConnectTargetRoomMock).toHaveBeenCalledWith(CHARACTER_ID)
            expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: ROOM_A,
                    narrationHandledInline: true,
                    compileMutationSteps: expect.any(Function),
                }),
                expect.objectContaining({ messageBus: expect.any(Object), streamEvent: expect.any(Function) })
            )
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })
    })

    describe('Character Navigate', () => {
        it('routes mtw.ephemera.actions navigate through executeCharacterNavigate', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Character Navigate', {
                type: 'Character Navigate',
                characterId: CHARACTER_ID,
                fromRoomId: ROOM_A,
                toRoomId: 'ROOM#Market',
            })

            await messageBus.flushAndSettle()

            expect(executeCharacterNavigateMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: 'ROOM#Market',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
        })
    })

    describe('Character Home', () => {
        it('routes mtw.ephemera.actions home through executeCharacterNavigate', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Character Home', {
                type: 'Character Home',
                characterId: CHARACTER_ID,
                fromRoomId: ROOM_A,
                toRoomId: 'ROOM#VORTEX',
            })

            await messageBus.flushAndSettle()

            expect(executeCharacterNavigateMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    targetRoomId: 'ROOM#VORTEX',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Take Hold', () => {
        it('routes mtw.ephemera.actions Object Take Hold through orchestrateObjectMove as room -> character', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Take Hold', {
                type: 'Object Take Hold',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Broom'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            // Direction lives only here, as the host pair --- take-hold is room -> character.
            expect(orchestrateObjectMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    objectIds: ['OBJECT#Broom'],
                    fromHostId: ROOM_A,
                    toHostId: CHARACTER_ID,
                    characterId: CHARACTER_ID,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })

        it('resolves fromHostId fresh (not content.roomId) so a nested object can be taken (put cup on table, then get cup)', async () => {
            // Reproduces a production bug: `content.roomId` is the character's room, not
            // necessarily the object's current host once objects can nest inside other objects
            // (PV1-2). A cup left `On` a table is a node of the table's own graph, not the
            // room's --- trusting `content.roomId` as `fromHostId` sent a stale source host into
            // `commitStepSequence`, which threw `staleTransferCandidate` at commit time.
            getMembershipContainersMock.mockResolvedValue(['OBJECT#Table' as any])

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Take Hold', {
                type: 'Object Take Hold',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Cup'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(getMembershipContainersMock).toHaveBeenCalledWith('OBJECT#Cup')
            expect(orchestrateObjectMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    objectIds: ['OBJECT#Cup'],
                    fromHostId: 'OBJECT#Table',
                    toHostId: CHARACTER_ID,
                    roomId: ROOM_A,
                    characterId: CHARACTER_ID,
                })
            )
        })

        it('does not call orchestrateObjectMove when the object has no single current host (drift)', async () => {
            getMembershipContainersMock.mockResolvedValue([])

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Take Hold', {
                type: 'Object Take Hold',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Cup'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(orchestrateObjectMoveMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Drop', () => {
        it('routes mtw.ephemera.actions Object Drop through orchestrateObjectMove as character -> room', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Drop', {
                type: 'Object Drop',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Broom'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            // Same execution path as take-hold; only the host pair is reversed, which is
            // the whole of the take-vs-drop distinction after Phase 3.6's unification.
            expect(orchestrateObjectMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    objectIds: ['OBJECT#Broom'],
                    fromHostId: CHARACTER_ID,
                    toHostId: ROOM_A,
                    characterId: CHARACTER_ID,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Rehost', () => {
        it('routes mtw.ephemera.actions Object Rehost through orchestrateObjectMove with a freshly-resolved fromHostId (PV1-2)', async () => {
            getMembershipContainersMock.mockResolvedValue([ROOM_A])

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Rehost', {
                type: 'Object Rehost',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Cup',
                targetId: 'OBJECT#Tray',
                roomId: ROOM_A,
                containment: 'On',
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(getMembershipContainersMock).toHaveBeenCalledWith('OBJECT#Cup')
            // fromHostId comes from the fresh getMembershipContainers lookup, not the
            // published event --- the event carries no fromHostId field at all.
            expect(orchestrateObjectMoveMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    objectIds: ['OBJECT#Cup'],
                    fromHostId: ROOM_A,
                    toHostId: 'OBJECT#Tray',
                    roomId: ROOM_A,
                    // The bug this proves fixed: neither fromHostId (a room) nor toHostId (an
                    // object) is a character, so orchestrateObjectMove can no longer derive one
                    // from the hosts --- it must be threaded through explicitly instead.
                    characterId: CHARACTER_ID,
                    containment: 'On',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(executeEstablishEdgeChainMock).not.toHaveBeenCalled()
        })

        it('does not call orchestrateObjectMove when the subject has no single current host (drift)', async () => {
            getMembershipContainersMock.mockResolvedValue([])

            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Rehost', {
                type: 'Object Rehost',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Cup',
                targetId: 'OBJECT#Tray',
                roomId: ROOM_A,
                containment: 'On',
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(orchestrateObjectMoveMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Establish Relation', () => {
        it('routes mtw.ephemera.actions Object Establish Relation through executeEstablishEdgeChain (PV1-3b-2)', async () => {
            const steps = [{
                kind: 'establishRelation',
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                relationKind: 'Under',
                hostId: ROOM_A,
            }]
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Establish Relation', {
                type: 'Object Establish Relation',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                hostId: ROOM_A,
                relationKind: 'Under',
                confidence: 0.9,
                steps,
            })

            await messageBus.flushAndSettle()

            expect(executeEstablishEdgeChainMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    steps,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(executeObjectDissolveRelationMock).not.toHaveBeenCalled()
        })

        it('routes a genuine crossing (PV1-0\'s tie string to cup shape) through executeEstablishEdgeChain with every step intact', async () => {
            const steps = [
                {
                    kind: 'addCrossingPort',
                    hostId: 'OBJECT#Table',
                    port: { portId: 'p1', fromHostId: ROOM_A, kind: 'Custom', exteriorRelationLabel: 'tied to' },
                },
                {
                    kind: 'establishRelation',
                    subjectId: 'OBJECT#String',
                    targetId: { owner: 'OBJECT#Table', port: 'p1' },
                    relationKind: 'Custom',
                    relationLabel: 'tied to',
                    hostId: ROOM_A,
                },
                {
                    kind: 'establishRelation',
                    subjectId: { owner: 'OBJECT#Table', port: 'p1' },
                    targetId: 'OBJECT#Cup',
                    relationKind: 'Custom',
                    relationLabel: 'tied to',
                    hostId: 'OBJECT#Table',
                },
            ]
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Establish Relation', {
                type: 'Object Establish Relation',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#String',
                targetId: 'OBJECT#Cup',
                hostId: 'OBJECT#Table',
                relationKind: 'Custom',
                relationLabel: 'tied to',
                confidence: 0.9,
                steps,
            })

            await messageBus.flushAndSettle()

            expect(executeEstablishEdgeChainMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    steps,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
        })
    })

    describe('Object Dissolve Relation', () => {
        it('routes mtw.ephemera.actions Object Dissolve Relation through executeObjectDissolveRelation', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Dissolve Relation', {
                type: 'Object Dissolve Relation',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                hostId: ROOM_A,
                relationKind: 'Under',
                steps: [{
                    kind: 'dissolveRelation',
                    subjectId: 'OBJECT#Broom',
                    targetId: 'OBJECT#Table',
                    relationKind: 'Under',
                    hostId: ROOM_A,
                }],
            })

            await messageBus.flushAndSettle()

            expect(executeObjectDissolveRelationMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    subjectId: 'OBJECT#Broom',
                    targetId: 'OBJECT#Table',
                    hostId: ROOM_A,
                    relationKind: 'Under',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(executeEstablishEdgeChainMock).not.toHaveBeenCalled()
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
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })
    })
})
