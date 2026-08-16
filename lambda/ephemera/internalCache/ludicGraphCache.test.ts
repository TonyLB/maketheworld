import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import {
    characterNode,
    EphemeraLudicGraph,
    objectNode,
} from '../dataSource/positions/ludicGraph'
import { createEphemeraLudicGraphCacheData } from './ludicGraphCache'

const ROOM_ID = 'ROOM#town' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as const
const OBJECT_A = 'OBJECT#a' as EphemeraObjectId
const OBJECT_HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FEATURE_HOST_ID = 'FEATURE#Sign' as EphemeraFeatureId
const AREA_ID = 'AREA#Overworld' as EphemeraAreaId

describe('EphemeraLudicGraphCacheData', () => {
    it('getLudicGraph returns host-bound class', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue({
                ludicGraph: {
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_A }],
                },
            }),
        })

        const graph = await cache.getLudicGraph(ROOM_ID)

        expect(graph).toBeInstanceOf(EphemeraLudicGraph)
        expect(graph.hostId).toBe(ROOM_ID)
        expect([...graph.characterIds]).toEqual([CHARACTER_A])
    })

    it('set throws when graph.hostId is not a forward host id (Area, still unsupported)', () => {
        const cache = createEphemeraLudicGraphCacheData({ getItem: jest.fn() })
        const graph = EphemeraLudicGraph.fromFieldPayload(AREA_ID as EphemeraMembershipHostId, { nodes: [] })

        expect(() => cache.set(graph)).toThrow(/forward host ROOM#, CHARACTER#, OBJECT#, or FEATURE#/)
    })

    it('set then get round-trips membership nodes', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(ROOM_ID, {
            nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(ROOM_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('set then get round-trips membership nodes for an Object host (MK2)', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(OBJECT_HOST_ID, {
            nodes: [characterNode(CHARACTER_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(OBJECT_HOST_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('set then get round-trips membership nodes for a Feature host (MK3)', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(FEATURE_HOST_ID, {
            nodes: [characterNode(CHARACTER_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(FEATURE_HOST_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('getMembershipContainers delegates to gateway', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn(),
            query: jest.fn().mockResolvedValue([
                { DataCategory: `POSITION#${ROOM_ID}` },
            ]),
        })

        await expect(cache.getMembershipContainers(CHARACTER_A)).resolves.toEqual([ROOM_ID])
    })
})
