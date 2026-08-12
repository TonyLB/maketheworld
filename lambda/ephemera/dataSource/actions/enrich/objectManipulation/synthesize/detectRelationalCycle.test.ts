import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import { detectRelationalCycle } from './detectRelationalCycle'

const HOST_ID = 'ROOM#Bridge' as EphemeraRoomId
const A = 'OBJECT#A' as EphemeraObjectId
const B = 'OBJECT#B' as EphemeraObjectId
const C = 'OBJECT#C' as EphemeraObjectId

const emptyGraph = () =>
    EphemeraLudicGraph.empty(HOST_ID).addObject(A).addObject(B).addObject(C)

describe('detectRelationalCycle', () => {
    it('reports no cycle when there are no edges', () => {
        expect(detectRelationalCycle(emptyGraph(), 'On')).toBe(false)
    })

    it('detects a self-edge as a one-node cycle', () => {
        const graph = emptyGraph().addRelationalEdge({ from: A, to: A, kind: 'On' })
        expect(detectRelationalCycle(graph, 'On')).toBe(true)
    })

    it('detects a two-hop cycle', () => {
        const graph = emptyGraph()
            .addRelationalEdge({ from: A, to: B, kind: 'On' })
            .addRelationalEdge({ from: B, to: A, kind: 'On' })
        expect(detectRelationalCycle(graph, 'On')).toBe(true)
    })

    it('detects a three-hop cycle', () => {
        const graph = emptyGraph()
            .addRelationalEdge({ from: A, to: B, kind: 'Under' })
            .addRelationalEdge({ from: B, to: C, kind: 'Under' })
            .addRelationalEdge({ from: C, to: A, kind: 'Under' })
        expect(detectRelationalCycle(graph, 'Under')).toBe(true)
    })

    it('reports no cycle for a non-cyclic chain', () => {
        const graph = emptyGraph()
            .addRelationalEdge({ from: A, to: B, kind: 'On' })
            .addRelationalEdge({ from: B, to: C, kind: 'On' })
        expect(detectRelationalCycle(graph, 'On')).toBe(false)
    })

    it('ignores edges of a different kind from the one being checked', () => {
        const graph = emptyGraph()
            .addRelationalEdge({ from: A, to: B, kind: 'On' })
            .addRelationalEdge({ from: B, to: A, kind: 'Under' })
        expect(detectRelationalCycle(graph, 'On')).toBe(false)
        expect(detectRelationalCycle(graph, 'Under')).toBe(false)
    })

    it('ignores Against/Custom edges entirely, even when they cycle', () => {
        const graph = emptyGraph()
            .addRelationalEdge({ from: A, to: B, kind: 'Against' })
            .addRelationalEdge({ from: B, to: A, kind: 'Against' })
            .addRelationalEdge({ from: A, to: C, kind: 'Custom', relationLabel: 'tangled with' })
            .addRelationalEdge({ from: C, to: A, kind: 'Custom', relationLabel: 'tangled with' })
        expect(detectRelationalCycle(graph, 'On')).toBe(false)
        expect(detectRelationalCycle(graph, 'Under')).toBe(false)
    })
})
