import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectSetTakeHold } from './applyObjectSetTakeHold'
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
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyObjectSetTakeHold', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const transactWrite = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it("BD-13 worked example: moves [tray, glass] atomically, dissolving tray-table and carrying glass-tray", async () => {
        const getMembershipContainers = jest.fn(async (objectId: EphemeraObjectId) =>
            objectId === TRAY_ID ? [ROOM_ID] : [ROOM_ID]
        )
        const roomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [
                { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
            ],
        })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })

        const result = await applyObjectSetTakeHold(
            {
                objectIds: [TRAY_ID, GLASS_ID],
                roomId: ROOM_ID,
                characterId: CHARACTER_ID,
                carriedEdges: [{ hostId: CHARACTER_ID, edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' } }],
            },
            {
                messageBus: messageBus as any,
                streamEvent,
                getMembershipContainers,
                kernelPersist: {
                    getPositionGraph: async (hostId) => (hostId === ROOM_ID ? roomGraph : emptyCharacterGraph),
                    transactWrite,
                },
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.diffs).toEqual(
            expect.arrayContaining([
                { objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true },
                { objectId: GLASS_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true },
            ])
        )
        expect(transactWrite).toHaveBeenCalledTimes(1)

        // Two "Object Moved" facts, one per object in the set.
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
        }))
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: GLASS_ID }),
        }))

        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: TRAY_ID,
            containers: [CHARACTER_ID],
        })
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: GLASS_ID,
            containers: [CHARACTER_ID],
        })
    })

    it('degenerates to single-object behavior when the set has one member and no carriedEdges (regression)', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([ROOM_ID])
        const roomGraph = testPositionGraph(ROOM_ID, {
            nodes: [{ tag: 'Object', universalKey: TRAY_ID }],
            edges: [],
        })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })

        const result = await applyObjectSetTakeHold(
            { objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            {
                messageBus: messageBus as any,
                streamEvent,
                getMembershipContainers,
                kernelPersist: {
                    getPositionGraph: async (hostId) => (hostId === ROOM_ID ? roomGraph : emptyCharacterGraph),
                    transactWrite,
                },
            }
        )

        expect(result).toMatchObject({
            ok: true,
            diffs: [{ objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true }],
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
    })

    it('skips the kernel call entirely when no object in the set changes host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([CHARACTER_ID])

        const result = await applyObjectSetTakeHold(
            { objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getMembershipContainers }
        )

        expect(result).toEqual({
            ok: true,
            diffs: [
                { objectId: TRAY_ID, froms: [], to: CHARACTER_ID, changed: false },
                { objectId: GLASS_ID, froms: [], to: CHARACTER_ID, changed: false },
            ],
        })
        expect(transactWrite).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })
})
