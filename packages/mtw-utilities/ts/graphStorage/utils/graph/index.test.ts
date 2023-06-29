import { Graph } from './'
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
            const testGraph = new Graph(testNodes, testEdges, true)
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges, true)
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' }
            ])
        })

        it('should correctly get edges on a non-directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges)
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'C', to: 'A' },
                { from: 'C', to: 'B' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a non-directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges)
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'D', to: 'C' },
                { from: 'E', to: 'C' }
            ])
        })
        
    })

    describe('simpleWalk', () => {
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
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ]
        })

        it('should correctly walk an acyclic tree', () => {
            const callback = jest.fn()
            const testGraph = new Graph(testNodes, testEdges, true)
            testGraph.simpleWalk('A', callback)
            expect(callback).toHaveBeenCalledTimes(3)
            expect(callback).toHaveBeenCalledWith('A')
            expect(callback).toHaveBeenCalledWith('B')
            expect(callback).toHaveBeenCalledWith('C')
        })

        it('should correctly walk a cyclic tree', () => {
            const callback = jest.fn()
            const testGraph = new Graph(testNodes, testEdges, true)
            testGraph.simpleWalk('D', callback)
            expect(callback).toHaveBeenCalledTimes(3)
            expect(callback).toHaveBeenCalledWith('D')
            expect(callback).toHaveBeenCalledWith('E')
            expect(callback).toHaveBeenCalledWith('F')
        })

    })

    describe('subGraph', () => {
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
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ]
        })

        it('should deliver a subGraph', () => {
            const testGraph = new Graph(testNodes, testEdges, true)
            const subGraph = testGraph.subGraph(['A', 'C', 'D', 'E', 'G'])
            expect(subGraph.directional).toBe(true)
            expect(Object.keys(subGraph.nodes).sort()).toEqual(['A', 'C', 'D', 'E'])
            expect(subGraph.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'D', to: 'E' }
            ])
        })
    })
})