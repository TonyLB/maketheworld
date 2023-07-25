import { Graph } from '.'
import topologicalSort, { generationOrder } from './topologicalSort'

describe('Topological Sort algorithm', () => {

    it('should return empty array on empty graph', () => {
        const testGraph = new Graph<string, { key: string }, {}>({}, [], {}, true)
        expect(topologicalSort(testGraph)).toEqual([])
    })

    it('should return sorted singletons on an acyclic graph', () => {
        const testGraph = new Graph<string, { key: string }, {}>(
            {
                A: { key: 'A' },
                B: { key: 'B' },
                C: { key: 'C' },
                D: { key: 'D' },
                E: { key: 'E' },
                F: { key: 'F' },
            },
            [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'A', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'F' }
            ],
            {}, true
        )
        expect(topologicalSort(testGraph)).toEqual([['A'], ['B'], ['C'], ['E'], ['D'], ['F']])
    })

    it('should group cycles', () => {
        const testGraph = new Graph<string, { key: string }, {}>(
            {
                A: { key: 'A' },
                B: { key: 'B' },
                C: { key: 'C' },
                D: { key: 'D' },
                E: { key: 'E' },
                F: { key: 'F' },
            },
            [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'A' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ],
            {}, true
        )
        expect(topologicalSort(testGraph)).toEqual([['A', 'B'], ['C'], ['D', 'E', 'F']])
    })

})

describe('generation order', () => {

    it('should return empty array on empty graph', () => {
        const testGraph = new Graph<string, { key: string }, {}>({}, [], {}, true)
        expect(generationOrder(testGraph)).toEqual([])
    })

    it('should return generations on an acyclic graph', () => {
        const testGraph = new Graph<string, { key: string }, {}>(
            {
                A: { key: 'A' },
                B: { key: 'B' },
                C: { key: 'C' },
                D: { key: 'D' },
                E: { key: 'E' },
                F: { key: 'F' },
            },
            [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'C' },
                { from: 'A', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'F' }
            ],
            {}, true
        )
        expect(generationOrder(testGraph)).toEqual([[['A']], [['B']], [['C']], [['E'], ['D']], [['F']]])
    })

    it('should group cycles', () => {
        const testGraph = new Graph<string, { key: string }, {}>(
            {
                A: { key: 'A' },
                B: { key: 'B' },
                C: { key: 'C' },
                D: { key: 'D' },
                E: { key: 'E' },
                F: { key: 'F' },
            },
            [
                { from: 'A', to: 'B' },
                { from: 'B', to: 'A' },
                { from: 'B', to: 'C' },
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'E' },
                { from: 'E', to: 'F' },
                { from: 'F', to: 'D' }
            ],
            {}, true
        )
        expect(generationOrder(testGraph)).toEqual([[['A', 'B']], [['C']], [['D', 'E', 'F']]])
    })

})