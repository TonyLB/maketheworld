import { Graph } from '.'
import { GraphEdge, compareEdges } from './baseClasses'
import kargerStein from './kargerStein'

describe('Karger-Stein algorithm', () => {
    let testNodes: Record<string, { key: string }>
    let testEdges: GraphEdge<string>[]

    beforeEach(() => {
        testNodes = {
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' },
            D: { key: 'D' },
            E: { key: 'E' },
            F: { key: 'F' },
        }
        testEdges = [
            { from: 'A', to: 'B' },
            { from: 'B', to: 'C' },
            { from: 'A', to: 'C' },
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
            { from: 'D', to: 'F' }
        ]
    })

    it('should return graph unchanged when below threshold', () => {
        const testGraph = new Graph(testNodes, testEdges)
        const { subGraphs, cutSet } = kargerStein(testGraph, 20)
        expect(subGraphs.length).toBe(1)
        expect(Object.keys(subGraphs[0].nodes).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
        expect(subGraphs[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' },
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
            { from: 'D', to: 'F' }
        ])
        expect(Object.keys(cutSet.nodes).length).toBe(0)
    })
})