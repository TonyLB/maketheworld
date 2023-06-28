import { Graph, GraphNode } from './'
import { GraphEdge, compareEdges } from './baseClasses'

describe('Graph class', () => {
    describe('GraphNode subclass', () => {
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

        it('should correctly get edges on a directional graph', () => {
            const testGraph = new Graph<string, { key: string}>(testNodes, testEdges, true)
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a directional graph', () => {
            const testGraph = new Graph<string, { key: string}>(testNodes, testEdges, true)
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' }
            ])
        })

        it('should correctly get edges on a non-directional graph', () => {
            const testGraph = new Graph<string, { key: string}>(testNodes, testEdges)
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a non-directional graph', () => {
            const testGraph = new Graph<string, { key: string}>(testNodes, testEdges)
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })
        
    })
})