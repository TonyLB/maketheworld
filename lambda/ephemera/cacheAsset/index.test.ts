import { jest, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update/index'

jest.mock('@tonylb/mtw-utilities/dist/computation/sandbox')
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox'
jest.mock('./mergeIntoEphemera')
import { mergeIntoEphemera } from './mergeIntoEphemera'

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('./dependencyUpdate')

import { cacheAsset } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { BaseAppearance, NormalForm } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { NamespaceMapping, WorkspaceProperties } from '@tonylb/mtw-asset-workspace/dist/readOnly'

//
// TS nesting is deep enough that if we don't flag then it will complain
//
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>

let mockTestAsset: NormalForm = {
    'Import-0': {
        tag: 'Import',
        from: 'BASE',
        key: 'Import-0',
        appearances: [{
            data: { tag: 'Import', from: 'BASE', key: 'Import-0', mapping: {} },
            children: [],
            contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
        }],
        mapping: {}
    },
    Test: {
        tag: 'Asset',
        key: 'Test',
        appearances: [{
            data: { tag: 'Asset', key: 'Test', Story: undefined },
            children: [{ data: { tag: 'Import', key: 'Import-0', index: 0 }, children: [] }],
            contextStack: []
        }]
    }
}
let mockNamespaceMap: NamespaceMapping = [
    { internalKey: 'Test', universalKey: 'ASSET#Test' },
    { internalKey: 'Tess', universalKey: 'CHARACTER#Tess' }
]

let mockProperties: WorkspaceProperties = { image1: { fileName: 'test.png' } }

jest.mock('@tonylb/mtw-asset-workspace/dist/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            get fileNameBase() {
                if (address.zone === 'Personal') {
                    return 'Personal/Test/Test'
                }
                else {
                    return 'Library/Test'
                }
            },
            loadJSON: jest.fn(),
            normal: mockTestAsset,
            namespaceIdToDB: mockNamespaceMap,
            universalKey: jest.fn().mockImplementation((key) => {
                const matchRecord = mockNamespaceMap.find(({ internalKey }) => (internalKey === key))
                return matchRecord?.universalKey
            }),
            properties: mockProperties
        }
    })
})

const evaluateCodeMock = evaluateCode as jest.Mock

describe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        mockTestAsset = {
            'Import-0': {
                tag: 'Import',
                from: 'BASE',
                key: 'Import-0',
                appearances: [{
                    data: { tag: 'Import', from: 'BASE', key: 'Import-0', mapping: {} },
                    children: [],
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
                }],
                mapping: {}
            },
            Test: {
                tag: 'Asset',
                key: 'Test',
                appearances: [{
                    data: { tag: 'Asset', key: 'Test', Story: undefined },
                    children: [{ data: { tag: 'Import', key: 'Import-0', index: 0 }, children: [] }],
                    contextStack: []
                }]
            }
        }
        mockNamespaceMap = [
            { internalKey: 'Test', universalKey: 'ASSET#Test' }
        ]
        internalCacheMock.CharacterConnections.get.mockResolvedValue([])
        internalCacheMock.Graph.get.mockResolvedValue(new Graph(
            { 'ASSET#BASE': { key: 'ASSET#BASE'}, 'ASSET#Test': { key: 'ASSET#Test' } },
            [{ to: 'ASSET#BASE', from: 'ASSET#Test', context: '' }],
            {},
            true
        ))
        GraphUpdateMock.mockClear()
    })

    it('should skip processing when check option and already present', async () => {
        internalCacheMock.AssetMeta.get.mockResolvedValue({ EphemeraId: 'ASSET#Test' })
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })
        await cacheAsset({
            assetId: 'ASSET#Test',
            check: true,
            messageBus: messageBusMock
        })

        expect(mergeIntoEphemera).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should send rooms in need of update', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })
        const topLevelAppearance: Omit<BaseAppearance, 'data'> = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            children: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'test', universalKey: 'ASSET#test' },
            { internalKey: 'ABC', universalKey: 'ROOM#DEF' },
            { internalKey: 'active', universalKey: 'COMPUTED#XYZ' },
            { internalKey: 'powered', universalKey: 'VARIABLE#QRS' },
            { internalKey: 'switchedOn', universalKey: 'VARIABLE#TUV' },
            { internalKey: 'testKnowledge', universalKey: 'KNOWLEDGE#GHI' }
        ]
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    data: { tag: 'Asset', fileName: 'test', key: 'test', Story: undefined },
                    children: [
                        { data: { key: 'ABC', tag: 'Room', index: 0 }, children: [] },
                        { data: { key: 'If-0', tag: 'If', index: 0 }, children: [] },
                        { data: { key: 'testKnowledge', tag: 'Knowledge', index: 0 }, children: [] },
                        { data: { key: 'powered', tag: 'Variable', index: 0 }, children: [] },
                        { data: { key: 'switchedOn', tag: 'Variable', index: 0 }, children: [] },
                        { data: { key: 'active', tag: 'Computed', index: 0 }, children: [] },
                        { data: { key: 'toggleSwitch', tag: 'Action', index: 0 }, children: [] }
                    ]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Room', key: 'ABC' },
                    children: [{
                        data: { tag: 'Name' },
                        children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                    }]
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }],
                    data: { tag: 'Room', key: 'ABC' },
                    children: [{
                        data: { tag: 'Description' },
                        children: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }]
                    }]
                }]
            },
            testKnowledge: {
                key: 'testKnowledge',
                tag: 'Knowledge',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Knowledge', key: 'testKnowledge' },
                    children: [
                        { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Knowledge is power' }, children: [] }] },
                        { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'There is so much to learn!' }, children: [] }] }
                    ]
                }]
            },
            powered: {
                key: 'powered',
                tag: 'Variable',
                default: 'false',
                appearances: [{ ...topLevelAppearance, data: { tag: 'Variable', key: 'powered', default: 'false' } }]
            },
            switchedOn: {
                key: 'switchedOn',
                tag: 'Variable',
                default: 'true',
                appearances: [{ ...topLevelAppearance, data: { tag: 'Variable', key: 'switchedOn', default: 'true' }}]
            },
            active: {
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                appearances: [{ ...topLevelAppearance, data: { tag: 'Computed', key: 'active', src: 'powered && switchedOn', dependencies: ['switchedOn', 'powered'] } }]
            },
            toggleSwitch: {
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                appearances: [{ ...topLevelAppearance, data: { tag: 'Action', key: 'toggleSwitch', src: 'switchedOn = !switchedOn' } }]
            },
            ['If-0']: {
                key: 'If-0',
                tag: 'If',
                conditions: [{
                    if: 'active',
                    dependencies: ['active'],    
                }],
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'If', key: 'If-0', conditions: [{ if: 'active', dependencies: ['active'] }] },
                    children: [{ data: { key: 'ABC', tag: 'Room', index: 1 }, children: [] }]
                }]
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                render: [{
                    data: { tag: 'If', key: 'If-0', conditions: [{ if: 'active', dependencies: ['active'] }] },
                    children: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }]
                }],
                exits: [],
                stateMapping: { active: 'COMPUTED#XYZ' },
                keyMapping: {}
            },
            {
                EphemeraId: 'KNOWLEDGE#GHI',
                key: 'testKnowledge',
                name: [{ data: { tag: 'String', value: 'Knowledge is power' }, children: [] }],
                render: [{ data: { tag: 'String', value: 'There is so much to learn!' }, children: [] }],
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'VARIABLE#QRS',
                key: 'powered',
                default: 'false'
            },
            {
                EphemeraId: 'VARIABLE#TUV',
                key: 'switchedOn',
                default: 'true'
            },
            {
                EphemeraId: 'COMPUTED#XYZ',
                key: 'active',
                src: 'powered && switchedOn',
                dependencies: [
                    { key: 'switchedOn', EphemeraId: 'VARIABLE#TUV' },
                    { key: 'powered', EphemeraId: 'VARIABLE#QRS' }
                ]
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                test: 'ASSET#test',
                ABC: 'ROOM#DEF',
                active: 'COMPUTED#XYZ',
                powered: 'VARIABLE#QRS',
                switchedOn: 'VARIABLE#TUV',
                testKnowledge: 'KNOWLEDGE#GHI'
            }
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [],
            options: { direction: 'back' }
        }])
    })

    it('should correctly look up fileURLs for map', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })
        const topLevelAppearance: Omit<BaseAppearance, 'data'> = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
            children: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'test', universalKey: 'ASSET#test' },
            { internalKey: 'room1', universalKey: 'ROOM#ABC' },
            { internalKey: 'map1', universalKey: 'MAP#DEF' },
            { internalKey: 'image1', universalKey: 'IMAGE#GHI' }
        ]
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    data: { tag: 'Asset', fileName: 'test', key: 'test', Story: undefined },
                    children: [
                        { data: { key: 'room1', tag: 'Room', index: 0 }, children: [] },
                        { data: { key: 'map1', tag: 'Map', index: 0 }, children: [] }
                    ]
                }]
            },
            room1: {
                key: 'room1',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Room', key: 'room1' },
                    children: [{
                        data: { tag: 'Name' },
                        children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]
                    }]
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'map1', tag: 'Map', index: 0 }],
                    data: { tag: 'Room', key: 'room1' },
                    children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }]
                }]
            },
            image1: {
                key: 'image1',
                tag: 'Image',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'map1', tag: 'Map', index: 0 }],
                    data: { tag: 'Image', key: 'image1' },
                    children: []
                }]
            },
            map1: {
                key: 'map1',
                tag: 'Map',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Map', key: 'map1' },
                    children: [
                        { data: { tag: 'Room', key: 'room1', index: 1 }, children: [] },
                        { data: { tag: 'Image', key: 'image1' }, children: [] }
                    ]
                }]
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'room1',
                name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                render: [],
                exits: [],
                stateMapping: {},
                keyMapping: {}
            },
            {
                EphemeraId: 'MAP#DEF',
                key: 'map1',
                name: [],
                rooms: [{ data: { tag: 'Room', key: 'room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] }],
                images: [{ data: { tag: 'Image', key: 'image1', fileURL: 'test.png' }, children: [] }],
                keyMapping: {},
                stateMapping: {}
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                test: 'ASSET#test',
                room1: 'ROOM#ABC',
                map1: 'MAP#DEF',
                image1: 'IMAGE#GHI'
            }
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [],
            options: { direction: 'back' }
        }])
    })

    it('should correctly extract query-ready exits from room contents', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })
        const topLevelAppearance: Omit<BaseAppearance, 'data'> = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            children: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        // ephemeraDBMock.getItem
        //     .mockResolvedValueOnce({ State: {} })
        mockNamespaceMap = [
            { internalKey: 'test', universalKey: 'ASSET#test' },
            { internalKey: 'ABC', universalKey: 'ROOM#ABC' },
            { internalKey: 'DEF', universalKey: 'ROOM#DEF' },
            { internalKey: 'open', universalKey: 'VARIABLE#QRS' }
        ]
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    data: { tag: 'Asset', key: 'test', fileName: 'test', Story: undefined },
                    children: [
                        { data: { key: 'ABC', tag: 'Room', index: 0 }, children: [] },
                        { data: { key: 'DEF', tag: 'Room', index: 0 }, children: [] },
                        { data: { key: 'open', tag: 'Variable', index: 0 }, children: [] }
                    ]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Room', key: 'ABC' },
                    children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] }]
                }]
            },
            DEF: {
                key: 'DEF',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'Room', key: 'DEF' },
                    children: [
                        { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Elsewhere' }, children: [] }] },
                        { data: { tag: 'If', key: 'If-0', index: 0 }, children: [] }
                    ]
                }]
            },
            open: {
                key: 'open',
                tag: 'Variable',
                default: 'false',
                appearances: [{ ...topLevelAppearance, data: { tag: 'Variable', key: 'open', default: 'false' } }]
            },
            ['DEF#ABC']: {
                key: 'DEF#ABC',
                tag: 'Exit',
                from: 'DEF',
                to: 'ABC',
                name: 'Vortex',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0}, { key: 'If-0', tag: 'If', index: 0 }],
                    data: { tag: 'Exit', key: 'DEF#ABC', from: 'DEF', to: 'ABC', name: 'Vortex' },
                    children: []
                }]
            },
            ['If-0']: {
                key: 'If-0',
                tag: 'If',
                conditions: [{                    
                    if: 'open',
                    dependencies: ['open']
                }],
                appearances: [{
                    ...topLevelAppearance,
                    data: { tag: 'If', key: 'If-0', conditions: [{ if: 'open', dependencies: ['open'] }] },
                    children: [{ data: { key: 'DEF#ABC', tag: 'Exit', index: 0 }, children: [] }]
                }]
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'ABC',
                exits: [],
                name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                render: [],
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'ROOM#DEF',
                key: 'DEF',
                exits: [{
                    data: { tag: 'If', key: 'If-0', conditions: [{ if: 'open', dependencies: ['open'] }] },
                    children: [{ data: { tag: 'Exit', key: 'DEF#ABC', from: 'DEF', to: 'ABC', name: 'Vortex' }, children: [] }]
                }],
                name: [{ data: { tag: 'String', value: 'Elsewhere' }, children: [] }],
                render: [],
                keyMapping: { ABC: 'ROOM#ABC', DEF: 'ROOM#DEF' },
                stateMapping: { open: 'VARIABLE#QRS' }
            },
            {
                EphemeraId: 'VARIABLE#QRS',
                key: 'open',
                default: 'false'
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                test: 'ASSET#test',
                ABC: 'ROOM#ABC',
                DEF: 'ROOM#DEF',
                open: 'VARIABLE#QRS'
            }
        })
    })

    it('should set graph edges when asset has imports', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })
        const topLevelAppearance: Omit<BaseAppearance, 'data'> = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            children: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'test', universalKey: 'ASSET#test' },
            { internalKey: 'ABC', universalKey: 'ROOM#DEF' },
        ]
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    data: { tag: 'Asset', key: 'test', fileName: 'test', Story: undefined },
                    children: [
                        { data: { key: 'Import-0', tag: 'Import', index: 0 }, children: [] },
                        { data: { key: 'ABC', tag: 'Room', index: 1 }, children: [] }
                    ]
                }]
            },
            'Import-0': {
                tag: 'Import',
                key: 'Import-0',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                    data: { tag: 'Import', key: 'Import-0', from: 'base', mapping: {} },
                    children: [
                        { data: { key: 'ABC', tag: 'Room', index: 0 }, children: [] }
                    ]
                }],
                from: 'base',
                mapping: {}
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    contextStack: [
                        { key: 'test', tag: 'Asset', index: 0 },
                        { key: 'Import-0', tag: 'Import', index: 0 }
                    ],
                    data: { tag: 'Room', key: 'ABC' },
                    children: []
                },
                {
                    ...topLevelAppearance,
                    data: { tag: 'Room', key: 'ABC' },
                    children: [{ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] }]
                }]
            },
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#base', context: '' }],
            options: { direction: 'back' }
        }])
    })

    it('should correctly cache character', async () => {
        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Tess',
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Name: 'Tess',
            Pronouns: {
                subject: 'they',
                object: 'them',
                possessive: 'their',
                adjective: 'theirs',
                reflexive: 'themself'
            },
            assets: [],
        })
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'CHARACTER#Tess', address: { fileName: 'Tess', zone: 'Personal', player: 'Test' } })

        mockNamespaceMap = [
            { internalKey: 'Tess', universalKey: 'CHARACTER#Tess' },
        ]
        mockTestAsset = {
            Tess: {
                key: 'Tess',
                tag: 'Character',
                fileName: 'Tess',
                Name: 'Tess',
                FirstImpression: 'Frumpy Goth',
                OneCoolThing: 'Fuchsia eyes',
                Outfit: 'A patchwork frock jacket',
                images: [],
                Pronouns: {
                    subject: 'they',
                    object: 'them',
                    possessive: 'their',
                    adjective: 'theirs',
                    reflexive: 'themself'
                },
                assets: ['Test', 'BASE'],
                appearances: [{
                    contextStack: [],
                    data: {
                        key: 'Tess',
                        tag: 'Character',
                        fileName: 'Tess',
                        Name: 'Tess',
                        FirstImpression: 'Frumpy Goth',
                        OneCoolThing: 'Fuchsia eyes',
                        Outfit: 'A patchwork frock jacket',
                        Pronouns: {
                            subject: 'they',
                            object: 'them',
                            possessive: 'their',
                            adjective: 'theirs',
                            reflexive: 'themself'
                        }
                    },
                    children: [
                        { data: { key: 'Import-0', tag: 'Import', index: 0 }, children: [] },
                        { data: { key: 'Import-1', tag: 'Import', index: 0 }, children: [] }
                    ]
                }]
            },
            'Import-0': {
                tag: 'Import',
                key: 'Import-0',
                appearances: [{
                    contextStack: [{ key: 'Tess', tag: 'Character', index: 0 }],
                    data: { tag: 'Import', key: 'Import-0', from: 'BASE', mapping: {} },
                    children: []
                }],
                from: 'BASE',
                mapping: {}
            },
            'Import-1': {
                tag: 'Import',
                key: 'Import-1',
                appearances: [{
                    contextStack: [{ key: 'Tess', tag: 'Character', index: 0 }],
                    data: { tag: 'Import', key: 'Import-1', from: 'Test', mapping: {} },
                    children: []
                }],
                from: 'Test',
                mapping: {}
            }
        }

        await cacheAsset({
            assetId: 'CHARACTER#Tess',
            messageBus: messageBusMock
        })
        // expect(setEdgesInternalMock).toHaveBeenCalledWith([{
        //     itemId: 'ASSET#Tess',
        //     edges: [{ target: 'ASSET#BASE', context: '' }, { target: 'ASSET#Test', context: '' }],
        //     options: { direction: 'back' }
        // }])
        expect(internalCacheMock.CharacterMeta.set).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTER#Tess',
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Name: 'Tess',
            Pronouns: {
                subject: 'they',
                object: 'them',
                possessive: 'their',
                adjective: 'theirs',
                reflexive: 'themself'
            },
            assets: ['BASE', 'Test'],
        })
    })
})