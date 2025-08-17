import { vi } from 'vitest'
import MapDThreeTree, { MapDFSWalkInnerCallbackReduce, SimulationTreeNode, mapDFSWalk, mapTreeTranslate, mapTranslate } from './MapDThreeTree'

vi.mock('./MapDThreeIterator.tsx')
import MapDThreeIteratorRaw from './MapDThreeIterator'

import { mockClass } from '../../../../lib/jestHelpers'
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from '@tonylb/mtw-base/ts/genericTree'
import { SimNode, SimulationReturn } from './baseClasses'
import { SimulationLinkDatum } from 'd3-force'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { assertInstance, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'

const MapDThreeIterator = mockClass(MapDThreeIteratorRaw)

describe('mapTreeTranslate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
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
        const testStandard = new StandardForm(testSchema.schema[0])
    
        const testComponent = testStandard.byId.testMap
        
        const testTree = assertInstance(testComponent, StandardMap)?.positions ?? []
    
        expect(mapTreeTranslate({ tree: testTree, standardForm: testStandard.toJSON(), onChange: () => {} })).toEqual([{
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
        const testArgs = (selected: boolean): { tree: GenericTree<SchemaTag>, standardForm: StandardFormData, onChange: () => void } => {
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
            const testStandard = new StandardForm(testSchema.schema[0])
        
            const testComponent = testStandard.byId.testMap
            
            const testTree = assertInstance(testComponent, StandardMap)?.positions ?? []
    
            return { tree: testTree, standardForm: testStandard.toJSON(), onChange: () => {} }
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

describe('mapTranslate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    it('should translate a simple map with rooms and positions', () => {
        const testStandard = new StandardForm(`
            <Asset key=(testOne)>
                <Map uuid=(testMap)>
                    <Room uuid=(Room1)><Position x="100" y="100" /></Room>
                    <Room uuid=(Room2)><Position x="200" y="150" /></Room>
                    <Room uuid=(Room3)><Position x="300" y="200" /></Room>
                </Map>
            </Asset>
        `)
        
        const result = mapTranslate({ 
            mapId: 'MAP#testMap', 
            standardForm: testStandard 
        })
        
        expect(result.nodes).toEqual([
            { id: 'ROOM#Room1', x: 100, y: 100 },
            { id: 'ROOM#Room2', x: 200, y: 150 },
            { id: 'ROOM#Room3', x: 300, y: 200 }
        ])
        expect(result.links).toEqual([])
    })

    it('should translate a map with rooms, positions, and exits', () => {
        const testStandard = new StandardForm(`
            <Asset key=(testOne)>
                <Map uuid=(testMap)>
                    <Room uuid=(Room1)><Position x="100" y="100" /></Room>
                    <Room uuid=(Room2)>
                        <Position x="200" y="150" />
                        <Exit to=(ROOM#Room1)>North</Exit>
                        <Exit to=(ROOM#Room3)>South</Exit>
                    </Room>
                    <Room uuid=(Room3)><Position x="200" y="250" /></Room>
                </Map>
            </Asset>
        `)
        
        const result = mapTranslate({ 
            mapId: 'MAP#testMap', 
            standardForm: testStandard 
        })
        
        expect(result.nodes).toEqual([
            { id: 'ROOM#Room1', x: 100, y: 100 },
            { id: 'ROOM#Room2', x: 200, y: 150 },
            { id: 'ROOM#Room3', x: 200, y: 250 }
        ])
        expect(result.links).toEqual([
            { id: 'ROOM#Room2:ROOM#Room1', source: 'ROOM#Room2', target: 'ROOM#Room1' },
            { id: 'ROOM#Room2:ROOM#Room3', source: 'ROOM#Room2', target: 'ROOM#Room3' }
        ])
    })

    it('should throw error when map is not found', () => {
        const testStandard = new StandardForm(`
            <Asset key=(testOne)>
                <Room uuid=(Room1)><Position x="100" y="100" /></Room>
            </Asset>
        `)
        
        expect(() => mapTranslate({ 
            mapId: 'MAP#nonexistent', 
            standardForm: testStandard 
        })).toThrow('Map MAP#nonexistent not found in standardForm')
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
    const testStandard = new StandardForm(testSchema.schema[0])

    const testComponent = testStandard.byId.testMap
    
    const testTree = assertInstance(testComponent, StandardMap)?.positions ?? []

    // let testMapDThreeTree = new MapDThreeTree({ tree: [] })
    // let testLayerOne = new MapDThreeIterator('stub', [], [])
    // let testLayerTwo = new MapDThreeIterator('stub', [], [])

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
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
                simulation: { stop: vi.fn() },
                setCallbacks: vi.fn(),
                liven: vi.fn(),
                update: vi.fn()
            } as any))
            .mockImplementationOnce(() => ({
                nodes: nodesOne,
                _nodes: nodesOne,
                key: '::(true)',
                simulation: { stop: vi.fn() },
                setCallbacks: vi.fn(),
                liven: vi.fn(),
                update: vi.fn()
            } as any))
    })

    it('should initialize layers on construction', () => {
        const inherited = new StandardForm(`
            <Asset key=(inherited)>
                <Map uuid=(testMap)>
                    <Room uuid=(ABC) origin=(ASSET#inherited)><Position x="200" y="200" /></Room>
                    <Room uuid=(DEF) origin=(ASSET#inherited)><Position x="100" y="200" /></Room>
                </Map>
            </Asset>
        `)
        const editable = new StandardForm(`
            <Asset key=(editable)>
                <Map uuid=(testMap)>
                    <Room uuid=(DEF)><Position x="300" y="200" /></Room>
                    <Room uuid=(GHI)><Position x="300" y="300" /></Room>
                </Map>
            </Asset>
        `)
        const testMapDThreeTree = new MapDThreeTree({ mapId: 'MAP#testMap', inherited, editable, onChange: () => {} })
        expect(MapDThreeIterator).toHaveBeenCalledTimes(2)
        expect(MapDThreeIterator).toHaveBeenCalledWith([
            { id: 'ROOM#DEF', x: 300, y: 200 },
            { id: 'ROOM#GHI', x: 300, y: 300 }
        ], [], expect.any(Function), expect.any(Function))
        expect(MapDThreeIterator).toHaveBeenCalledWith([
            { id: 'ROOM#ABC', x: 200, y: 200 },
            { id: 'ROOM#DEF', x: 100, y: 200 }
            ], [], expect.any(Function), expect.any(Function)
        )
    })

})