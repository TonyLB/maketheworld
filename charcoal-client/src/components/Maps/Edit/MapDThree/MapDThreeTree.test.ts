import { jest, beforeEach, describe, it, expect } from '@jest/globals'

import MapDThreeTree, { SimulationTreeNode, mapDFSWalk } from './MapDThreeTree'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { SimulationReturn } from './baseClasses'

const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

type MapDThreeDFSOutput = {
    data: SimulationReturn;
    previousLayer?: number;
}

describe('dfsWalk', () => {
    const walkCallback = ({ action, state, ...value }: (MapDThreeDFSOutput & { state: {}; action: GenericTreeDiffAction })) => ([value])
    const reference = { tag: 'Room' as const, key: '', index: 0 }

    it('should return an empty list on an empty tree', () => {
        expect(mapDFSWalk(walkCallback)([])).toEqual({ output: [], visibleLayers: [] })
    })

    it('should return an empty list on a tree with no positions or exits', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [],
                links: [],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: []
        }]
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual({ output: [], visibleLayers: [] })
    })

    it('should return a single layer on an unnested tree', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: []
        }]
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual({
            output: [{
                data: {
                    key: 'Test-1',
                    nodes: [
                        { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                        { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                    ],
                    links: [
                        { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                    ],
                    visible: true
                },
                previousLayers: []
            }],
            visibleLayers: [0]
        })
    })

    it('should return a dfs order on a nested tree', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: [
                {
                    data: {
                        key: 'Test-2',
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                            links: [],
                            visible: true    
                        },
                        action: GenericTreeDiffAction.Add,
                        children: []
                    }]
                },
                {
                    data: {
                        key: 'Test-4',
                        nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: []
                }
            ]
        }]
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual({
            output: [{
                data: {
                    key: 'Test-1',
                    nodes: [
                        { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                        { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                    ],
                    links: [
                        { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                    ],
                    visible: true
                },
                previousLayers: []
            },
            {
                data: {
                    key: 'Test-2',
                    nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                    links: [],
                    visible: true
                },
                previousLayers: [0]
            },
            {
                data: {
                    key: 'Test-3',
                    nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                    links: [],
                    visible: true
                },
                previousLayers: [0, 1]
            },
            {
                data: {
                    key: 'Test-4',
                    nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                    links: [],
                    visible: true
                },
                previousLayers: [0, 1, 2]
            }],
            visibleLayers: [0, 1, 2, 3]
        })
    })

    it('should return a nuanced dfs order on a nested tree with invisible branches', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: [
                {
                    data: {
                        key: 'Test-2',
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                        links: [],
                        visible: false
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                            links: [],
                            visible: true    
                        },
                        action: GenericTreeDiffAction.Add,
                        children: []
                    }]
                },
                {
                    data: {
                        key: 'Test-4',
                        nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: []
                }
            ]
        }]
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual({
            output: [{
                data: {
                    key: 'Test-1',
                    nodes: [
                        { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                        { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                    ],
                    links: [
                        { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                    ],
                    visible: true
                },
                previousLayers: []
            },
            {
                data: {
                    key: 'Test-2',
                    nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                    links: [],
                    visible: false
                },
                previousLayers: [0]
            },
            {
                data: {
                    key: 'Test-3',
                    nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                    links: [],
                    visible: true
                },
                previousLayers: [0, 1]
            },
            {
                data: {
                    key: 'Test-4',
                    nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                    links: [],
                    visible: true
                },
                previousLayers: [0]
            }],
            visibleLayers: [0, 1]
        })
    })

    it('should pass ongoing outputs to callback', () => {
        let outputs: string[][] = []
        const testCallback = ({ data }: (MapDThreeDFSOutput & { action: GenericTreeDiffAction }), output: SimulationReturn[]) => {
            outputs.push(output.map(({ nodes }) => (nodes.map(({ id }) => (id)).join(','))))
            return [data]
        }
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: [
                {
                    data: {
                        key: 'Test-2',
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                            links: [],
                            visible: true    
                        },
                        action: GenericTreeDiffAction.Add,
                        children: []
                    }]
                },
                {
                    data: {
                        key: 'Test-4',
                        nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: []
                }
            ]
        }]
        expect(mapDFSWalk(testCallback)(incomingTree)).toEqual({
            output: [{
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0, reference },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0, reference }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                visible: true    
            },
            {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0, reference }],
                links: [],
                visible: true    
            },
            {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100, reference }],
                links: [],
                visible: true    
            },
            {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100, reference }],
                links: [],
                visible: true    
            }],
            visibleLayers: [0, 1, 2, 3]
        })
        expect(outputs).toEqual([
            [],
            ['Room-1,Room-2'],
            ['Room-1,Room-2', 'Room-3'],
            ['Room-1,Room-2', 'Room-3', 'Room-4']
        ])
    })
})

describe('MapDThreeStack', () => {
    const reference = { tag: 'Room' as const, key: '', index: 0 }

    const testTree: GenericTree<SimulationTreeNode> = [{
        data: {
            key: 'Two',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: false,
                reference
            }],
            links: [],
            visible: true
        },
        children: []
    },
    {
        data: {
            key: 'One',
            nodes: [{
                id: 'Two-A',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: true,
                reference
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                x: 300,
                y: 200,
                visible: true,
                cascadeNode: false,
                reference
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false,
                reference
            }],
            links: [],
            visible: true
        },
        children: []
    }]

    // let testMapDThreeTree = new MapDThreeTree({ tree: [] })
    // let testLayerOne = new MapDThreeIterator('stub', [], [])
    // let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const nodesOne = [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true,
            reference
        }]
        const nodesTwo = [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: true,
            x: 300,
            y: 300,
            visible: true,
            reference
        },
        {
            id: 'One-B',
            roomId: 'DEF',
            cascadeNode: false,
            x: 300,
            y: 200,
            visible: true,
            reference
        },
        {
            id: 'One-A',
            roomId: 'ABC',
            cascadeNode: false,
            x: 200,
            y: 200,
            visible: true,
            reference
        }]
        MapDThreeIterator
            .mockImplementationOnce(() => ({
                nodes: nodesOne,
                _nodes: nodesOne,
                key: 'Two',
                simulation: { stop: jest.fn() },
                setCallbacks: jest.fn(),
                liven: jest.fn(),
                update: jest.fn()
            } as any))
            .mockImplementationOnce(() => ({
                nodes: nodesTwo,
                _nodes: nodesTwo,
                key: 'One',
                simulation: { stop: jest.fn() },
                setCallbacks: jest.fn(),
                liven: jest.fn(),
                update: jest.fn()
            } as any))
    })

    it('should initialize layers on construction', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree })
        expect(MapDThreeIterator).toHaveBeenCalledTimes(2)
        expect(MapDThreeIterator).toHaveBeenCalledWith("Two", [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true,
            reference
        }], [], expect.any(Function))
        expect(MapDThreeIterator).toHaveBeenCalledWith("One", [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: true,
                x: 300,
                y: 300,
                visible: true,
                reference
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true,
                reference
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                cascadeNode: false,
                x: 200,
                y: 200,
                visible: true,
                reference
            }], [], expect.any(Function)
        )
    })

    it('should update correctly when node moved between layers', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree })
        testMapDThreeTree.update([{
            data: {
                key: 'Two',
                nodes: [{
                    id: 'Two-A',
                    roomId: 'GHI',
                    x: 300,
                    y: 300,
                    visible: true,
                    cascadeNode: false,
                    reference
                },
                {
                    id: 'One-B',
                    roomId: 'DEF',
                    x: 300,
                    y: 200,
                    visible: true,
                    cascadeNode: false,
                    reference
                }],
                links: [],
                visible: true
            },
            children: []
        },
        {
            data: {
                key: 'One',
                nodes: [{
                    id: 'Two-A',
                    roomId: 'GHI',
                    x: 300,
                    y: 300,
                    visible: true,
                    cascadeNode: true,
                    reference
                },
                {
                    id: 'One-A',
                    roomId: 'ABC',
                    x: 200,
                    y: 200,
                    visible: true,
                    cascadeNode: false,
                    reference
                }],
                links: [],
                visible: true
            },
            children: []
        }])
            

        expect(testMapDThreeTree.layers[0].update).toHaveBeenCalledWith([{
            id: 'Two-A',
            roomId: 'GHI',
            x: 300,
            y: 300,
            visible: true,
            cascadeNode: false,
            reference
        },
        {
            id: 'One-B',
            roomId: 'DEF',
            x: 300,
            y: 200,
            visible: true,
            cascadeNode: false,
            reference
        }], [], true, expect.any(Function))

        expect(testMapDThreeTree.layers[1].update).toHaveBeenCalledWith([{
                id: 'Two-A',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: true,
                reference
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false,
                reference
            }], [], true, expect.any(Function))
    })

    it('should update correctly when layer removed', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree })
        const movedLayer = testMapDThreeTree.layers[1]
        const deletedLayer = testMapDThreeTree.layers[0]
        testMapDThreeTree.update([{
            data: {
                key: 'One',
                nodes: [{
                    id: 'One-A',
                    roomId: 'ABC',
                    x: 200,
                    y: 200,
                    visible: true,
                    cascadeNode: false,
                    reference
                }],
                links: [],
                visible: true
            },
            children: []
        }])

        expect(movedLayer.update).toHaveBeenCalledWith([{
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false,
                reference
            }], [], true, expect.any(Function))

        expect(deletedLayer.simulation.stop).toHaveBeenCalledTimes(1)
        expect(testMapDThreeTree.layers.length).toEqual(1)
    })

})