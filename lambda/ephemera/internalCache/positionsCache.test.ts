import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import {
    characterNode,
    EphemeraLudicGraph,
    objectNode,
} from '../dataSource/positions/ludicGraph'
import { createEphemeraPositionsCacheData } from './positionsCache'

const ROOM_ID = 'ROOM#town' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as const
const OBJECT_A = 'OBJECT#a' as EphemeraObjectId

describe('EphemeraPositionsCacheData', () => {
    it('getPositionGraph returns host-bound class', async () => {
        const cache = createEphemeraPositionsCacheData({
            getItem: jest.fn().mockResolvedValue({
                positionGraph: {
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_A }],
                },
            }),
        })

        const graph = await cache.getPositionGraph(ROOM_ID)

        expect(graph).toBeInstanceOf(EphemeraLudicGraph)
        expect(graph.hostId).toBe(ROOM_ID)
        expect([...graph.characterIds]).toEqual([CHARACTER_A])
    })

    it('set throws when graph.hostId is not a forward host id', () => {
        const cache = createEphemeraPositionsCacheData({ getItem: jest.fn() })
        const graph = EphemeraLudicGraph.fromFieldPayload(OBJECT_A as EphemeraMembershipHostId, { nodes: [] })

        expect(() => cache.set(graph)).toThrow(/forward host ROOM# or CHARACTER#/)
    })

    it('set then get round-trips membership nodes', async () => {
        const cache = createEphemeraPositionsCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(ROOM_ID, {
            nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getPositionGraph(ROOM_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('getMembershipContainers delegates to gateway', async () => {
        const cache = createEphemeraPositionsCacheData({
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([
                { DataCategory: `POSITION#${ROOM_ID}` },
            ]),
        })

        await expect(cache.getMembershipContainers(CHARACTER_A)).resolves.toEqual([ROOM_ID])
    })
})
