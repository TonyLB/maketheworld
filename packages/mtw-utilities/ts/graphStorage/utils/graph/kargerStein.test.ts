import { Graph } from '.'
import { GraphEdge, compareEdges } from './baseClasses'
import kargerStein, * as kargerSteinModule from './kargerStein'

describe('Karger-Stein algorithm', () => {
    let testNodes: Record<string, { key: string }>
    let testEdges: GraphEdge<string, {}>[]

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
        const testGraph = new Graph<string, { key: string }, {}>(testNodes, testEdges, {})
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

    it('should return cut graph when above threshold', () => {
        const testGraph = new Graph<string, { key: string }, {}>(testNodes, testEdges, {})
        jest.spyOn(kargerSteinModule, 'randomInRange').mockReturnValue(0)
        const { subGraphs, cutSet } = kargerStein(testGraph, 8)
        expect(subGraphs.length).toBe(2)
        expect(Object.keys(subGraphs[0].nodes).sort()).toEqual(['A', 'B', 'C'])
        expect(subGraphs[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' }
        ])
        expect(Object.keys(subGraphs[1].nodes).sort()).toEqual(['D', 'F'])
        expect(subGraphs[1].edges.sort(compareEdges)).toEqual([
            { from: 'D', to: 'F' }
        ])
        expect(Object.keys(cutSet.nodes)).toEqual(['C', 'D', 'E'])
        expect(cutSet.edges.sort(compareEdges)).toEqual([
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
        ])
    })

    it('should try a second time when cut-set is above threshold', () => {
        const testGraph = new Graph<string, { key: string }, {}>(
            testNodes,
            [
                { from: 'C', to: 'D' },
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'A' },
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ],
            {}
        )
        jest.spyOn(kargerSteinModule, 'randomInRange')
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(1)
            .mockReturnValueOnce(1)
            .mockReturnValue(0)
        const { subGraphs, cutSet } = kargerStein(testGraph, 7)
        expect(subGraphs.length).toBe(2)
        expect(Object.keys(subGraphs[0].nodes).sort()).toEqual(['A', 'B', 'C'])
        expect(subGraphs[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
            { from: 'B', to: 'C' },
            { from: 'C', to: 'A' },
        ])
        expect(Object.keys(subGraphs[1].nodes).sort()).toEqual(['D', 'E', 'F'])
        expect(subGraphs[1].edges.sort(compareEdges)).toEqual([
            { from: 'D', to: 'E' },
            { from: 'E', to: 'F' },
            { from: 'F', to: 'D' }
        ])
        expect(Object.keys(cutSet.nodes)).toEqual(['C', 'D'])
        expect(cutSet.edges.sort(compareEdges)).toEqual([
            { from: 'C', to: 'D' }
        ])
    })

})