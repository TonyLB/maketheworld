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
            expect(testTree._dfsSequence([])).toEqual({ output: [] })
        })

        it('should return an empty list on a tree with no positions or exits', () => {
            const incomingTree: GenericTree<SimulationTreeNode> = [{
                data: {
                    key: 'Test-1',
                    nodes: [],
                    links: [],
                    visible: true
                },
                children: []
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual({ output: [] })
        })

        it('should return a single layer on an unnested tree', () => {
            const incomingTree: GenericTree<SimulationTreeNode> = [{
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
                children: []
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual({ output: [{
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
            const incomingTree: GenericTree<SimulationTreeNode> = [{
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
                children: [
                    {
                        data: {
                            key: 'Test-2',
                            nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                            links: [],
                            visible: true    
                        },
                        children: [{
                            data: {
                                key: 'Test-3',
                                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                                links: [],
                                visible: true    
                            },
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
                        children: []
                    }
                ]
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual({ output: [{
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
            const incomingTree: GenericTree<SimulationTreeNode> = [{
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
                children: [
                    {
                        data: {
                            key: 'Test-2',
                            nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                            links: [],
                            visible: false
                        },
                        children: [{
                            data: {
                                key: 'Test-3',
                                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                                links: [],
                                visible: true    
                            },
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
                        children: []
                    }
                ]
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual({ output: [{
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
            const incomingTree: GenericTree<SimulationTreeNode> = [{
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
                children: [
                    {
                        data: {
                            key: 'Test-2',
                            nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                            links: [],
                            visible: false
                        },
                        children: [{
                            data: {
                                key: 'Test-3',
                                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                                links: [],
                                visible: true    
                            },
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
                        children: []
                    }
                ]
            }]
            expect(testTree._dfsSequence(incomingTree)).toEqual({ output: [{
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
})