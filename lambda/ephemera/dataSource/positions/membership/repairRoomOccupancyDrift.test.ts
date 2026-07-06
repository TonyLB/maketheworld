jest.mock('./applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))

jest.mock('./syncMembershipAdjacency', () => ({
    syncMembershipAdjacencyToRoom: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testPositionGraph } from '../positionGraph/testFixtures'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'
import { repairRoomOccupancyDrift } from './repairRoomOccupancyDrift'

const ROOM_ID = 'ROOM#alpha' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#one' as EphemeraCharacterId
const OTHER_ROOM = 'ROOM#other' as EphemeraRoomId

const graphWithCharacter = testPositionGraph(ROOM_ID, {
    nodes: [{ tag: 'Character' as const, universalKey: CHARACTER_ID }],
})

describe('repairRoomOccupancyDrift', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const applyMembershipMock = applyCharacterRoomMembership as jest.MockedFunction<typeof applyCharacterRoomMembership>
    const syncAdjacencyMock = syncMembershipAdjacencyToRoom as jest.MockedFunction<typeof syncMembershipAdjacencyToRoom>

    const getPositionGraph = jest.fn()
    const getCharacterSessions = jest.fn()
    const getMembershipContainers = jest.fn()

    const runRepair = () => repairRoomOccupancyDrift(
        { roomId: ROOM_ID, messageBus: messageBus as any, streamEvent },
        { getPositionGraph, getCharacterSessions, getMembershipContainers }
    )

    beforeEach(() => {
        jest.clearAllMocks()
        getPositionGraph.mockResolvedValue(graphWithCharacter)
    })

    it('purges ghost characters with no live sessions via disconnect apply', async () => {
        getCharacterSessions.mockResolvedValue([])
        applyMembershipMock.mockResolvedValue({
            ok: true,
            froms: [ROOM_ID],
            to: null,
            changed: true,
        })

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 1, adjacencySynced: 0 })
        expect(applyMembershipMock).toHaveBeenCalledWith(
            { characterId: CHARACTER_ID, targetRoomId: null },
            { messageBus, streamEvent }
        )
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
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
            characterId: CHARACTER_ID,
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
        getPositionGraph.mockResolvedValue(graphWithCharacter)
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([ROOM_ID])

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(applyMembershipMock).not.toHaveBeenCalled()
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
    })

    it('does nothing when room graph has no character nodes', async () => {
        getPositionGraph.mockResolvedValue(testPositionGraph(ROOM_ID))

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
