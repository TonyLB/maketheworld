import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectSetDrop } from './applyObjectSetDrop'
import { testPositionGraph } from '../../positionGraph/testFixtures'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getMembershipContainers: jest.fn(),
            getPositionGraph: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../../internalCache'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyObjectSetDrop', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const transactWrite = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it('drops [tray, glass] atomically, carrying the glass-tray edge to the room', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([CHARACTER_ID])
        const characterGraph = testPositionGraph(CHARACTER_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [{ tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' }],
        })
        const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })

        const result = await applyObjectSetDrop(
            {
                objectIds: [TRAY_ID, GLASS_ID],
                roomId: ROOM_ID,
                characterId: CHARACTER_ID,
                carriedEdges: [{ hostId: ROOM_ID, edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' } }],
            },
            {
                messageBus: messageBus as any,
                streamEvent,
                getMembershipContainers,
                kernelPersist: {
                    getPositionGraph: async (hostId) => (hostId === CHARACTER_ID ? characterGraph : emptyRoomGraph),
                    transactWrite,
                },
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.diffs).toEqual(
            expect.arrayContaining([
                { objectId: TRAY_ID, froms: [CHARACTER_ID], to: ROOM_ID, changed: true },
                { objectId: GLASS_ID, froms: [CHARACTER_ID], to: ROOM_ID, changed: true },
            ])
        )
        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: TRAY_ID,
            containers: [ROOM_ID],
        })
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: GLASS_ID,
            containers: [ROOM_ID],
        })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
    })

    it('skips the kernel call entirely when no object in the set changes host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([ROOM_ID])

        const result = await applyObjectSetDrop(
            { objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getMembershipContainers }
        )

        expect(result).toEqual({
            ok: true,
            diffs: [
                { objectId: TRAY_ID, froms: [], to: ROOM_ID, changed: false },
                { objectId: GLASS_ID, froms: [], to: ROOM_ID, changed: false },
            ],
        })
        expect(transactWrite).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })
})
