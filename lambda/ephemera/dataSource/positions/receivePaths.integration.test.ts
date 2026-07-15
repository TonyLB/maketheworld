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

jest.mock('./navigate/executeCharacterNavigate', () => ({
    executeCharacterNavigate: jest.fn(),
}))

jest.mock('./manipulation/membership/executeObjectTakeHold', () => ({
    executeObjectTakeHold: jest.fn(),
}))

jest.mock('./manipulation/membership/executeObjectDrop', () => ({
    executeObjectDrop: jest.fn(),
}))

jest.mock('./manipulation/relational/executeObjectEstablishRelation', () => ({
    executeObjectEstablishRelation: jest.fn(),
}))

jest.mock('./manipulation/relational/executeObjectDissolveRelation', () => ({
    executeObjectDissolveRelation: jest.fn(),
}))

import messageBus from '../../messageBus'
import { applyCharacterRoomMembership } from './membership/applyCharacterRoomMembership'
import { resolveConnectTargetRoom } from './membership/resolveConnectTargetRoom'
import { repairRoomOccupancyDrift } from './membership/repairRoomOccupancyDrift'
import { executeCharacterNavigate } from './navigate/executeCharacterNavigate'
import { executeObjectTakeHold } from './manipulation/membership/executeObjectTakeHold'
import { executeObjectDrop } from './manipulation/membership/executeObjectDrop'
import { executeObjectEstablishRelation } from './manipulation/relational/executeObjectEstablishRelation'
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
const executeCharacterNavigateMock = executeCharacterNavigate as jest.MockedFunction<
    typeof executeCharacterNavigate
>
const executeObjectTakeHoldMock = executeObjectTakeHold as jest.MockedFunction<
    typeof executeObjectTakeHold
>
const executeObjectDropMock = executeObjectDrop as jest.MockedFunction<
    typeof executeObjectDrop
>
const executeObjectEstablishRelationMock = executeObjectEstablishRelation as jest.MockedFunction<
    typeof executeObjectEstablishRelation
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
        executeObjectTakeHoldMock.mockResolvedValue(undefined)
        executeObjectDropMock.mockResolvedValue(undefined)
        repairRoomOccupancyDriftMock.mockResolvedValue({ ghostsPurged: 0, adjacencySynced: 0 })
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
                { characterId: CHARACTER_ID, targetRoomId: null },
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
                { characterId: CHARACTER_ID, targetRoomId: ROOM_A },
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
        it('routes mtw.ephemera.actions Object Take Hold through executeObjectTakeHold', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Take Hold', {
                type: 'Object Take Hold',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Broom'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(executeObjectTakeHoldMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    objectIds: ['OBJECT#Broom'],
                    roomId: ROOM_A,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Drop', () => {
        it('routes mtw.ephemera.actions Object Drop through executeObjectDrop', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Drop', {
                type: 'Object Drop',
                characterId: CHARACTER_ID,
                objectIds: ['OBJECT#Broom'],
                roomId: ROOM_A,
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(executeObjectDropMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    objectIds: ['OBJECT#Broom'],
                    roomId: ROOM_A,
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(resolveConnectTargetRoomMock).not.toHaveBeenCalled()
            expect(applyCharacterRoomMembershipMock).not.toHaveBeenCalled()
            expect(executeCharacterNavigateMock).not.toHaveBeenCalled()
            expect(executeObjectTakeHoldMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Establish Relation', () => {
        it('routes mtw.ephemera.actions Object Establish Relation through executeObjectEstablishRelation', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Establish Relation', {
                type: 'Object Establish Relation',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                roomId: ROOM_A,
                relationKind: 'On',
                confidence: 0.9,
            })

            await messageBus.flushAndSettle()

            expect(executeObjectEstablishRelationMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    subjectId: 'OBJECT#Broom',
                    targetId: 'OBJECT#Table',
                    roomId: ROOM_A,
                    relationKind: 'On',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(executeObjectDissolveRelationMock).not.toHaveBeenCalled()
        })
    })

    describe('Object Dissolve Relation', () => {
        it('routes mtw.ephemera.actions Object Dissolve Relation through executeObjectDissolveRelation', async () => {
            publishPositionsStreamingEvent('mtw.ephemera.actions', 'Object Dissolve Relation', {
                type: 'Object Dissolve Relation',
                characterId: CHARACTER_ID,
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                roomId: ROOM_A,
                relationKind: 'On',
            })

            await messageBus.flushAndSettle()

            expect(executeObjectDissolveRelationMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    characterId: CHARACTER_ID,
                    subjectId: 'OBJECT#Broom',
                    targetId: 'OBJECT#Table',
                    roomId: ROOM_A,
                    relationKind: 'On',
                    messageBus: expect.any(Object),
                    streamEvent: expect.any(Function),
                })
            )
            expect(executeObjectEstablishRelationMock).not.toHaveBeenCalled()
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
