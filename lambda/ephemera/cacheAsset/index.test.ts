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
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'
import { isSchemaComputed, isSchemaConditionStatement, SchemaTag } from '@tonylb/mtw-wml/ts/schema/baseClasses'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardComputed from '@tonylb/mtw-wml/ts/standardize/components/computed'

//
// TS nesting is deep enough that if we don't flag then it will complain
//
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>

jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    return jest.fn()
})

const evaluateCodeMock = evaluateCode as jest.Mock
const workspaceMock = ReadOnlyAssetWorkspace as jest.Mock

const mockWorkspace = (standard: StandardForm) => (address: any) => {
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
        standard
    }
}

const assignTestDependencies = (mappings: { typeGuard: (node: GenericTreeNode<SchemaTag>) => boolean, dependencies: string[] }[]) => (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
    tree.map((node) => {
        const mappedReturn = mappings.reduce<string[] | undefined>((previous, mapping) => {
            if (previous) {
                return previous
            }
            if (mapping.typeGuard(node)) {
                return mapping.dependencies
            }
            return previous
        }, undefined)
        if (mappedReturn && (treeNodeTypeguard(isSchemaComputed)(node) || treeNodeTypeguard(isSchemaConditionStatement)(node))) {
            return {
                ...node,
                data: { ...node.data, dependencies: mappedReturn }
            }
        }
        return {
            ...node,
            children: assignTestDependencies(mappings)(node.children)
        }
    })
)

describe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as jest.Mocked<MessageBus>
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.CharacterSessions.get.mockResolvedValue([])
        internalCacheMock.Graph.get.mockResolvedValue(new Graph(
            { 'ASSET#BASE': { key: 'ASSET#BASE'}, 'ASSET#Test': { key: 'ASSET#Test' } },
            [{ to: 'ASSET#BASE', from: 'ASSET#Test', context: '' }],
            {},
            true
        ))
        GraphUpdateMock.mockClear()
        messageBusMock.send.mockClear()
    })

    it('should skip processing when check option and already present', async () => {
        workspaceMock.mockImplementation(mockWorkspace(new StandardForm('Test')))
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

        const testStandard = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Name>
                        Vortex<If {active}>(lit)</If>
                    </Name>
                    <Description>The lights are on</Description>
                </Room>
                <Knowledge key=(testKnowledge)>
                    <Name>Knowledge is power</Name>
                    <Description>There is so much to learn!</Description>
                </Knowledge>
                <Variable key=(powered) default={false} />
                <Variable key=(switchedOn) default={true} />
                <Computed key=(active) src={powered && switchedOn} />
                <Action key=(toggleSwitch) src={switchedOn = !switchedOn} />
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'Test': return 'ASSET#Test'
                    case 'ABC': return 'ROOM#DEF'
                    case 'active': return 'COMPUTED#XYZ'
                    case 'powered': return 'VARIABLE#QRS'
                    case 'switchedOn': return 'VARIABLE#TUV'
                    case 'testKnowledge': return 'KNOWLEDGE#GHI'
                    case 'toggleSwitch': return 'ACTION#JKL'
                }
                return undefined
            })
            .mapContents(assignTestDependencies([
                { typeGuard: treeNodeTypeguard(isSchemaConditionStatement), dependencies: ['active'] }
            ]))
        const computedComponent = testStandard.byId.active as StandardComputed
        computedComponent._payload._dependencies = ['switchedOn', 'powered']
        
        workspaceMock.mockImplementation(mockWorkspace(testStandard))

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'Test',
            [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                name: {
                    data: { tag: 'Name' },
                    children: [
                        { data: { tag: 'String', value: 'Vortex' }, children: [] },
                        { data: { tag: 'If' }, children: [
                            { data: { tag: 'Statement', if: 'active', dependencies: ['active'] }, children: [{ data: { tag: 'String', value: '(lit)' }, children: [] }]}
                        ] }
                    ]
                },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'The lights are on' }, children: [] }] },
                exits: [],
                themes: [],
                tag: 'Room',
                stateMapping: { active: 'COMPUTED#XYZ' },
                keyMapping: {}
            },
            {
                EphemeraId: 'KNOWLEDGE#GHI',
                key: 'testKnowledge',
                tag: 'Knowledge',
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Knowledge is power' }, children: [] }] },
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'There is so much to learn!' }, children: [] }] },
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'VARIABLE#QRS',
                key: 'powered',
                default: 'false',
                tag: 'Variable'
            },
            {
                EphemeraId: 'VARIABLE#TUV',
                key: 'switchedOn',
                default: 'true',
                tag: 'Variable'
            },
            {
                EphemeraId: 'COMPUTED#XYZ',
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                keyMapping: {},
                stateMapping: {
                    switchedOn: 'VARIABLE#TUV',
                    powered: 'VARIABLE#QRS'
                }
            },
            {
                EphemeraId: 'ACTION#JKL',
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                keyMapping: {},
                stateMapping: {}
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                ABC: 'ROOM#DEF',
                active: 'COMPUTED#XYZ',
                powered: 'VARIABLE#QRS',
                switchedOn: 'VARIABLE#TUV',
                testKnowledge: 'KNOWLEDGE#GHI',
                toggleSwitch: 'ACTION#JKL'
            }
        })
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#Test',
            edges: [],
            options: { direction: 'back' }
        }])
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ROOM#DEF',
            header: true
        })
    })

    it('should correctly look up fileURLs for map', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        const testStandard = new StandardForm(`
            <Asset key=(test)>
                <Room key=(room1)><Name>Vortex</Name></Room>
                <Map key=(map1)>
                    <Image key=(image1) />
                    <Room key=(room1)><Position x="0" y="0" /></Room>
                </Map>
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'Test': return 'ASSET#Test'
                    case 'room1': return 'ROOM#ABC'
                    case 'map1': return 'MAP#DEF'
                    case 'image1': return 'IMAGE#GHI'
                }
                return undefined
            })
        const image = testStandard.byId.image1 as StandardImage
        image._key._fileName = 'test.png'

        workspaceMock.mockImplementation(mockWorkspace(testStandard))

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'test',
            [{
                EphemeraId: 'IMAGE#GHI',
                tag: 'Image',
                key: 'image1',
                fileName: 'test.png',
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'ROOM#ABC',
                key: 'room1',
                tag: 'Room',
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                exits: [],
                themes: [],
                stateMapping: {},
                keyMapping: {}
            },
            {
                EphemeraId: 'MAP#DEF',
                key: 'map1',
                tag: 'Map',
                positions: [{ data: { tag: 'Room', key: 'room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] }],
                images: [{ data: { tag: 'Image', key: 'image1', fileURL: 'test.png' }, children: [] }],
                themes: [],
                keyMapping: { room1: 'ROOM#ABC' },
                stateMapping: {}
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            scopeMap: {
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

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        const testStandard = new StandardForm(`
            <Asset key=(Test)>
                <Room key=(ABC)><Name>Vortex</Name></Room>
                <Room key=(DEF)>
                    <Name>Elsewhere</Name>
                    <If {open}><Exit to=(ABC)>Vortex</Exit></If>
                </Room>
                <Variable key=(open) default={false} />
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'ABC': return 'ROOM#ABC'
                    case 'DEF': return 'ROOM#DEF'
                    case 'open': return 'VARIABLE#QRS'
                }
                return undefined
            })
            .mapContents(assignTestDependencies([
                { typeGuard: treeNodeTypeguard(isSchemaConditionStatement), dependencies: ['open'] }
            ]))

        workspaceMock.mockImplementation(mockWorkspace(testStandard))

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })
        expect(mergeIntoEphemera).toHaveBeenCalledWith(
            'Test',
            [{
                EphemeraId: 'ROOM#ABC',
                key: 'ABC',
                tag: 'Room',
                exits: [],
                themes: [],
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'ROOM#DEF',
                key: 'DEF',
                tag: 'Room',
                exits: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'open', dependencies: ['open'] },
                        children: [{ data: { tag: 'Exit', key: 'DEF#ABC', from: 'DEF', to: 'ABC' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] }]
                    }]
                }],
                themes: [],
                name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Elsewhere' }, children: [] }] },
                keyMapping: { ABC: 'ROOM#ABC' },
                stateMapping: { open: 'VARIABLE#QRS' }
            },
            {
                EphemeraId: 'VARIABLE#QRS',
                key: 'open',
                tag: 'Variable',
                default: 'false'
            }],
            expect.any(Object)
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
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

        const testStandard = new StandardForm(`
            <Asset key=(Test)>
                <Import from=(base)><Room key=(ABC) /></Import>
                <Room key=(ABC)><Name>Vortex</Name></Room>
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'Test': return 'ASSET#Test'
                    case 'ABC': return 'ROOM#DEF'
                }
                return undefined
            })

        workspaceMock.mockImplementation(mockWorkspace(testStandard))

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

})