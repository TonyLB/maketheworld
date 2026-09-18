/**
 * Fixtures are hand-authored `EphemeraLudicGraph`s (via `testLudicGraph`), matching this
 * directory's house style --- no `jest.mock` of `internalCache` anywhere in `ludicCache/` or
 * `ludicGraph/`.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../ludicGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { enumerateLudicCacheShards } from './enumerateShards'

const roomA = 'ROOM#A' as EphemeraRoomId
const objB = 'OBJECT#B' as EphemeraObjectId
const objC = 'OBJECT#C' as EphemeraObjectId
const objD = 'OBJECT#D' as EphemeraObjectId

describe('enumerateLudicCacheShards', () => {
    it('recurses through a member with no further members (plain, non-cyclic case)', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: objB }] })],
            [objB, testLudicGraph(objB, { nodes: [{ tag: 'Object', universalKey: objB }] })],
        ])
        let fetchCount = 0
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            fetchCount += 1
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const result = await enumerateLudicCacheShards(roomA, { getLudicGraph })

        expect(result.hostIds).toEqual([roomA, objB])
        expect(result.shardFetchCount).toBe(2)
        expect(fetchCount).toBe(2)
        expect(result.graphs.get(roomA)).toBe(graphs.get(roomA))
        expect(result.graphs.get(objB)).toBe(graphs.get(objB))
    })

    it('fetches a diamond-shared member exactly once (DAG, not a tree)', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objC }] })],
            [objB, testLudicGraph(objB, { nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objD }] })],
            [objC, testLudicGraph(objC, { nodes: [{ tag: 'Object', universalKey: objC }, { tag: 'Object', universalKey: objD }] })],
            [objD, testLudicGraph(objD, { nodes: [{ tag: 'Object', universalKey: objD }] })],
        ])
        const fetched: EphemeraMembershipHostId[] = []
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            fetched.push(hostId)
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const result = await enumerateLudicCacheShards(roomA, { getLudicGraph })

        expect(result.shardFetchCount).toBe(4)
        expect(fetched.filter((id) => id === objD)).toHaveLength(1)
        expect(new Set(result.hostIds).size).toBe(4)
        expect(result.hostIds).toContain(objD)
    })

    it('terminates on a true back-reference instead of looping forever', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: objB }] })],
            [objB, testLudicGraph(objB, { nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Room', universalKey: roomA }] })],
        ])
        const getLudicGraph = async (hostId: EphemeraMembershipHostId) => {
            const graph = graphs.get(hostId)
            if (!graph) {
                throw new Error(`No fixture graph for ${hostId}`)
            }
            return graph
        }

        const result = await enumerateLudicCacheShards(roomA, { getLudicGraph })

        expect(result.shardFetchCount).toBe(2)
        expect(result.hostIds).toEqual([roomA, objB])
    })

    it('defaults to internalCache.Positions.getLudicGraph when no deps are supplied', async () => {
        const internalCache = (await import('../../../internalCache')).default
        const spy = jest
            .spyOn(internalCache.Positions, 'getLudicGraph')
            .mockResolvedValue(testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }] }))

        const result = await enumerateLudicCacheShards(roomA)

        expect(spy).toHaveBeenCalledWith(roomA)
        expect(result.shardFetchCount).toBe(1)
        spy.mockRestore()
    })
})
