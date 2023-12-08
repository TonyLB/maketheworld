import { jest, beforeEach, describe, it, expect } from '@jest/globals'

import MapDThreeTree, { MapDFSWalk, SimulationTreeNode } from './MapDThreeTree'

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
        const testWalk = new MapDFSWalk(walkCallback)
        expect(testWalk.walk([])).toEqual({ output: [] })
    })

    it('should return an empty list on a tree with no positions or exits', () => {
        const testWalk = new MapDFSWalk(walkCallback)
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
        expect(testWalk.walk(incomingTree)).toEqual({ output: [] })
    })

    it('should return a single layer on an unnested tree', () => {
        const testWalk = new MapDFSWalk(walkCallback)
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
                ],
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: []
        }]
        expect(testWalk.walk(incomingTree)).toEqual({ output: [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
                ]
            }
        }], cascadeIndex: 0 })
    })

    it('should return a dfs order on a nested tree', () => {
        const testWalk = new MapDFSWalk(walkCallback)
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
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
        expect(testWalk.walk(incomingTree)).toEqual({ output: [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
                ]
            }
        },
        {
            data: {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: []
            },
            previousLayer: 0
        },
        {
            data: {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: []
            },
            previousLayer: 1
        },
        {
            data: {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: []
            },
            previousLayer: 2
        }], cascadeIndex: 3 })
    })

    it('should return a nuanced dfs order on a nested tree with invisible branches', () => {
        const testWalk = new MapDFSWalk(walkCallback)
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
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
        expect(testWalk.walk(incomingTree)).toEqual({ output: [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
                ]
            }
        },
        {
            data: {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: []
            },
            previousLayer: 0
        },
        {
            data: {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: []
            },
            previousLayer: 1
        },
        {
            data: {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: []
            },
            previousLayer: 0
        }], cascadeIndex: 3 })
    })

    it('should not append invisible branches to the cascadeIndex returned', () => {
        const testWalk = new MapDFSWalk(walkCallback)
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
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
                        visible: false
                    },
                    action: GenericTreeDiffAction.Add,
                    children: []
                }
            ]
        }]
        expect(testWalk.walk(incomingTree)).toEqual({ output: [{
            data: {
                key: 'Test-1',
                nodes: [
                    { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                    { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                ],
                links: [
                    { source: 'Room-1', target: 'Room-2' }
                ]
            }
        },
        {
            data: {
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: []
            },
            previousLayer: 0
        },
        {
            data: {
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: []
            },
            previousLayer: 1
        },
        {
            data: {
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: []
            },
            previousLayer: 0
        }], cascadeIndex: 0 })
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

    let testMapDThreeStack = new MapDThreeTree({ tree: [] })
    let testLayerOne = new MapDThreeIterator('stub', [], [])
    let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        testMapDThreeStack = new MapDThreeTree({ tree: testTree })
        testLayerOne = testMapDThreeStack.layers[0]
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
        testLayerTwo = testMapDThreeStack.layers[1]
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
        testMapDThreeStack.update([{
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
        testMapDThreeStack.update([{
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
        expect(testMapDThreeStack.layers.length).toEqual(1)
    })

})