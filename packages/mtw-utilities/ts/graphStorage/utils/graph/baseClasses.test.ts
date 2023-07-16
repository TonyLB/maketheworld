import { GraphEdge, compareEdges } from './baseClasses'

describe('graph base utilities', () => {
    describe('compareEdges', () => {
        it('should sort edges properly', () => {
            const testEdges: GraphEdge<string, {}>[] = [
                { from: 'C', to : 'B' },
                { from: 'A', to: 'B' },
                { from: 'B', to: 'D' },
                { from: 'A', to: 'C' }
            ]
            expect(testEdges.sort(compareEdges)).toEqual([
                { from: 'A', to: 'B' },
                { from: 'A', to: 'C' },
                { from: 'B', to: 'D' },
                { from: 'C', to: 'B' }
            ])
        })
    })
})