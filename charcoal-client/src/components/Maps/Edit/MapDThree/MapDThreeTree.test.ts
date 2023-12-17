import { jest, beforeEach, describe, it, expect } from '@jest/globals'

import MapDThreeTree, { SimulationTreeNode, mapDFSWalk } from './MapDThreeTree'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { SimulationReturn } from './baseClasses'

const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

type MapDThreeDFSOutput = {
    data: SimulationReturn;
    previousLayer?: number;
}

describe('dfsWalk', () => {
    const walkCallback = ({ action, ...value }: (MapDThreeDFSOutput & { action: GenericTreeDiffAction })) => ([value])

    it('should return an empty list on an empty tree', () => {
        expect(mapDFSWalk(walkCallback)([])).toEqual([])
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
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual([])
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
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual([{
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
            previousLayers: []
        }])
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
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual([{
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
            previousLayers: []
        },
        {
            data: {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                visible: true
            },
            previousLayers: [0]
        },
        {
            data: {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                visible: true
            },
            previousLayers: [0, 1]
        },
        {
            data: {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                visible: true
            },
            previousLayers: [0, 1, 2]
        }])
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
        expect(mapDFSWalk(walkCallback)(incomingTree)).toEqual([{
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
            previousLayers: []
        },
        {
            data: {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                visible: false
            },
            previousLayers: [0]
        },
        {
            data: {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                visible: true
            },
            previousLayers: [0, 1]
        },
        {
            data: {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                visible: true
            },
            previousLayers: [0]
        }])
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
        expect(mapDFSWalk(testCallback)(incomingTree)).toEqual([{
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
        {
            key: 'Test-2',
            nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
            links: [],
            visible: true    
        },
        {
            key: 'Test-3',
            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
            links: [],
            visible: true    
        },
        {
            key: 'Test-4',
            nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
            links: [],
            visible: true    
        }])
        expect(outputs).toEqual([
            [],
            ['Room-1,Room-2'],
            ['Room-1,Room-2', 'Room-3'],
            ['Room-1,Room-2', 'Room-3', 'Room-4']
        ])
    })
})

describe('MapDThreeStack', () => {
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

    let testMapDThreeTree = new MapDThreeTree({ tree: [] })
    let testLayerOne = new MapDThreeIterator('stub', [], [])
    let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        testMapDThreeTree = new MapDThreeTree({ tree: testTree })
        testLayerOne = testMapDThreeTree.layers[0]
        Object.defineProperty(testLayerOne, 'nodes', { get: jest.fn().mockReturnValue([{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }]) })
        testLayerOne.key = 'Two'
        testLayerOne.simulation = { stop: jest.fn() } as any
        testLayerTwo = testMapDThreeTree.layers[1]
        Object.defineProperty(testLayerTwo, 'nodes', { get: jest.fn().mockReturnValue([{
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
        }]) })
        testLayerTwo.key = 'One'
    })

    it('should initialize layers on construction', () => {

        expect(MapDThreeIterator).toHaveBeenCalledTimes(2)
        expect(MapDThreeIterator).toHaveBeenCalledWith("Two", [{
            id: 'Two-A',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }], [])
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
            }], []
        )
    })

    it('should update correctly when node moved between layers', () => {
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
            

        expect(testLayerOne.update).toHaveBeenCalledWith([{
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
        }], [], true)

        expect(testLayerTwo.update).toHaveBeenCalledWith([{
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
            }], [], true)
    })

    it('should update correctly when layer removed', () => {
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

        expect(testLayerTwo.update).toHaveBeenCalledWith([{
                id: 'One-A',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }], [], true)

        expect(testLayerOne.simulation.stop).toHaveBeenCalledTimes(1)
        expect(testMapDThreeTree.layers.length).toEqual(1)
    })

})