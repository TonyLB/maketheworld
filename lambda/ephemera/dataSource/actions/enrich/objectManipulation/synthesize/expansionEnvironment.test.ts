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
    // tray On table (dissolve on transfer), cup On tray (carry --- cup rides along)
    graph = graph.addRelationalEdge({ from: TRAY_ID, to: TABLE_ID, kind: 'On' })
    graph = graph.addRelationalEdge({ from: CUP_ID, to: TRAY_ID, kind: 'On' })
    return graph
}

describe('lookupOrComputeClosure', () => {
    it('computes a fresh closure on first lookup and indexes every member', () => {
        const env = createExpansionEnvironment(() => undefined, () => undefined)
        const graph = buildGraph()

        const closure = lookupOrComputeClosure(env, TRAY_ID, graph)

        expect(closure.rootId).toBe(TRAY_ID)
        expect(closure.objectIds).toEqual(new Set([TRAY_ID, CUP_ID]))
        expect(closure.relationalEdges).toEqual([{ from: CUP_ID, to: TRAY_ID, kind: 'On' }])
        expect(env.groupIdByObject.has(TRAY_ID)).toBe(true)
        expect(env.groupIdByObject.has(CUP_ID)).toBe(true)
        expect(env.groupIdByObject.get(TRAY_ID)).toBe(env.groupIdByObject.get(CUP_ID))
    })

    it('reuses a settled group when a later lookup starts from a different member object (Fix 2)', () => {
        const env = createExpansionEnvironment(() => undefined, () => undefined)
        const graph = buildGraph()

        lookupOrComputeClosure(env, TRAY_ID, graph)
        const groupIdAfterFirst = env.groupIdByObject.get(CUP_ID)

        // Starting from `cup`, a different object than the original `tray` lookup,
        // must still find the already-settled group rather than recomputing.
        const closureFromCup = lookupOrComputeClosure(env, CUP_ID, graph)

        expect(closureFromCup.rootId).toBe(TRAY_ID)
        expect(closureFromCup.objectIds).toEqual(new Set([TRAY_ID, CUP_ID]))
        expect(closureFromCup.relationalEdges).toEqual([{ from: CUP_ID, to: TRAY_ID, kind: 'On' }])
        expect(env.groupIdByObject.get(CUP_ID)).toBe(groupIdAfterFirst)
        expect(env.settledGroups.size).toBe(1)
    })
})
