import { Graph } from './'
import { GraphEdge, compareEdges } from './baseClasses'

describe('Graph class', () => {
    describe('GraphNode subclass', () => {
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

        it('should correctly get edges on a directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges, {}, true)
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' }
            ])
        })

        it('should correctly get edges on a non-directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges, {})
            expect(testGraph.getNode('C')?.edges.sort(compareEdges)).toEqual([
                { from: 'C', to: 'A' },
                { from: 'C', to: 'B' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' }
            ])
        })

        it('should correctly get back-edges on a non-directional graph', () => {
            const testGraph = new Graph(testNodes, testEdges, {})
            expect(testGraph.getNode('C')?.backEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'D', to: 'C' },
                { from: 'E', to: 'C' }
            ])
        })
        
    })

    describe('clone', () => {
        let testNodes: Record<string, { key: string, value?: string }>
        let testEdges: GraphEdge<string, {}>[]

        beforeEach(() => {
            testNodes = {
                A: { key: 'A', value: 'original' },
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

        it('should deep copy', () => {
            const testGraph = new Graph(testNodes, testEdges, {}, true)
            const clone = testGraph.clone()
            testGraph.setNode('A', { value: 'changed' })
            expect(testGraph.nodes['A']?.value).toBe('changed')
            expect(clone.nodes['A']?.value).toBe('original')
        })
    })

    describe('simpleWalk', () => {
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
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ]
        })

        it('should correctly walk an acyclic tree', () => {
            const callback = jest.fn()
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            testGraph.simpleWalk(callback, { fromRoots: ['A'] })
            expect(callback).toHaveBeenCalledTimes(3)
            expect(callback).toHaveBeenCalledWith({ key: 'A', node: { key: 'A' }, edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }] })
            expect(callback).toHaveBeenCalledWith({ key: 'B', node: { key: 'B' }, edges: [{ from: 'B', to: 'C' }] })
            expect(callback).toHaveBeenCalledWith({ key: 'C', node: { key: 'C' }, edges: [] })
        })

        it('should correctly walk a cyclic tree', () => {
            const callback = jest.fn()
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            testGraph.simpleWalk(callback, { fromRoots: ['D'] })
            expect(callback).toHaveBeenCalledTimes(3)
            expect(callback).toHaveBeenCalledWith({ key: 'D', node: { key: 'D' }, edges: [{ from: 'D', to: 'E' }] })
            expect(callback).toHaveBeenCalledWith({ key: 'E', node: { key: 'E' }, edges: [{ from: 'E', to: 'F' }] })
            expect(callback).toHaveBeenCalledWith({ key: 'F', node: { key: 'F' }, edges: [{ from: 'F', to: 'D' }] })
        })

    })

    describe('filter', () => {
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
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ]
        })

        it('should deliver a subGraph when filtered by key nodes', () => {
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            const subGraph = testGraph.filter({ keys: ['A', 'C', 'D', 'E', 'G'] })
            expect(subGraph.directional).toBe(true)
            expect(Object.keys(subGraph.nodes).sort()).toEqual(['A', 'C', 'D', 'E'])
            expect(subGraph.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'C' },
                { from: 'D', to: 'E' }
            ])
        })
    })

    describe('restrict', () => {
        let testNodes: Record<string, { key: string }>
        let testEdges: GraphEdge<string, { context: string }>[]

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
                { from: 'A', to: 'B', context: 'tag' },
                { from: 'B', to: 'C', context: 'tag' },
                { from: 'A', to: 'C', context: 'notag' },
                { from: 'C', to: 'D', context: 'notag' },
                { from: 'D', to: 'E', context: 'tag' },
                { from: 'E', to: 'F', context: 'tag' }
            ]
        })

        it('should deliver a subGraph when restricted by key nodes', () => {
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            const subGraph = testGraph.restrict({ fromRoots: ['A'], nodeCondition: ({ node }) => (['A', 'B', 'C', 'E'].includes(node?.key || '')) })
            expect(subGraph.directional).toBe(true)
            expect(Object.keys(subGraph.nodes).sort()).toEqual(['A', 'B', 'C'])
            expect(subGraph.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'B', context: 'tag'  },
                { from: 'A', to: 'C', context: 'notag'  },
                { from: 'B', to: 'C', context: 'tag'  }
            ])
        })

        it('should deliver a subGraph when restricted by edges', () => {
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            const subGraph = testGraph.restrict({ fromRoots: ['A'], edgeCondition: ({ context }) => (context === 'tag') })
            expect(subGraph.directional).toBe(true)
            expect(Object.keys(subGraph.nodes).sort()).toEqual(['A', 'B', 'C'])
            expect(subGraph.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'B', context: 'tag'  },
                { from: 'B', to: 'C', context: 'tag'  }
            ])
        })
    })

    describe('merge', () => {

        it('should deliver a merged graph', () => {
            const testGraph = new Graph<string, { key: string }, {}>({ A: { key: 'A' }, B: { key: 'B' } }, [{ from: 'A', to: 'B' }], {},  true)
            const subGraphOne = new Graph<string, { key: string }, {}>({ B: { key: 'B' }, C: { key: 'C' } }, [{ from: 'B', to: 'C' }], {}, true)
            const subGraphTwo = new Graph<string, { key: string }, {}>({ D: { key: 'D' }, E: { key: 'E' }, 'F': { key: 'F' } }, [{ from: 'D', to: 'E' }, { from: 'D', to: 'F' }], {}, true)
            const mergedGraph = testGraph.merge([subGraphOne, subGraphTwo], [{ from: 'C', to: 'D' }])
            expect(mergedGraph.directional).toBe(true)
            expect(Object.keys(mergedGraph.nodes).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
            expect(mergedGraph.edges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'D', to: 'E' },
                { from: 'D', to: 'F' }
            ])
        })
    })

    describe('sortedWalk', () => {
        let testNodes: Record<string, { key: string }>

        beforeEach(() => {
            testNodes = {
                A: { key: 'A' },
                B: { key: 'B' },
                C: { key: 'C' },
                D: { key: 'D' },
                E: { key: 'E' },
                F: { key: 'F' },
            }
        })

        it('should correctly walk an acyclic tree', async () => {
            const testEdges = [
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'D', to: 'E' },
                { from: 'D', to: 'F' }
            ]
            const callback = jest.fn().mockImplementation(async ({ keys }) => (keys.join('::')))
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            await testGraph.sortedWalk(callback)
            expect(callback).toHaveBeenCalledTimes(6)
            expect(callback).toHaveBeenCalledWith({ keys: ['B'], previous: [] })
            expect(callback).toHaveBeenCalledWith({ keys: ['A'], previous: [] })
            expect(callback).toHaveBeenCalledWith({ keys: ['C'], previous: ['A', 'B'] })
            expect(callback).toHaveBeenCalledWith({ keys: ['D'], previous: ['C'] })
            expect(callback).toHaveBeenCalledWith({ keys: ['F'], previous: ['D'] })
            expect(callback).toHaveBeenCalledWith({ keys: ['E'], previous: ['D'] })
        })

        it('should correctly walk a cyclic tree', async () => {
            const testEdges = [
                { from: 'A', to: 'C' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'D', to: 'E' },
                { from: 'E', to: 'C' },
                { from: 'D', to: 'F' }
            ]
            const callback = jest.fn().mockImplementation(async ({ keys }) => (keys.join('::')))
            const testGraph = new Graph(testNodes, testEdges, {},  true)
            await testGraph.sortedWalk(callback)
            expect(callback).toHaveBeenCalledTimes(4)
            expect(callback).toHaveBeenCalledWith({ keys: ['B'], previous: [] })
            expect(callback).toHaveBeenCalledWith({ keys: ['A'], previous: [] })
            expect(callback).toHaveBeenCalledWith({ keys: ['C', 'D', 'E'], previous: ['A', 'B'] })
            expect(callback).toHaveBeenCalledWith({ keys: ['F'], previous: ['C::D::E'] })
        })

    })
})