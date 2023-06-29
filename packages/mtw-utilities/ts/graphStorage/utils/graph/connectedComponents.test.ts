import { Graph } from '.'
import { compareEdges } from './baseClasses'
import connectedComponents from './connectedComponents'

describe('connectedComponents', () => {
    it('should return the entirety of a wholly connected graph', () => {
        const testGraph = new Graph(
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
            true
        )

        const components = connectedComponents(testGraph)
        expect(components.length).toEqual(1)
        expect(components[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' },
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
            { from: 'D', to: 'F' }
        ])
        expect(Object.keys(components[0].nodes).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])

    })

    it('should return the components of a disconnected graph', () => {
        const testGraph = new Graph(
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
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'F' }
            ],
            true
        )

        const components = connectedComponents(testGraph)
        expect(components.length).toEqual(2)
        expect(components[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
        ])
        expect(Object.keys(components[0].nodes).sort()).toEqual(['A', 'B'])

        expect(components[1].edges.sort(compareEdges)).toEqual([
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
            { from: 'D', to: 'F' }
        ])
        expect(Object.keys(components[1].nodes).sort()).toEqual(['C', 'D', 'E', 'F'])

    })

    it('should work on undirected graphs', () => {
        const testGraph = new Graph(
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
                { from: 'C', to: 'D' },
                { from: 'C', to: 'E' },
                { from: 'D', to: 'F' }
            ]
        )

        const components = connectedComponents(testGraph)
        expect(components.length).toEqual(2)
        expect(components[0].edges.sort(compareEdges)).toEqual([
            { from: 'A', to: 'B' },
        ])
        expect(Object.keys(components[0].nodes).sort()).toEqual(['A', 'B'])

        expect(components[1].edges.sort(compareEdges)).toEqual([
            { from: 'C', to: 'D' },
            { from: 'C', to: 'E' },
            { from: 'D', to: 'F' }
        ])
        expect(Object.keys(components[1].nodes).sort()).toEqual(['C', 'D', 'E', 'F'])

    })


})