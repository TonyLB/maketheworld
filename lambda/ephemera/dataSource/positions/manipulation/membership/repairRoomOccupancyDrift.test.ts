jest.mock('./orchestrateCharacterRoomMembership', () => ({
    orchestrateCharacterRoomMembership: jest.fn(),
}))

jest.mock('./syncMembershipAdjacency', () => ({
    syncMembershipAdjacencyToRoom: jest.fn(),
}))

jest.mock('../../navigate/presentCharacterMove', () => ({
    presentCharacterMove: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import { orchestrateCharacterRoomMembership } from './orchestrateCharacterRoomMembership'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'
import { presentCharacterMove } from '../../navigate/presentCharacterMove'
import { repairRoomOccupancyDrift } from './repairRoomOccupancyDrift'

const ROOM_ID = 'ROOM#alpha' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#one' as EphemeraCharacterId
const OTHER_ROOM = 'ROOM#other' as EphemeraRoomId

const graphWithCharacter = testLudicGraph(ROOM_ID, {
    nodes: [{ tag: 'Character' as const, universalKey: CHARACTER_ID }],
})

describe('repairRoomOccupancyDrift', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const applyMembershipMock = orchestrateCharacterRoomMembership as jest.MockedFunction<typeof orchestrateCharacterRoomMembership>
    const syncAdjacencyMock = syncMembershipAdjacencyToRoom as jest.MockedFunction<typeof syncMembershipAdjacencyToRoom>
    const presentCharacterMoveMock = presentCharacterMove as jest.MockedFunction<typeof presentCharacterMove>

    const getLudicGraph = jest.fn()
    const getCharacterSessions = jest.fn()
    const getMembershipContainers = jest.fn()

    const runRepair = () => repairRoomOccupancyDrift(
        { roomId: ROOM_ID, messageBus: messageBus as any, streamEvent },
        { getLudicGraph, getCharacterSessions, getMembershipContainers }
    )

    beforeEach(() => {
        jest.clearAllMocks()
        getLudicGraph.mockResolvedValue(graphWithCharacter)
    })

    it('purges ghost characters with no live sessions via disconnect apply, and narrates identically to a real disconnect', async () => {
        getCharacterSessions.mockResolvedValue([])
        const plan = { steps: [], slots: [] }
        applyMembershipMock.mockResolvedValue({
            ok: true,
            froms: [ROOM_ID],
            to: null,
            changed: true,
            captures: new Map([['capture:from:ROOM#alpha', [CHARACTER_ID]]]),
            plan,
        })

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 1, adjacencySynced: 0 })
        expect(applyMembershipMock).toHaveBeenCalledWith(
            expect.objectContaining({
                characterId: CHARACTER_ID,
                targetRoomId: null,
                intentKind: 'disconnect',
            }),
            { messageBus, streamEvent }
        )
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
        expect(presentCharacterMoveMock).toHaveBeenCalledWith(
            expect.objectContaining({
                characterId: CHARACTER_ID,
                to: null,
                plan,
                messageBus,
            })
        )
    })

    it('does not count ghost purge when disconnect is a no-op', async () => {
        getCharacterSessions.mockResolvedValue([])
        applyMembershipMock.mockResolvedValue({
            ok: true,
            froms: [],
            to: null,
            changed: false,
        })

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
    })

    it('syncs adjacency only when in-play but missing roomId in containers', async () => {
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([])
        syncAdjacencyMock.mockResolvedValue({ synced: true })

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 1 })
        expect(syncAdjacencyMock).toHaveBeenCalledWith({
            componentId: CHARACTER_ID,
            roomId: ROOM_ID,
        })
        expect(applyMembershipMock).not.toHaveBeenCalled()
    })

    it('syncs adjacency when containers point at a different room', async () => {
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([OTHER_ROOM])
        syncAdjacencyMock.mockResolvedValue({ synced: true })

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 1 })
        expect(syncAdjacencyMock).toHaveBeenCalled()
        expect(applyMembershipMock).not.toHaveBeenCalled()
    })

    it('does nothing for a clean room', async () => {
        getLudicGraph.mockResolvedValue(graphWithCharacter)
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([ROOM_ID])

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(applyMembershipMock).not.toHaveBeenCalled()
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
    })

    it('does nothing when room graph has no character nodes', async () => {
        getLudicGraph.mockResolvedValue(testLudicGraph(ROOM_ID))

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(getCharacterSessions).not.toHaveBeenCalled()
    })

    it('is idempotent on second invocation when already repaired', async () => {
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([ROOM_ID])
        syncAdjacencyMock.mockResolvedValue({ synced: false })

        const first = await runRepair()
        const second = await runRepair()

        expect(first).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(second).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
    })
})
