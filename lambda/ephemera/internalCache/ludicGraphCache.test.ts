import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import {
    characterNode,
    EphemeraLudicGraph,
    nodeFromId,
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
                    rootId: ROOM_ID, ports: [],
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_A }],
                },
            }),
        })

        const graph = await cache.getLudicGraph(ROOM_ID)

        expect(graph).toBeInstanceOf(EphemeraLudicGraph)
        expect(graph.hostId).toBe(ROOM_ID)
        expect([...graph.characterIds]).toEqual([CHARACTER_A])
    })

    it('set throws when graph.hostId is not a forward host id', () => {
        const cache = createEphemeraLudicGraphCacheData({ getItem: jest.fn() })
        const graph = EphemeraLudicGraph.fromFieldPayload('BOGUS#NotAHost' as EphemeraMembershipHostId, { rootId: 'BOGUS#NotAHost' as EphemeraMembershipHostId, ports: [], nodes: [] })

        expect(() => cache.set(graph)).toThrow(/forward host ROOM#, CHARACTER#, OBJECT#, FEATURE#, or AREA#/)
    })

    it('set then get round-trips membership nodes', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(ROOM_ID, {
            rootId: ROOM_ID, ports: [],
            // LP4i: fromPlayEnvelope (the read side of this round trip) now always includes
            // the graph's own root node, so a fixture built by hand needs it too.
            nodes: [nodeFromId(ROOM_ID), characterNode(CHARACTER_A), objectNode(OBJECT_A)],
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
            rootId: OBJECT_HOST_ID, ports: [],
            nodes: [nodeFromId(OBJECT_HOST_ID), characterNode(CHARACTER_A)],
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
            rootId: FEATURE_HOST_ID, ports: [],
            nodes: [nodeFromId(FEATURE_HOST_ID), characterNode(CHARACTER_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(FEATURE_HOST_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('set then get round-trips membership nodes for an Area host (MK4)', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(AREA_ID, {
            rootId: AREA_ID, ports: [],
            nodes: [nodeFromId(AREA_ID), characterNode(CHARACTER_A)],
            edges: [],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(AREA_ID)

        expect(loaded.equals(original)).toBe(true)
    })

    it('getLudicGraph carries crossing ports through from the stored row', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue({
                ludicGraph: {
                    rootId: OBJECT_HOST_ID,
                    nodes: [nodeFromId(OBJECT_HOST_ID), objectNode(OBJECT_A)],
                    edges: [],
                    ports: [{ portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }],
                },
            }),
        })

        const graph = await cache.getLudicGraph(OBJECT_HOST_ID)

        expect(graph.ports).toEqual([
            { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' },
        ])
    })

    it('set then get round-trips crossing ports', async () => {
        const cache = createEphemeraLudicGraphCacheData({
            getItem: jest.fn().mockResolvedValue(undefined),
        })
        const original = EphemeraLudicGraph.fromFieldPayload(OBJECT_HOST_ID, {
            rootId: OBJECT_HOST_ID,
            nodes: [nodeFromId(OBJECT_HOST_ID), objectNode(OBJECT_A)],
            edges: [],
            ports: [{ portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }],
        })

        cache.set(original)
        const loaded = await cache.getLudicGraph(OBJECT_HOST_ID)

        // Asserted on `.ports` directly rather than via `equals`: `EphemeraLudicGraph.equals`
        // compares hostId/rootId/nodes/edges and is blind to ports, so the round-trip cases above
        // would still have passed while this cache was silently emptying them --- which is part of
        // why the loss went unnoticed until it broke crossing dissolution live (2026-09-03).
        expect(loaded.ports).toEqual(original.ports)
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
