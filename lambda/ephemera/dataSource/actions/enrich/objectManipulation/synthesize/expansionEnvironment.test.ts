import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { createExpansionEnvironment, lookupOrComputeClosure } from './expansionEnvironment'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const buildGraph = (): EphemeraLudicGraph => {
    let graph = EphemeraLudicGraph.empty(ROOM_ID)
    for (const objectId of [TRAY_ID, CUP_ID, TABLE_ID]) {
        graph = graph.addObject(objectId)
    }
    // tray Against table (dissolve on transfer), cup Under tray (peer, no absorption).
    // (Both were `On` before Channel D CD2, 2026-08-22 joined `On` to `In`/`PartOf`'s
    // hosting-kind throw -- see the retired multi-member tests below.)
    graph = graph.addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'Against' })
    graph = graph.addRelationalEdge({ from: CUP_ID, to: TRAY_ID, kind: 'Under' })
    return graph
}

describe('lookupOrComputeClosure', () => {
    it('computes a fresh (singleton) closure on first lookup and caches it', () => {
        const env = createExpansionEnvironment(() => undefined, () => undefined)
        const graph = buildGraph()

        const closure = lookupOrComputeClosure(env, TRAY_ID, graph)

        expect(closure.rootId).toBe(TRAY_ID)
        expect(closure.objectIds).toEqual(new Set([TRAY_ID]))
        expect(closure.relationalEdges).toEqual([])
        expect(env.groupIdByObject.has(TRAY_ID)).toBe(true)
    })

    it('reuses the cached group on a second lookup of the same object', () => {
        const env = createExpansionEnvironment(() => undefined, () => undefined)
        const graph = buildGraph()

        lookupOrComputeClosure(env, TRAY_ID, graph)
        const groupIdAfterFirst = env.groupIdByObject.get(TRAY_ID)

        const closureSecond = lookupOrComputeClosure(env, TRAY_ID, graph)

        expect(closureSecond.objectIds).toEqual(new Set([TRAY_ID]))
        expect(env.groupIdByObject.get(TRAY_ID)).toBe(groupIdAfterFirst)
        expect(env.settledGroups.size).toBe(1)
    })

    // The former "reuses a settled group when a later lookup starts from a different member
    // object (Fix 2)" test is retired 2026-08-22 (Channel D, CD2, reduced scope): it required a
    // real multi-member carry closure (cup On tray), which is now unreachable -- `On` joined
    // `In`/`PartOf`'s hosting-kind throw, and `carry` is unreachable from any relation kind.
    // Real shard-based hosting (CD2h) is what would eventually produce a multi-member group again.
})
