import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'
import { MapDThreeTree, SimulationTreeNode } from './MapDThreeTree'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

describe('MapDThreeStack', () => {
    describe('_dfsSequence', () => {
        const testTree = new MapDThreeTree({ layers: [] })

        it('should return an empty list on an empty tree', () => {
            expect(testTree._dfsSequence([])).toEqual([])
        })

        it('should return an empty list on a tree with no positions or exits', () => {
            const incomingTree: GenericTree<SimulationTreeNode> = [{
                data: {
                    layer: {
                        key: 'Test-1',
                        nodes: [],
                        links: []
                    },
                    visible: true
                },
                children: []
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual([])
        })

        it('should return a single layer on an unnested tree', () => {
            const incomingTree: GenericTree<SimulationTreeNode> = [{
                data: {
                    layer: {
                        key: 'Test-1',
                        nodes: [
                            { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                            { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                        ],
                        links: [
                            { source: 'Room-1', target: 'Room-2' }
                        ]
                    },
                    visible: true
                },
                children: []
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual([{
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
            }])
        })

        it('should return a dfs order on a nested tree', () => {
            const incomingTree: GenericTree<SimulationTreeNode> = [{
                data: {
                    layer: {
                        key: 'Test-1',
                        nodes: [
                            { id: 'Room-1', cascadeNode: true, roomId: 'Room-1', visible: true, x: 0, y: 0 },
                            { id: 'Room-2', cascadeNode: true, roomId: 'Room-2', visible: true, x: 100, y: 0 }
                        ],
                        links: [
                            { source: 'Room-1', target: 'Room-2' }
                        ]
                    },
                    visible: true
                },
                children: [
                    {
                        data: {
                            layer: {
                                key: 'Test-2',
                                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                                links: []
                            },
                            visible: true    
                        },
                        children: [{
                            data: {
                                layer: {
                                    key: 'Test-3',
                                    nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                                    links: []
                                },
                                visible: true    
                            },
                            children: []
                        }]
                    },
                    {
                        data: {
                            layer: {
                                key: 'Test-4',
                                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                                links: []
                            },
                            visible: true    
                        },
                        children: []
                    }
                ]
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual([{
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
            }])
        })
    })
})