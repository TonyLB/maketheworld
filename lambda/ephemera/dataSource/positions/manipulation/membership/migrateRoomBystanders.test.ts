jest.mock('../../../../internalCache', () => ({ __esModule: true, default: {} }))
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { migrateRoomBystanders } from './migrateRoomBystanders'

const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const OTHER = 'ROOM#Terrace' as EphemeraRoomId
const ALPHA = 'CHARACTER#Alpha' as EphemeraCharacterId
const GHOST = 'CHARACTER#Ghost' as EphemeraCharacterId

const roomWith = (...characters: EphemeraCharacterId[]) => testLudicGraph(ROOM, {
    nodes: [{ tag: 'Room', universalKey: ROOM }, ...characters.map((universalKey) => ({ tag: 'Character' as const, universalKey })), presenceBindingNode(parentRemainderKey(ROOM))],
})

describe('migrateRoomBystanders', () => {
    const graphs = (room: EphemeraLudicGraph) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [ROOM, room],
        [ALPHA, testLudicGraph(ALPHA as any, { nodes: [presenceBindingNode('a1', ROOM)] })],
        [GHOST, testLudicGraph(GHOST as any, { nodes: [presenceBindingNode('g1', OTHER)] })],
    ])

    it('writes the row for characters whose own binding points at the room, then strips every character node', async () => {
        const world = graphs(roomWith(ALPHA, GHOST))
        const writeRowEntries = jest.fn(async () => {})
        const stripNodes = jest.fn(async () => [ALPHA, GHOST])

        const stripped = await migrateRoomBystanders(ROOM, { getFreshLudicGraph: async (hostId) => world.get(hostId)!, writeRowEntries, stripNodes })

        expect(stripped).toBe(2)
        // the ghost's pointer names another room, so the pointer governs: it is dropped, not indexed
        expect(writeRowEntries).toHaveBeenCalledWith(ROOM, new Map([[ALPHA, ['PRESENCE#a1']]]))
        expect(writeRowEntries.mock.invocationCallOrder[0]).toBeLessThan(stripNodes.mock.invocationCallOrder[0])
    })

    it('is a no-op for a room whose graph holds no character', async () => {
        const world = graphs(roomWith())
        const writeRowEntries = jest.fn()
        const stripNodes = jest.fn()

        expect(await migrateRoomBystanders(ROOM, { getFreshLudicGraph: async (hostId) => world.get(hostId)!, writeRowEntries, stripNodes })).toBe(0)
        expect(writeRowEntries).not.toHaveBeenCalled()
        expect(stripNodes).not.toHaveBeenCalled()
    })

    it('still strips when no character belongs (nothing to write)', async () => {
        const world = graphs(roomWith(GHOST))
        const writeRowEntries = jest.fn()
        const stripNodes = jest.fn(async () => [GHOST])

        expect(await migrateRoomBystanders(ROOM, { getFreshLudicGraph: async (hostId) => world.get(hostId)!, writeRowEntries, stripNodes })).toBe(1)
        expect(writeRowEntries).not.toHaveBeenCalled()
    })
})
