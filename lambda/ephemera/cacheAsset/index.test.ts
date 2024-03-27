import { jest, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/ts/dynamoDB/index'
jest.mock('@tonylb/mtw-utilities/ts/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update/index'

jest.mock('@tonylb/mtw-utilities/ts/computation/sandbox')
import { evaluateCode } from '@tonylb/mtw-utilities/ts/computation/sandbox'
jest.mock('./mergeIntoEphemera')
import { mergeIntoEphemera } from './mergeIntoEphemera'

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('./dependencyUpdate')

import { cacheAsset } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import { NamespaceMapping, WorkspaceProperties } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { SerializableStandardForm } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

//
// TS nesting is deep enough that if we don't flag then it will complain
//
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>

let mockTestAsset: SerializableStandardForm = { key: 'Test', tag: 'Asset', byId: {}, metaData: [] }
let mockNamespaceMap: NamespaceMapping = [
    { internalKey: 'Test', universalKey: 'ASSET#Test' },
    { internalKey: 'Tess', universalKey: 'CHARACTER#Tess' }
]

let mockProperties: WorkspaceProperties = { image1: { fileName: 'test.png' } }

jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
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
            standard: mockTestAsset,
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
        mockTestAsset = { key: 'Test', tag: 'Asset', byId: {}, metaData: [] }
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

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'Test', universalKey: 'ASSET#Test' },
            { internalKey: 'ABC', universalKey: 'ROOM#DEF' },
            { internalKey: 'active', universalKey: 'COMPUTED#XYZ' },
            { internalKey: 'powered', universalKey: 'VARIABLE#QRS' },
            { internalKey: 'switchedOn', universalKey: 'VARIABLE#TUV' },
            { internalKey: 'testKnowledge', universalKey: 'KNOWLEDGE#GHI' }
        ]
        mockTestAsset = {
            key: 'Test',
            tag: 'Asset',
            metaData: [],
            byId: {
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [
                        { data: { tag: 'String', value: 'Vortex' }, children: [] },
                        { data: { tag: 'If' }, children: [
                            { data: { tag: 'Statement', if: 'active', dependencies: ['active'] }, children: [{ data: { tag: 'String', value: '(lit)' }, children: [] }]}
                        ] }
                    ] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description'}, children: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }] },
                    exits: []
                },
                testKnowledge: {
                    key: 'testKnowledge',
                    tag: 'Knowledge',
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Knowledge is power' }, children: [] }] },
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'There is so much to learn!' }, children: [] }] }
                },
                powered: {
                    key: 'powered',
                    tag: 'Variable',
                    default: 'false'
                },
                switchedOn: {
                    key: 'switchedOn',
                    tag: 'Variable',
                    default: 'true'
                },
                active: {
                    key: 'active',
                    tag: 'Computed',
                    src: 'powered && switchedOn',
                    dependencies: ['switchedOn', 'powered']
                },
                toggleSwitch: {
                    key: 'toggleSwitch',
                    tag: 'Action',
                    src: 'switchedOn = !switchedOn',
                }
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'Test',
            [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                shortName: [],
                name: [
                    { data: { tag: 'String', value: 'Vortex' }, children: [] },
                    { data: { tag: 'If' }, children: [
                        { data: { tag: 'Statement', if: 'active', dependencies: ['active'] }, children: [{ data: { tag: 'String', value: '(lit)' }, children: [] }]}
                    ] }
                ],
                summary: [],
                render: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }],
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
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                Test: 'ASSET#Test',
                ABC: 'ROOM#DEF',
                active: 'COMPUTED#XYZ',
                powered: 'VARIABLE#QRS',
                switchedOn: 'VARIABLE#TUV',
                testKnowledge: 'KNOWLEDGE#GHI'
            }
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#Test',
            edges: [],
            options: { direction: 'back' }
        }])
    })

    it('should correctly look up fileURLs for map', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'Test', universalKey: 'ASSET#Test' },
            { internalKey: 'room1', universalKey: 'ROOM#ABC' },
            { internalKey: 'map1', universalKey: 'MAP#DEF' },
            { internalKey: 'image1', universalKey: 'IMAGE#GHI' }
        ]
        mockTestAsset = {
            key: 'Test',
            tag: 'Asset',
            metaData: [],
            byId: {
                room1: {
                    key: 'room1',
                    tag: 'Room',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                    exits: []
                },
                map1: {
                    key: 'map1',
                    tag: 'Map',
                    name: { data: { tag: 'Name' }, children: [] },
                    positions: [
                        { data: { tag: 'Room', key: 'room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] }
                    ],
                    images: [{ data: { tag: 'Image', key: 'image1' }, children: [] }]
                }
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'Test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'room1',
                shortName: [],
                name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                summary: [],
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
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                Test: 'ASSET#Test',
                room1: 'ROOM#ABC',
                map1: 'MAP#DEF',
                image1: 'IMAGE#GHI'
            }
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#Test',
            edges: [],
            options: { direction: 'back' }
        }])
    })

    it('should correctly extract query-ready exits from room contents', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'Test', universalKey: 'ASSET#Test' },
            { internalKey: 'ABC', universalKey: 'ROOM#ABC' },
            { internalKey: 'DEF', universalKey: 'ROOM#DEF' },
            { internalKey: 'open', universalKey: 'VARIABLE#QRS' }
        ]
        mockTestAsset = {
            key: 'Test',
            tag: 'Asset',
            metaData: [],
            byId: {
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                    exits: []
                },
                DEF: {
                    key: 'DEF',
                    tag: 'Room',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Elsewhere' }, children: [] }] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                    exits: [
                        { data: { tag: 'If' }, children: [{
                            data: { tag: 'Statement', if: 'open', dependencies: ['open'] },
                            children: [{ data: { tag: 'Exit', to: 'ABC', key: 'DEF#ABC', from: 'DEF' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }]}]
                        }] }
                    ]
                },
                open: {
                    key: 'open',
                    tag: 'Variable',
                    default: 'false'
                }
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'Test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'ABC',
                exits: [],
                shortName: [],
                name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                summary: [],
                render: [],
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'ROOM#DEF',
                key: 'DEF',
                exits: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'open', dependencies: ['open'] },
                        children: [{ data: { tag: 'Exit', key: 'DEF#ABC', from: 'DEF', to: 'ABC' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] }]
                    }]
                }],
                shortName: [],
                name: [{ data: { tag: 'String', value: 'Elsewhere' }, children: [] }],
                summary: [],
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
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                Test: 'ASSET#Test',
                ABC: 'ROOM#ABC',
                DEF: 'ROOM#DEF',
                open: 'VARIABLE#QRS'
            }
        })
    })

    it('should set graph edges when asset has imports', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        mockNamespaceMap = [
            { internalKey: 'Test', universalKey: 'ASSET#Test' },
            { internalKey: 'ABC', universalKey: 'ROOM#DEF' },
        ]
        mockTestAsset = {
            key: 'Test',
            tag: 'Asset',
            metaData: [
                {
                    data: { tag: 'Import', key: 'Import-0', from: 'base', mapping: {} },
                    children: [{ data: { tag: 'Room', key: 'ABC' }, children: [] }]
                }
            ],
            byId: {
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                    exits: []
                }
            }
        }

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#Test',
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
            key: 'Tess',
            tag: 'Character',
            metaData: [
                { data: { tag: 'Import', from: 'BASE', mapping: {} }, children: [] },
                { data: { tag: 'Import', from: 'Test', mapping: {} }, children: [] }
            ],
            byId: {
                Tess: {
                    key: 'Tess',
                    tag: 'Character',
                    pronouns: { data: {
                        tag: 'Pronouns',
                        subject: 'they',
                        object: 'them',
                        possessive: 'their',
                        adjective: 'theirs',
                        reflexive: 'themself'
                    }, children: [] },
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
                    firstImpression: { data: { tag: 'FirstImpression', value: 'Frumpy Goth' }, children: [] },
                    oneCoolThing: { data: { tag: 'OneCoolThing', value: 'Fuchsia eyes' }, children: [] },
                    outfit: { data: { tag: 'Outfit', value: 'A patchwork frock jacket' }, children: [] },
                },
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