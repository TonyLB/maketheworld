import { jest, beforeEach, describe, it, expect } from '@jest/globals'

import MapDThreeTree, { MapDFSWalkInnerCallbackReduce, SimulationTreeNode, mapDFSWalk, mapTreeTranslate } from './MapDThreeTree'

jest.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { SimNode, SimulationReturn } from './baseClasses'
import { SimulationLinkDatum } from 'd3-force'
import { Schema } from '@tonylb/mtw-wml/dist/schema'
import { assertTypeguard, Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { isStandardMap, StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'

const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

type MapDThreeDFSOutput = {
    data: SimulationReturn;
    previousLayer?: number;
}

describe('mapTreeTranslate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should aggregate nodes and links', () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
            <Asset key=(testOne)>
                <Map key=(testMap)>
                    <Room key=(Room1)><Position x="100" y="100" /></Room>
                    <Room key=(Room2)>
                        <Position x="0" y="100" />
                        <Exit to=(Room1)>TestExit</Exit>
                    </Room>
                </Map>
            </Asset>
        `)
        const testStandard = new Standardizer(testSchema.schema)
    
        const testComponent = testStandard.standardForm.byId.testMap
        
        const testTree = assertTypeguard(testComponent, isStandardMap)?.positions ?? []
    
        expect(mapTreeTranslate({ tree: testTree, standardForm: testStandard.standardForm, onChange: () => {} })).toEqual([{
            data: {
                nodes: [
                    { id: 'Room1', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: false },
                    { id: 'Room2', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: false }
                ],
                links: [
                    { id: 'Room2:Room1', source: 'Room2', target: 'Room1' }
                ],
                onChange: expect.any(Function),
                visible: true,
                key: ''
            },
            children: []
        }])
    })

    it('should nest conditionals as children of nodes and links', () => {
        const testArgs = (selected: boolean): { tree: GenericTree<SchemaTag>, standardForm: StandardForm, onChange: () => void } => {
            const testSchema = new Schema()
            testSchema.loadWML(`
                <Asset key=(testOne)>
                    <Map key=(testMap)>
                        <Room key=(Room1)><Position x="100" y="100" /></Room>
                        <Room key=(Room2)>
                            <Position x="0" y="100" />
                            <Exit to=(Room1)>TestExit</Exit>
                        </Room>
                        <If {true}${selected ? ' selected' : ''}>
                            <Room key=(Room3)><Position x="-200" y="100" /></Room>
                            <Room key=(Room4)><Position x="200" y="100" /></Room>
                        </If>
                        <Room key=(Room3)><Position x="-100" y="100" /></Room>
                    </Map>
                </Asset>
            `)
            const testStandard = new Standardizer(testSchema.schema)
        
            const testComponent = testStandard.standardForm.byId.testMap
            
            const testTree = assertTypeguard(testComponent, isStandardMap)?.positions ?? []
    
            return { tree: testTree, standardForm: testStandard.standardForm, onChange: () => {} }
        }

        const expectedResult = (selected: boolean) => ([{
            data: {
                nodes: [
                    { id: 'Room1', roomId: 'Room1', x: 100, y: 100, visible: true, cascadeNode: false },
                    { id: 'Room2', roomId: 'Room2', x: 0, y: 100, visible: true, cascadeNode: false },
                    { id: 'Room3', roomId: 'Room3', x: -100, y: 100, visible: true, cascadeNode: false }
                ],
                links: [
                    { id: 'Room2:Room1', source: 'Room2', target: 'Room1' }
                ],
                onChange: expect.any(Function),
                visible: true,
                key: ''
            },
            children: [
                {
                    data: {
                        nodes: [{ id: 'Room3', roomId: 'Room3', x: -200, y: 100, visible: true, cascadeNode: false }, { id: 'Room4', roomId: 'Room4', x: 200, y: 100, visible: true, cascadeNode: false }],
                        links: [],
                        onChange: expect.any(Function),
                        visible: selected,
                        key: '::(true)'
                    },
                    children: []
                }
            ]
        }])
        expect(mapTreeTranslate(testArgs(false))).toEqual(expectedResult(false))
        expect(mapTreeTranslate(testArgs(true))).toEqual(expectedResult(true))
    })

})

describe('dfsWalk', () => {
    const translateLink = ({ source, target, ...rest }: SimulationLinkDatum<SimNode> & { id: string }): { index?: number; id: string; source: string; target: string } => ({
        source: typeof source === 'number' ? '' : typeof source === 'string' ? source: source.roomId,
        target: typeof target === 'number' ? '' : typeof target === 'string' ? target: target.roomId,
        ...rest
    })
    const walkCallback = ({ state }: MapDFSWalkInnerCallbackReduce, { treeNode: value, action }: { treeNode: SimulationTreeNode; action: GenericTreeDiffAction }) => ({ output: [{ type: 'add' as const, key: value.key, nodes: value.nodes, links: value.links.map(translateLink), onChange: () => {}, getCascadeNodes: () => ([]) }], state })

    it('should return an empty list on an empty tree', () => {
        expect(mapDFSWalk(walkCallback)([])).toEqual({ output: [], visibleLayers: [] })
    })

    it('should return an empty list on a tree with no positions or exits', () => {
        const incomingTree: GenericTreeDiff<SimulationTreeNode> = [{
            data: {
                key: 'Test-1',
                nodes: [],
                links: [],
                onChange: () => {},
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
                onChange: () => {},
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
                onChange: expect.any(Function),
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
                onChange: () => {},
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: [
                {
                    data: {
                        key: 'Test-2',
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                        links: [],
                        onChange: () => {},
                        visible: true    
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                            links: [],
                            onChange: () => {},
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
                        onChange: () => {},
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
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                onChange: expect.any(Function),
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
                onChange: () => {},
                visible: true
            },
            action: GenericTreeDiffAction.Add,
            children: [
                {
                    data: {
                        key: 'Test-2',
                        nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                        links: [],
                        onChange: () => {},
                        visible: false
                    },
                    action: GenericTreeDiffAction.Add,
                    children: [{
                        data: {
                            key: 'Test-3',
                            nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                            links: [],
                            onChange: () => {},
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
                        onChange: () => {},
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
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-2',
                nodes: [{ id: 'Room-3', cascadeNode: true, roomId: 'Room-3', visible: true, x: -100, y: 0 }],
                links: [],
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-3',
                nodes: [{ id: 'Room-4', cascadeNode: true, roomId: 'Room-4', visible: true, x: 0, y: 100 }],
                links: [],
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            },
            {
                type: 'add',
                key: 'Test-4',
                nodes: [{ id: 'Room-5', cascadeNode: true, roomId: 'Room-5', visible: true, x: 0, y: -100 }],
                links: [],
                onChange: expect.any(Function),
                getCascadeNodes: expect.any(Function)
            }],
            visibleLayers: [0, 3]
        })
    })

})

describe('MapDThreeStack', () => {

    const testSchema = new Schema()
    testSchema.loadWML(`
        <Asset key=(testOne)>
            <Map key=(testMap)>
                <Room key=(GHI)><Position x="300" y="300" /></Room>
                <Room key=(DEF)><Position x="300" y="200" /></Room>
                <Room key=(ABC)><Position x="200" y="200" /></Room>
                <If {true}>
                    <Room key=(GHI)><Position x="300" y="300" /></Room>
                </If>
            </Map>
        </Asset>
    `)
    const testStandard = new Standardizer(testSchema.schema)

    const testComponent = testStandard.standardForm.byId.testMap
    
    const testTree = assertTypeguard(testComponent, isStandardMap)?.positions ?? []

    // let testMapDThreeTree = new MapDThreeTree({ tree: [] })
    // let testLayerOne = new MapDThreeIterator('stub', [], [])
    // let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const nodesOne = [{
            id: 'GHI',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }]
        const nodesTwo = [{
            id: 'GHI',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        },
        {
            id: 'DEF',
            roomId: 'DEF',
            cascadeNode: false,
            x: 300,
            y: 200,
            visible: true
        },
        {
            id: 'ABC',
            roomId: 'ABC',
            cascadeNode: false,
            x: 200,
            y: 200,
            visible: true
        }]
        MapDThreeIterator
            .mockImplementationOnce(() => ({
                nodes: nodesTwo,
                _nodes: nodesTwo,
                key: '',
                simulation: { stop: jest.fn() },
                setCallbacks: jest.fn(),
                liven: jest.fn(),
                update: jest.fn()
            } as any))
            .mockImplementationOnce(() => ({
                nodes: nodesOne,
                _nodes: nodesOne,
                key: '::(true)',
                simulation: { stop: jest.fn() },
                setCallbacks: jest.fn(),
                liven: jest.fn(),
                update: jest.fn()
            } as any))
    })

    it('should initialize layers on construction', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree, standardForm: testStandard.standardForm, onChange: () => {} })
        expect(MapDThreeIterator).toHaveBeenCalledTimes(2)
        expect(MapDThreeIterator).toHaveBeenCalledWith("::(true)", [{
            id: 'GHI',
            roomId: 'GHI',
            cascadeNode: false,
            x: 300,
            y: 300,
            visible: true
        }], [], expect.any(Function), expect.any(Function))
        expect(MapDThreeIterator).toHaveBeenCalledWith("", [{
                id: 'GHI',
                roomId: 'GHI',
                cascadeNode: false,
                x: 300,
                y: 300,
                visible: true
            },
            {
                id: 'DEF',
                roomId: 'DEF',
                cascadeNode: false,
                x: 300,
                y: 200,
                visible: true
            },
            {
                id: 'ABC',
                roomId: 'ABC',
                cascadeNode: false,
                x: 200,
                y: 200,
                visible: true
            }], [], expect.any(Function), expect.any(Function)
        )
    })

    it('should update correctly when node moved between layers', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree, standardForm: testStandard.standardForm, onChange: () => {} })
        const testUpdateSchema = new Schema()
        testUpdateSchema.loadWML(`
            <Asset key=(testOne)>
                <Map key=(testMap)>
                    <Room key=(GHI)><Position x="300" y="300" /></Room>
                    <Room key=(DEF)><Position x="300" y="200" /></Room>
                    <If {true}>
                        <Room key=(GHI)><Position x="300" y="300" /></Room>
                        <Room key=(ABC)><Position x="200" y="200" /></Room>
                    </If>
                </Map>
            </Asset>
        `)
        const testUpdateStandard = new Standardizer(testUpdateSchema.schema)
    
        const testUpdateComponent = testUpdateStandard.standardForm.byId.testMap
        
        const testUpdateTree = assertTypeguard(testUpdateComponent, isStandardMap)?.positions ?? []
        
        testMapDThreeTree.update(testUpdateTree, testUpdateStandard.standardForm, () => {})

        expect(testMapDThreeTree.layers[0].update).toHaveBeenCalledWith([{
            id: 'GHI',
            roomId: 'GHI',
            x: 300,
            y: 300,
            visible: true,
            cascadeNode: false
        },
        {
            id: 'DEF',
            roomId: 'DEF',
            x: 300,
            y: 200,
            visible: true,
            cascadeNode: false
        }], [], true, expect.any(Function), expect.any(Function))

        expect(testMapDThreeTree.layers[1].update).toHaveBeenCalledWith([{
                id: 'GHI',
                roomId: 'GHI',
                x: 300,
                y: 300,
                visible: true,
                cascadeNode: false
            },
            {
                id: 'ABC',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }], [], true, expect.any(Function), expect.any(Function))
    })

    it('should update correctly when layer removed', () => {
        const testMapDThreeTree = new MapDThreeTree({ tree: testTree, standardForm: testStandard.standardForm, onChange: () => {} })
        const testUpdateSchema = new Schema()
        testUpdateSchema.loadWML(`
            <Asset key=(testOne)>
                <Map key=(testMap)>
                    <Room key=(ABC)><Position x="200" y="200" /></Room>
                </Map>
            </Asset>
        `)
        const testUpdateStandard = new Standardizer(testUpdateSchema.schema)
    
        const testUpdateComponent = testUpdateStandard.standardForm.byId.testMap
        
        const testUpdateTree = assertTypeguard(testUpdateComponent, isStandardMap)?.positions ?? []
    
        const movedLayer = testMapDThreeTree.layers[0]
        const deletedLayer = testMapDThreeTree.layers[1]
        testMapDThreeTree.update(testUpdateTree, testUpdateStandard.standardForm, () => {})

        expect(movedLayer.update).toHaveBeenCalledWith([{
                id: 'ABC',
                roomId: 'ABC',
                x: 200,
                y: 200,
                visible: true,
                cascadeNode: false
            }], [], true, expect.any(Function), expect.any(Function))

        expect(deletedLayer.simulation.stop).toHaveBeenCalledTimes(1)
        expect(testMapDThreeTree.layers.length).toEqual(1)
    })

})