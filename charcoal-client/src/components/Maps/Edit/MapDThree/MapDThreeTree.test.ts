import { jest, beforeEach, describe, it, expect } from '@jest/globals'

import MapDThreeTree, { MapDFSWalkInnerCallbackReduce, SimulationTreeNode, mapDFSWalk } from './MapDThreeTree'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { SimNode, SimulationReturn } from './baseClasses'
import { SimulationLinkDatum } from 'd3-force'

const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

type MapDThreeDFSOutput = {
    data: SimulationReturn;
    previousLayer?: number;
}

describe('dfsWalk', () => {
    const translateLink = ({ source, target, ...rest }: SimulationLinkDatum<SimNode> & { id: string }): { index?: number; id: string; source: string; target: string } => ({
        source: typeof source === 'number' ? '' : typeof source === 'string' ? source: source.roomId,
        target: typeof target === 'number' ? '' : typeof target === 'string' ? target: target.roomId,
        ...rest
    })
    const walkCallback = ({ state }: MapDFSWalkInnerCallbackReduce, { treeNode: value, action }: { treeNode: SimulationTreeNode; action: GenericTreeDiffAction }) => ({ output: [{ type: 'add' as const, key: value.key, nodes: value.nodes, links: value.links.map(translateLink), getCascadeNodes: () => ([]) }], state })

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
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
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
                type: 'add',
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                getCascadeNodes: expect.any(Function)
            }],
            visibleLayers: [0]
        })
    })

    it('should return a dfs order on a nested tree', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
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
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                        links: [],
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
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
                        nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
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
                type: 'add',
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            }],
            visibleLayers: [0, 1, 2, 3]
        })
    })

    it('should return a nuanced dfs order on a nested tree with invisible branches', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
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
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                        links: [],
                        visible: false
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
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
                        nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
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
                type: 'add',
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { id: 'Room-1#Room-2', source: 'Room-1', target: 'Room-2' }
                ],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                getCascadeNodes: expect.any(Function)
            }],
            visibleLayers: [0, 3]
        })
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
                cascadeNode: false
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
                cascadeNode: true
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                x: 300,
                y: 200,
                visible: true,
                cascadeNode: false
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
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
            visible: true
        }]
        const nodesTwo = [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: true,
            x: 300,
            y: 300,
            visible: true
        },
        {
            id: 'One-B',
            roomId: 'DEF',
            cascadeNode: false,
            x: 300,
            y: 200,
            visible: true
        },
        {
            id: 'One-A',
            roomId: 'ABC',
            cascadeNode: false,
            x: 200,
            y: 200,
            visible: true
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
            visible: true
        }], [], expect.any(Function))
        expect(MapDThreeIterator).toHaveBeenCalledWith("One", [{
                id: 'Two-A',
                roomId: 'GHI',
                cascadeNode: true,
                x: 300,
                y: 300,
                visible: true
            },
            {
                id: 'One-B',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                cascadeNode: false,
                x: 200,
                y: 200,
                visible: true
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
                    cascadeNode: false
                },
                {
                    id: 'One-B',
                    roomId: 'DEF',
                    x: 300,
                    y: 200,
                    visible: true,
                    cascadeNode: false
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
                    cascadeNode: true
                },
                {
                    id: 'One-A',
                    roomId: 'ABC',
                    x: 200,
                    y: 200,
                    visible: true,
                    cascadeNode: false
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
            cascadeNode: false
        },
        {
            id: 'One-B',
            roomId: 'DEF',
            x: 300,
            y: 200,
            visible: true,
            cascadeNode: false
        }], [], true, expect.any(Function))

        expect(testMapDThreeTree.layers[1].update).toHaveBeenCalledWith([{
                id: 'Two-A',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: true
            },
            {
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
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
                    cascadeNode: false
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
                cascadeNode: false
            }], [], true, expect.any(Function))

        expect(deletedLayer.simulation.stop).toHaveBeenCalledTimes(1)
        expect(testMapDThreeTree.layers.length).toEqual(1)
    })

})