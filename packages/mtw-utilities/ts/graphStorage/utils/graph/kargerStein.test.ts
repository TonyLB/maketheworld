import { Graph } from '.'
import { GraphEdge, compareEdges } from './baseClasses'
import kargerStein, * as kargerSteinModule from './kargerStein'

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

    it('should return cut graph when above threshold', () => {
        const testGraph = new Graph(testNodes, testEdges)
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

    describe('countMergeNodeAndEdges', () => {
        let testNodes: Record<string, { key: string }>
        let testEdges: GraphEdge<string>[]
        let testGraph: Graph<string, { key: string }>
    
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
            testGraph = new Graph(testNodes, testEdges)
        })

        it('should count merger when no labels', () => {
            expect(kargerSteinModule.countMergedNodesAndEdges(testGraph, {}, { from: 'A', to: 'B' })).toEqual(3)
        })

        it('should correct sum merging two merged nodes', () => {
            expect(kargerSteinModule.countMergedNodesAndEdges(
                testGraph,
                {
                    A: { key: 'B', nodesAndEdges: 3 },
                    B: { key: 'B', nodesAndEdges: 3 },
                    C: { key: 'C', nodesAndEdges: 3 },
                    D: { key: 'C', nodesAndEdges: 3 },
                },
                { from: 'B', to: 'C' }
            )).toEqual(8)
        })
    })

    describe('selectRandomUnmergedEdge', () => {
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
    
        it('should select a random edge from unmerged graph', () => {
            const testGraph = new Graph(testNodes, testEdges)
            jest.spyOn(kargerSteinModule, 'randomInRange').mockReturnValue(2)
            expect(kargerSteinModule.selectRandomUnmergedEdge(testGraph, {}, 10)).toEqual(2)
        })

        it('should exclude merged self-edges from selection', () => {
            const testGraph = new Graph(testNodes, testEdges)
            jest.spyOn(kargerSteinModule, 'randomInRange').mockReturnValue(2)
            expect(kargerSteinModule.selectRandomUnmergedEdge(testGraph, { B: { key: 'B', nodesAndEdges: 3 }, C: { key: 'B', nodesAndEdges: 3 }}, 10)).toEqual(3)
        })

        it('should exclude edges that would make a past-threshold merge node from selection', () => {
            const testGraph = new Graph(testNodes, testEdges)
            jest.spyOn(kargerSteinModule, 'randomInRange').mockReturnValue(0)
            expect(kargerSteinModule.selectRandomUnmergedEdge(testGraph, { B: { key: 'B', nodesAndEdges: 3 }, C: { key: 'B', nodesAndEdges: 3 }}, 8)).toEqual(0)
            expect(kargerSteinModule.selectRandomUnmergedEdge(testGraph, { B: { key: 'B', nodesAndEdges: 3 }, C: { key: 'B', nodesAndEdges: 3 }}, 6)).toEqual(3)
            expect(kargerSteinModule.selectRandomUnmergedEdge(testGraph, { B: { key: 'B', nodesAndEdges: 3 }, C: { key: 'B', nodesAndEdges: 3 }}, 5)).toEqual(5)
        })

    })

    describe('mergeEdge', () => {
        let testNodes: Record<string, { key: string }>
        let testEdges: GraphEdge<string>[]
        let testGraph: Graph<string, { key: string }>
    
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
            testGraph = new Graph(testNodes, testEdges)
        })

        it('should merge edges on unmerged graph', () => {
            expect(kargerSteinModule.mergeEdge(testGraph, {}, { from : 'A', to: 'B' })).toEqual({ A: { key: 'A', nodesAndEdges: 3 }, B: { key: 'A', nodesAndEdges: 3 } })
        })

        it('should merge unmerged edges on merged graph', () => {
            expect(kargerSteinModule.mergeEdge(
                testGraph,
                {
                    C: { key: 'C', nodesAndEdges: 3 },
                    D: { key: 'C', nodesAndEdges: 3 }
                },
                { from : 'A', to: 'B' }
            )).toEqual({
                A: { key: 'A', nodesAndEdges: 3 },
                B: { key: 'A', nodesAndEdges: 3 },
                C: { key: 'C', nodesAndEdges: 3 },
                D: { key: 'C', nodesAndEdges: 3 }
            })
        })

        it('should merge unmerged node with merged node', () => {
            expect(kargerSteinModule.mergeEdge(
                testGraph,
                {
                    C: { key: 'C', nodesAndEdges: 3 },
                    D: { key: 'C', nodesAndEdges: 3 }
                },
                { from : 'A', to: 'C' }
            )).toEqual({
                A: { key: 'A', nodesAndEdges: 5 },
                C: { key: 'A', nodesAndEdges: 5 },
                D: { key: 'A', nodesAndEdges: 5 }
            })
        })

        it('should merge already merged nodes', () => {
            expect(kargerSteinModule.mergeEdge(
                testGraph,
                {
                    A: { key: 'A', nodesAndEdges: 3 },
                    B: { key: 'A', nodesAndEdges: 3 },
                    C: { key: 'D', nodesAndEdges: 3 },
                    D: { key: 'D', nodesAndEdges: 3 }
                },
                { from : 'B', to: 'C' }
            )).toEqual({
                A: { key: 'A', nodesAndEdges: 8 },
                B: { key: 'A', nodesAndEdges: 8 },
                C: { key: 'A', nodesAndEdges: 8 },
                D: { key: 'A', nodesAndEdges: 8 }
            })
        })
    })
})