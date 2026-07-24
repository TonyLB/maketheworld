jest.mock('./applyObjectRoomMembership', () => ({
    applyObjectRoomMembership: jest.fn(),
}))

jest.mock('./syncObjectMembershipAdjacency', () => ({
    syncObjectMembershipAdjacencyToRoom: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testPositionGraph } from '../positionGraph/testFixtures'
import { applyObjectRoomMembership } from './applyObjectRoomMembership'
import { repairObjectPlacementDrift } from './repairObjectPlacementDrift'
import { syncObjectMembershipAdjacencyToRoom } from './syncObjectMembershipAdjacency'

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const OBJECT_A = 'OBJECT#Skates' as EphemeraObjectId
const OBJECT_B = 'OBJECT#Broom' as EphemeraObjectId

describe('repairObjectPlacementDrift', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn()
    const getPositionGraph = jest.fn()
    const getMembershipContainers = jest.fn()
    const applyMembership = applyObjectRoomMembership as jest.Mock
    const syncAdjacency = syncObjectMembershipAdjacencyToRoom as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        applyMembership.mockResolvedValue({ ok: true, changed: true, froms: [], to: ROOM_ID })
        syncAdjacency.mockResolvedValue({ synced: true })
    })

    const runRepair = () => repairObjectPlacementDrift(
        { roomId: ROOM_ID, messageBus: messageBus as any, streamEvent },
        { getPositionGraph, getMembershipContainers, applyMembership, syncAdjacency }
    )

    it('syncs adjacency when graph lists object but index omits room', async () => {
        getPositionGraph.mockResolvedValue(testPositionGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: OBJECT_A }],
        }))
        getMembershipContainers.mockResolvedValue([])

        const result = await runRepair()

        expect(result).toEqual({ multiRoomScrubbed: 0, adjacencySynced: 1 })
        expect(syncAdjacency).toHaveBeenCalledWith({ objectId: OBJECT_A, roomId: ROOM_ID })
        expect(applyMembership).not.toHaveBeenCalled()
    })

    it('scrubs multi-room drift via end-state apply keeping finding room', async () => {
        getPositionGraph.mockResolvedValue(testPositionGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: OBJECT_B }],
        }))
        getMembershipContainers.mockResolvedValue(['ROOM#Other', ROOM_ID])

        const result = await runRepair()

        expect(result).toEqual({ multiRoomScrubbed: 1, adjacencySynced: 0 })
        expect(applyMembership).toHaveBeenCalledWith(
            { objectId: OBJECT_B, targetRoomId: ROOM_ID },
            expect.objectContaining({ messageBus, streamEvent })
        )
    })

    it('BD-35: multi-room scrub suppresses relational facts --- a drift fixup is a silent internal correction', async () => {
        getPositionGraph.mockResolvedValue(testPositionGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: OBJECT_B }],
        }))
        getMembershipContainers.mockResolvedValue(['ROOM#Other', ROOM_ID])

        await runRepair()

        expect(applyMembership).toHaveBeenCalledWith(
            { objectId: OBJECT_B, targetRoomId: ROOM_ID },
            expect.objectContaining({ suppressRelationalFacts: true })
        )
    })
})
