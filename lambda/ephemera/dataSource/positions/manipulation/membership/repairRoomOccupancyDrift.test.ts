jest.mock('../../navigate/orchestrateCharacterMove', () => ({
    orchestrateCharacterMove: jest.fn(),
}))

jest.mock('./syncMembershipAdjacency', () => ({
    syncMembershipAdjacencyToRoom: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orchestrateCharacterMove } from '../../navigate/orchestrateCharacterMove'
import { syncMembershipAdjacencyToRoom } from './syncMembershipAdjacency'
import { repairRoomOccupancyDrift } from './repairRoomOccupancyDrift'

const ROOM_ID = 'ROOM#alpha' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#one' as EphemeraCharacterId
const OTHER_ROOM = 'ROOM#other' as EphemeraRoomId

describe('repairRoomOccupancyDrift', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const applyMembershipMock = orchestrateCharacterMove as jest.MockedFunction<typeof orchestrateCharacterMove>
    const syncAdjacencyMock = syncMembershipAdjacencyToRoom as jest.MockedFunction<typeof syncMembershipAdjacencyToRoom>

    const getRoomCharacters = jest.fn()
    const getCharacterSessions = jest.fn()
    const getMembershipContainers = jest.fn()

    const runRepair = () => repairRoomOccupancyDrift(
        { roomId: ROOM_ID, messageBus: messageBus as any, streamEvent },
        { getRoomCharacters, getCharacterSessions, getMembershipContainers }
    )

    beforeEach(() => {
        jest.clearAllMocks()
        getRoomCharacters.mockResolvedValue([CHARACTER_ID])
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
            expect.objectContaining({
                characterId: CHARACTER_ID,
                targetRoomId: null,
                intentKind: 'disconnect',
                messageBus,
                streamEvent,
            })
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
        getRoomCharacters.mockResolvedValue([CHARACTER_ID])
        getCharacterSessions.mockResolvedValue(['sess-1'])
        getMembershipContainers.mockResolvedValue([ROOM_ID])

        const result = await runRepair()

        expect(result).toEqual({ ghostsPurged: 0, adjacencySynced: 0 })
        expect(applyMembershipMock).not.toHaveBeenCalled()
        expect(syncAdjacencyMock).not.toHaveBeenCalled()
    })

    it('does nothing when the characters row lists nobody', async () => {
        getRoomCharacters.mockResolvedValue([])

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
