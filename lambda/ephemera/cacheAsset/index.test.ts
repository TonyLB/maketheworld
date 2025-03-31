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
import { mergeIntoEphemera, mergeIntoExamples } from './mergeIntoEphemera'

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('./dependencyUpdate')

import { cacheAsset } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import StandardComputed from '@tonylb/mtw-wml/ts/standardize/components/computed'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { isSchemaComputed } from '@tonylb/mtw-base/ts/schema/computation'
import { isSchemaConditionStatement } from '@tonylb/mtw-base/ts/schema/condition'

//
// TS nesting is deep enough that if we don't flag then it will complain
//
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>
const mergeIntoExamplesMock = mergeIntoExamples as jest.Mock

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
                    <Example key=(base)>
                        <Name>
                            Vortex (lit)
                        </Name>
                        <Description>The lights are on</Description>
                    </Example>
                </Room>
                <Knowledge key=(testKnowledge)>
                    <Example key=(base)>
                        <Name>Knowledge is power</Name>
                        <Description>There is so much to learn!</Description>
                    </Example>
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
                    case 'ABC.base': return 'EXAMPLE#MNO'
                    case 'testKnowledge.base': return 'EXAMPLE#PQR'
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
                exits: [],
                tag: 'Room',
                stateMapping: {},
                keyMapping: {},
                examples: [{ tag: 'Example', key: 'base' }]
            },
            {
                EphemeraId: 'KNOWLEDGE#GHI',
                key: 'testKnowledge',
                tag: 'Knowledge',
                keyMapping: {},
                stateMapping: {},
                examples: [{ tag: 'Example', key: 'base' }]
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
        expect(mergeIntoExamplesMock).toHaveBeenCalledTimes(1)
        expect(mergeIntoExamplesMock.mock.calls[0][0]).toEqual('Test')
        expect(Object.assign({}, ...Object.entries(mergeIntoExamplesMock.mock.calls[0][1]).map(([componentId, examples]) => ({ [componentId]: (examples as StandardExample[]).map((example) => (example.toJSON())) })))).toEqual({
            ['ROOM#DEF']: [{
                key: 'ABC.base',
                tag: 'Example',
                universalKey: 'EXAMPLE#MNO',
                name: ['Vortex (lit)'],
                description: ['The lights are on']
            }],
            ['KNOWLEDGE#GHI']: [{
                key: 'testKnowledge.base',
                tag: 'Example',
                universalKey: 'EXAMPLE#PQR',
                name: ['Knowledge is power'],
                description: ['There is so much to learn!']
            }]
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                ABC: 'ROOM#DEF',
                'ABC.base': 'EXAMPLE#MNO',
                active: 'COMPUTED#XYZ',
                powered: 'VARIABLE#QRS',
                switchedOn: 'VARIABLE#TUV',
                testKnowledge: 'KNOWLEDGE#GHI',
                'testKnowledge.base': 'EXAMPLE#PQR',
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
                <Room key=(room1)>
                    <Example key=(base)>
                        <Name>Vortex</Name>
                    </Example>
                </Room>
                <Map key=(map1)>
                    <Image key=(image1) />
                    <Room key=(room1)><Position x="0" y="0" /></Room>
                </Map>
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'Test': return 'ASSET#Test'
                    case 'room1': return 'ROOM#ABC'
                    case 'room1.base': return 'EXAMPLE#CDE'
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
                EphemeraId: 'ROOM#ABC',
                key: 'room1',
                tag: 'Room',
                examples: [{ tag: 'Example', key: 'base' }],
                exits: [],
                stateMapping: {},
                keyMapping: {}
            },
            {
                EphemeraId: 'MAP#DEF',
                key: 'map1',
                tag: 'Map',
                positions: [{ data: { tag: 'Room', key: 'room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] }],
                images: [{ data: { tag: 'Image', key: 'image1', fileURL: 'test.png' }, children: [] }],
                keyMapping: { room1: 'ROOM#ABC' },
                stateMapping: {}
            },
            {
                EphemeraId: 'IMAGE#GHI',
                tag: 'Image',
                key: 'image1',
                fileName: 'test.png',
                keyMapping: {},
                stateMapping: {}
            }],
            expect.any(Object)
        )
        expect(mergeIntoExamplesMock).toHaveBeenCalledTimes(1)
        expect(mergeIntoExamplesMock.mock.calls[0][0]).toEqual('test')
        expect(Object.assign({}, ...Object.entries(mergeIntoExamplesMock.mock.calls[0][1]).map(([componentId, examples]) => ({ [componentId]: (examples as StandardExample[]).map((example) => (example.toJSON())) })))).toEqual({
            ['ROOM#ABC']: [{
                key: 'room1.base',
                tag: 'Example',
                universalKey: 'EXAMPLE#CDE',
                name: ['Vortex']
            }]
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                room1: 'ROOM#ABC',
                map1: 'MAP#DEF',
                image1: 'IMAGE#GHI',
                'room1.base': 'EXAMPLE#CDE'
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
                <Room key=(ABC)>
                    <Example key=(base)><Name>Vortex</Name></Example>
                </Room>
                <Room key=(DEF)>
                    <Example key=(base)><Name>Elsewhere</Name></Example>
                    <If {open}><Exit to=(ABC)>Vortex</Exit></If>
                </Room>
                <Variable key=(open) default={false} />
            </Asset>
            `).withUpdatedUniversalKeys((key) => {
                switch(key) {
                    case 'ABC': return 'ROOM#ABC'
                    case 'ABC.base': return 'EXAMPLE#CDE'
                    case 'DEF': return 'ROOM#DEF'
                    case 'DEF.base': return 'EXAMPLE#FGH'
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
                examples: [{ tag: 'Example', key: 'base' }],
                exits: [],
                keyMapping: {},
                stateMapping: {}
            },
            {
                EphemeraId: 'ROOM#DEF',
                key: 'DEF',
                tag: 'Room',
                examples: [{ tag: 'Example', key: 'base' }],
                exits: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'open', dependencies: ['open'] },
                        children: [{ data: { tag: 'Exit', key: 'DEF#ABC', from: 'DEF', to: 'ABC' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] }]
                    }]
                }],
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
        expect(mergeIntoExamplesMock).toHaveBeenCalledTimes(1)
        expect(mergeIntoExamplesMock.mock.calls[0][0]).toEqual('Test')
        expect(Object.assign({}, ...Object.entries(mergeIntoExamplesMock.mock.calls[0][1]).map(([componentId, examples]) => ({ [componentId]: (examples as StandardExample[]).map((example) => (example.toJSON())) })))).toEqual({
            ['ROOM#ABC']: [{
                key: 'ABC.base',
                tag: 'Example',
                universalKey: 'EXAMPLE#CDE',
                name: ['Vortex']
            }],
            ['ROOM#DEF']: [{
                key: 'DEF.base',
                tag: 'Example',
                universalKey: 'EXAMPLE#FGH',
                name: ['Elsewhere']
            }]
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#Test",
            DataCategory: "Meta::Asset",
            scopeMap: {
                ABC: 'ROOM#ABC',
                'ABC.base': 'EXAMPLE#CDE',
                DEF: 'ROOM#DEF',
                'DEF.base': 'EXAMPLE#FGH',
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