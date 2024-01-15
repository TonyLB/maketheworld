import { describe, it, expect } from '@jest/globals'

import { GenericTree, GenericTreeID, GenericTreeIDNode, GenericTreeNode } from './baseClasses'
import dfsWalk from './dfsWalk'

describe('dfsWalk', () => {
    const walkCallback = ({ state, output }: { output: string[]; state: {} }, value: string) => ({ output: [...output, value], state })
    const testWalk = dfsWalk<string, string[], {}, GenericTreeNode<string>>({ default: { output: [], state: {}}, callback: walkCallback })

    it('should return an empty list on an empty tree', () => {
        expect(testWalk([])).toEqual([])
    })

    it('should return a simple list on an unnested tree', () => {
        const incomingTree: GenericTree<string> = [{
            data: 'Test-1',
            children: []
        },
        {
            data: 'Test-2',
            children: []
        }]
        expect(testWalk(incomingTree)).toEqual(['Test-1', 'Test-2'])
    })

    it('should return a dfs order on a nested tree', () => {
        const incomingTree: GenericTree<string> = [{
            data: 'Test-1',
            children: [
                { data: 'Test-1a', children: [] },
                { data: 'Test-1b', children: [
                    { data: 'Test-1bi', children: [] },
                    { data: 'Test-1bii', children: [] }
                ] }
            ]
        },
        {
            data: 'Test-2',
            children: []
        }]
        expect(testWalk(incomingTree)).toEqual(['Test-1', 'Test-1a', 'Test-1b', 'Test-1bi', 'Test-1bii', 'Test-2'])
    })

    it('should nest and unNest when specified', () => {
        const nestingTestWalk = dfsWalk<string, string[], { nest?: string }, GenericTreeNode<string>>({
            default: { output: [], state: {}},
            callback: ({ state, output }: { output: string[]; state: { nest?: string } }, value: string) => ({ output: [...output, [state.nest, value].filter((value) => (value)).join('#')], state }),
            nest: ({ state, data }) => ({ nest: [state.nest ?? '', data].filter((value) => (value)).join('::') }),
            unNest: ({ previous }) => (previous)
        })
        const incomingTree: GenericTree<string> = [{
            data: 'Test-1',
            children: [
                { data: 'Test-1a', children: [] },
                { data: 'Test-1b', children: [
                    { data: 'Test-1bi', children: [] },
                    { data: 'Test-1bii', children: [] }
                ] }
            ]
        },
        {
            data: 'Test-2',
            children: []
        }]
        expect(nestingTestWalk(incomingTree)).toEqual(['Test-1', 'Test-1#Test-1a', 'Test-1#Test-1b', 'Test-1::Test-1b#Test-1bi', 'Test-1::Test-1b#Test-1bii', 'Test-2'])
    })

    it('should return state when called verbose', () => {
        const verboseTestWalk = dfsWalk<string, string[], number, GenericTreeNode<string>>({
            default: { output: [], state: 0},
            callback: ({ state, output }: { output: string[]; state }, value: string) => ({ output: [...output, value], state: state + 1 }),
            returnVerbose: true
        })
        const incomingTree: GenericTree<string> = [{
            data: 'Test-1',
            children: [
                { data: 'Test-1a', children: [] },
                { data: 'Test-1b', children: [
                    { data: 'Test-1bi', children: [] },
                    { data: 'Test-1bii', children: [] }
                ] }
            ]
        },
        {
            data: 'Test-2',
            children: []
        }]
        expect(verboseTestWalk(incomingTree)).toEqual({ output: ['Test-1', 'Test-1a', 'Test-1b', 'Test-1bi', 'Test-1bii', 'Test-2'], state: 6 })
    })

    it('should apply aggregate function when provided', () => {
        const verboseTestWalk = dfsWalk<string, string[], number, GenericTreeNode<string>>({
            default: { output: [], state: 0},
            callback: ({ state, output }: { output: string[]; state }, value: string) => ({ output: [...output, value], state: state + 1 }),
            aggregate: ({ direct, children }) => ({ output: [[...direct.output, ...children.output].join(', ')], state: children.state })
        })
        const incomingTree: GenericTree<string> = [{
            data: 'Test-1',
            children: [
                { data: 'Test-1a', children: [] },
                { data: 'Test-1b', children: [
                    { data: 'Test-1bi', children: [] },
                    { data: 'Test-1bii', children: [] }
                ] }
            ]
        },
        {
            data: 'Test-2',
            children: []
        }]
        expect(verboseTestWalk(incomingTree)).toEqual(['Test-1, Test-1a, Test-1b, Test-1bi, Test-1bii, Test-2'])
    })

    it('should handle GenericIDTree inputs', () => {
        const verboseTestWalk = dfsWalk<string, string[], number, GenericTreeIDNode<string>>({
            default: { output: [], state: 0 },
            callback: ({ state, output }: { output: string[]; state }, value: string, { id }: { id: string }) => ({ output: [...output, id], state: state + 1 }),
            aggregate: ({ direct, children }) => ({ output: [[...direct.output, ...children.output].join(', ')], state: children.state })
        })
        const incomingTree: GenericTreeID<string> = [{
            data: 'Test-1',
            id: 'A',
            children: [
                { data: 'Test-1a', children: [], id: 'B' },
                { data: 'Test-1b', id: 'C', children: [
                    { data: 'Test-1bi', children: [], id: 'D' },
                    { data: 'Test-1bii', children: [], id: 'E' }
                ] }
            ]
        },
        {
            data: 'Test-2',
            children: [],
            id: 'F'
        }]
        expect(verboseTestWalk(incomingTree)).toEqual(['A, B, C, D, E, F'])
    })

})