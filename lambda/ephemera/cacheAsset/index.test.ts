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
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'

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
                <Room uuid=(ABC)>
                    <Example uuid=(ABCbase)>
                        <Name>
                            Vortex (lit)
                        </Name>
                        <Description>The lights are on</Description>
                    </Example>
                </Room>
                <Knowledge uuid=(testKnowledge)>
                    <Example uuid=(testKnowledgeBase)>
                        <Name>Knowledge is power</Name>
                        <Description>There is so much to learn!</Description>
                    </Example>
                </Knowledge>
            </Asset>
            `)
        
        workspaceMock.mockImplementation(mockWorkspace(testStandard))

        await cacheAsset({
            assetId: 'ASSET#Test',
            messageBus: messageBusMock
        })

        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#Test',
            edges: [],
            options: { direction: 'back' }
        }])
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ROOM#ABC',
            header: true
        })
    })

    it('should set graph edges when asset has imports', async () => {
        internalCacheMock.AssetAddress.get.mockResolvedValue({ EphemeraId: 'ASSET#Test', address: { fileName: 'Test', zone: 'Library' } })

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        const testStandard = new StandardForm(`
            <Asset key=(Test)>
                <Room uuid=(ABC) from=(ASSET#base)><Name>Vortex</Name></Room>
            </Asset>
            `)

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