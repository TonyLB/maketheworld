import { jest, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/setEdges')
import setEdges from '@tonylb/mtw-utilities/dist/graphStorage/update/setEdges'

jest.mock('@tonylb/mtw-utilities/dist/computation/sandbox')
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox'
jest.mock('./perAsset')
import { mergeIntoEphemera } from './perAsset'

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('./dependencyUpdate')

import { cacheAssetMessage } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { BaseAppearance, ComponentAppearance, NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

const internalCacheMock = jest.mocked(internalCache, true)

let mockTestAsset: NormalForm = {
    'Import-0': {
        tag: 'Import',
        from: 'BASE',
        key: 'Import-0',
        appearances: [{
            contents: [],
            contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
        }],
        mapping: {}
    },
    Test: {
        tag: 'Asset',
        key: 'Test',
        appearances: [{
            contents: [{
                tag: 'Import',
                key: 'Import-0',
                index: 0
            }],
            contextStack: []
        }]
    }
}
let mockNamespaceMap: Record<string, string> = {
    Test: 'ASSET#Test',
    Tess: 'CHARACTER#Tess'
}

jest.mock('@tonylb/mtw-asset-workspace/dist/', () => {
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
            namespaceIdToDB: mockNamespaceMap
        }
    })
})

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const evaluateCodeMock = evaluateCode as jest.Mock
const setEdgesMock = setEdges as jest.Mock

describe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    const setEdgesInternalMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        mockTestAsset = {
            'Import-0': {
                tag: 'Import',
                from: 'BASE',
                key: 'Import-0',
                appearances: [{
                    contents: [],
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
                }],
                mapping: {}
            },
            Test: {
                tag: 'Asset',
                key: 'Test',
                appearances: [{
                    contents: [{
                        tag: 'Import',
                        key: 'Import-0',
                        index: 0
                    }],
                    contextStack: []
                }]
            }
        }
        mockNamespaceMap = {
            Test: 'ASSET#Test'
        }
        internalCacheMock.CharacterConnections.get.mockResolvedValue([])
        internalCacheMock.Graph.get.mockResolvedValue(new Graph(
            { 'ASSET#BASE': { key: 'ASSET#BASE'}, 'ASSET#Test': { key: 'ASSET#Test' } },
            [{ to: 'ASSET#BASE', from: 'ASSET#Test', context: '' }],
            {},
            true
        ))
        setEdgesMock.mockReturnValue(setEdgesInternalMock)
    })

    it('should skip processing when check option and already present', async () => {
        internalCacheMock.AssetMeta.get.mockResolvedValue({ EphemeraId: 'ASSET#Test' })
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: { check: true }
            }],
            messageBus: messageBusMock
        })

        expect(mergeIntoEphemera).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should skip processing when asset is an instanced story', async () => {
        internalCacheMock.AssetMeta.get.mockResolvedValue({ EphemeraId: 'ASSET#Test' })
        mockTestAsset = {
            'Import-0': {
                tag: 'Import',
                from: 'BASE',
                key: 'Import-0',
                appearances: [{
                    contents: [],
                    contextStack: [{ tag: 'Asset', key: 'Test', index: 0 }]
                }],
                mapping: {}
            },
            Test: {
                tag: 'Asset',
                key: 'Test',
                instance: true,
                appearances: [{
                    contents: [{
                        tag: 'Import',
                        key: 'Import-0',
                        index: 0
                    }],
                    contextStack: []
                }]
            }
        }
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
    
        expect(mergeIntoEphemera).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should send rooms in need of update', async () => {
        const topLevelAppearance: BaseAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = {
            test: 'ASSET#test',
            ABC: 'ROOM#DEF',
            active: 'COMPUTED#XYZ',
            powered: 'VARIABLE#QRS',
            switchedOn: 'VARIABLE#TUV',
            testKnowledge: 'KNOWLEDGE#GHI'
        }
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'If-0',
                        tag: 'If',
                        index: 0
                    },
                    {
                        key: 'testKnowledge',
                        tag: 'Knowledge',
                        index: 0
                    },
                    {
                        key: 'powered',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'switchedOn',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'active',
                        tag: 'Computed',
                        index: 0
                    },
                    {
                        key: 'toggleSwitch',
                        tag: 'Action',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    name: [{ tag: 'String', value: 'Vortex' }],
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }],
                    render: ['The lights are on '],
                    contents: []
                }] as ComponentAppearance[]
            },
            testKnowledge: {
                key: 'testKnowledge',
                tag: 'Knowledge',
                appearances: [{
                    ...topLevelAppearance,
                    name: [{ tag: 'String', value: 'Knowledge is power' }],
                    render: [{ tag: 'String', value: 'There is so much to learn!' }]
                }]
            },
            powered: {
                key: 'powered',
                tag: 'Variable',
                default: 'false',
                appearances: [topLevelAppearance]
            },
            switchedOn: {
                key: 'switchedOn',
                tag: 'Variable',
                default: 'true',
                appearances: [topLevelAppearance]
            },
            active: {
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                appearances: [topLevelAppearance]
            },
            toggleSwitch: {
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                appearances: [topLevelAppearance]
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
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            }
        }

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                appearances: [{
                    conditions: [],
                    exits: [],
                    name: [{ tag: 'String', value: 'Vortex' }],
                    render: []
                },
                {
                    conditions: [{
                        dependencies: [{
                            key: 'active',
                            EphemeraId: 'COMPUTED#XYZ'
                        }],
                        if: "active"
                    }],
                    exits: [],
                    name: [],
                    render: ["The lights are on "]
                }]
            },
            {
                EphemeraId: 'KNOWLEDGE#GHI',
                key: 'testKnowledge',
                appearances: [{
                    conditions: [],
                    name: [{ tag: 'String', value: 'Knowledge is power' }],
                    render: [{ tag: 'String', value: 'There is so much to learn!' }]
                }]
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
            }]
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
        expect(setEdgesInternalMock).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [],
            options: { direction: 'back' }
        }])
    })

    it('should correctly extract query-ready exits from room contents', async () => {
        const topLevelAppearance: BaseAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        // ephemeraDBMock.getItem
        //     .mockResolvedValueOnce({ State: {} })
        mockNamespaceMap = {
            test: 'ASSET#test',
            ABC: 'ROOM#ABC',
            DEF: 'ROOM#DEF',
            open: 'VARIABLE#QRS'
        }
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'DEF',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'open',
                        tag: 'Variable',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    name: [{ tag: 'String', value: 'Vortex' }],
                    render: []
                }] as ComponentAppearance[]
            },
            DEF: {
                key: 'DEF',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    name: [{ tag: 'String', value: 'Elsewhere' }],
                    render: [],
                    contents: [
                        {
                            tag: 'If', key: 'If-0', index: 0
                        }
                    ]
                }] as ComponentAppearance[]
            },
            open: {
                key: 'open',
                tag: 'Variable',
                default: 'false',
                appearances: [topLevelAppearance]
            },
            ['DEF#ABC']: {
                key: 'DEF#ABC',
                tag: 'Exit',
                from: 'DEF',
                to: 'ABC',
                name: 'Vortex'
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
                    contents: [{
                        key: 'DEF#ABC',
                        tag: 'Exit',
                        index: 0
                    }]
                }]
            }
        }

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'ABC',
                appearances: [{
                    conditions: [],
                    exits: [],
                    name: [{ tag: 'String', value: 'Vortex' }],
                    render: []
                }]
            },
            {
                EphemeraId: 'ROOM#DEF',
                key: 'DEF',
                appearances: [{
                    conditions: [],
                    exits: [{
                        conditions: [{
                            if: 'open',
                            dependencies: [{ key: 'open', EphemeraId: 'VARIABLE#QRS' }]
                        }],
                        name: 'Vortex',
                        to: 'ROOM#ABC'
                    }],
                    name: [{ tag: 'String', value: 'Elsewhere' }],
                    render: []
                }]
            },
            {
                EphemeraId: 'VARIABLE#QRS',
                key: 'open',
                default: 'false'
            }]
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
        const topLevelAppearance: BaseAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: []
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = {
            test: 'ASSET#test',
            ABC: 'ROOM#DEF',
        }
        mockTestAsset = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    contents: [{
                        key: 'Import-0',
                        tag: 'Import',
                        index: 0
                    },
                    {
                        key: 'ABC',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            },
            'Import-0': {
                tag: 'Import',
                key: 'Import-0',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                    contents: [
                        { key: 'ABC', tag: 'Room', index: 0 }
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
                    contents: [],
                    name: [],
                    render: []
                },
                {
                    ...topLevelAppearance,
                    name: [{ tag: 'String', value: 'Vortex' }],
                    render: []
                }] as ComponentAppearance[]
            },
        }

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
        expect(setEdgesInternalMock).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#base', context: '' }],
            options: { direction: 'back' }
        }])
    })

    it('should correctly cache character', async () => {
        const topLevelAppearance: BaseAppearance = {
            contextStack: [{ key: 'test', tag: 'Character', index: 0}],
            contents: []
        }

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

        mockNamespaceMap = {
            Tess: 'CHARACTER#Tess',
        }
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
                    contents: [{
                        key: 'Import-0',
                        tag: 'Import',
                        index: 0
                    },
                    {
                        key: 'Import-1',
                        tag: 'Import',
                        index: 0
                    }]
                }]
            },
            'Import-0': {
                tag: 'Import',
                key: 'Import-0',
                appearances: [{
                    contextStack: [{ key: 'Tess', tag: 'Character', index: 0 }],
                    contents: []
                }],
                from: 'BASE',
                mapping: {}
            },
            'Import-1': {
                tag: 'Import',
                key: 'Import-1',
                appearances: [{
                    contextStack: [{ key: 'Tess', tag: 'Character', index: 0 }],
                    contents: []
                }],
                from: 'Test',
                mapping: {}
            }
        }

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Tess', zone: 'Personal', player: 'Test' },
                options: {}
            }],
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
            assets: ['BASE', 'Test']
        })
    })
})