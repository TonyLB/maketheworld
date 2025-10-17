import eventBridgeClient from '@tonylb/mtw-utilities/ts/eventBridge'
import { cacheAsset } from './cacheAsset'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import internalCache from '../../internalCache'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn(),
        getItem: jest.fn()
    }
}))

jest.mock('../../internalCache', () => ({
    ...jest.requireActual('../../internalCache'),
    AssetData: {
        get: jest.fn(),
        invalidate: jest.fn()
    },
    AssetMetaData: {
        get: jest.fn().mockResolvedValue([{ zone: 'Draft', player: 'Test' }]),
        invalidate: jest.fn()
    },
    ComponentData: {
        get: jest.fn().mockResolvedValue([]),
        invalidate: jest.fn()
    }
}))

const internalCacheMock = jest.mocked(internalCache, { shallow: false })

let standardFormMock = new StandardForm('<Asset uuid=(Test) />')
const mockLoadJSON = jest.fn()

jest.mock('@tonylb/mtw-asset-workspace', () => {
    const mockAssetWorkspaceClass = jest.fn().mockImplementation((address: any) => ({
        status: {
            json: 'Clean'
        },
        address,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }));
    
    // Add static fromUUID method to the mock class
    (mockAssetWorkspaceClass as any).fromUUID = jest.fn().mockImplementation(async (assetId: string) => ({
        status: {
            json: 'Clean'
        },
        address: { zone: 'Canon', fileName: assetId.replace('ASSET#', '').replace('CHARACTER#', ''), subFolder: 'Assets' },
        assetId,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }))
    
    return {
        __esModule: true,
        default: mockAssetWorkspaceClass,
        AssetWorkspace: mockAssetWorkspaceClass
    }
})

// Mock streamEvent function
const mockStreamEvent = jest.fn()
const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('Cache Asset (Data Source)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        standardFormMock = new StandardForm('<Asset uuid=(Test) />')
        mockStreamEvent.mockResolvedValue(undefined)
        // Mock getItem to return empty result by default (simulating no prior Meta::Asset record)
        assetDBMock.getItem.mockResolvedValue({})
    })

    describe('Asset ID handling', () => {
        it('should handle asset key format (primitives)', async () => {
            // Mock empty dbAsset (no existing data)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
            expect(componentIds).toContain('ASSET#primitives')  // Meta::Asset
            expect(componentIds).toContain('ROOM#VORTEX')
            expect(componentIds).toContain('KNOWLEDGE#knowledgeRoot')

            // Should call optimisticUpdate for each component
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })

        it('should handle asset UUID format (ASSET#primitives)', async () => {
            // Mock empty dbAsset (no existing data)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'ASSET#primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
            expect(componentIds).toContain('ASSET#primitives')  // Meta::Asset
            expect(componentIds).toContain('ROOM#VORTEX')
            expect(componentIds).toContain('KNOWLEDGE#knowledgeRoot')

            // Should call optimisticUpdate for each component
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })
    })

    describe('Address handling', () => {
        it('should not cache when address is missing', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return no zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: undefined
            }])

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should not call putItem or optimisticUpdate
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should cache when address is present', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + the new component (1 + 1 = 2)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        })
    })

    describe('Component removal', () => {
        it('should delete removed components', async () => {
            // Mock dbAsset with existing component
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm(`
                    <Asset uuid=(primitives)>
                        <Room uuid=(VORTEX) />
                        <Knowledge uuid=(knowledgeRoot) />
                    </Asset>
                `)
            }])

            // Mock AssetMetaData.get to return zone
            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with only one component (removed one)
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should call deleteItem for the removed component
            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'KNOWLEDGE#knowledgeRoot',
                DataCategory: 'ASSET#primitives'
            })

            // Should emit Component Updated streaming event with StandardRemove payload
            expect(mockStreamEvent).toHaveBeenCalled()
            const removalCall = mockStreamEvent.mock.calls.find(([arg]) => arg.update?.type === 'Component Updated' && arg.streamKey === 'primitives')?.[0]
            expect(removalCall).toBeTruthy()
            expect(removalCall.update.type).toBe('Component Updated')
            expect(removalCall.update.component?.tag).toBe('Remove')
            expect(removalCall.update.component?.universalKey).toBe('KNOWLEDGE#knowledgeRoot')
        })
    })

    describe('Diff behavior', () => {
        it('should detect no changes when dbAsset and fileAsset are identical', async () => {
            const identicalForm = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            // Mock dbAsset and fileAsset with identical content
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: identicalForm
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            standardFormMock = identicalForm

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should write Meta::Asset even with no component changes
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(1)
            expect(assetDBMock.putItem).toHaveBeenCalledWith({
                AssetId: 'ASSET#primitives',
                DataCategory: 'Meta::Asset',
                zone: 'Canon'
            })
            
            // Should not call component-related operations
            expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should detect new components when dbAsset is empty and fileAsset has content', async () => {
            // Mock empty dbAsset
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm('<Asset uuid=(primitives) />')
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)

            // Should emit Component Updated events with StandardComponent objects
            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            
            // Extract the actual components from the mock calls
            const firstCall = mockStreamEvent.mock.calls[0][0]
            const secondCall = mockStreamEvent.mock.calls[1][0]
            
            // Validate first component (Knowledge)
            expect(firstCall.update.type).toBe('Component Updated')
            expect(firstCall.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const firstComponentWML = schemaToWML([firstCall.update.component.schema])
            expect(firstComponentWML).toEqual(deIndentWML(`
                <Knowledge uuid=(knowledgeRoot) />
            `))
            
            // Validate second component (Room)
            expect(secondCall.update.type).toBe('Component Updated')
            expect(secondCall.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const secondComponentWML = schemaToWML([secondCall.update.component.schema])
            expect(secondComponentWML).toEqual(deIndentWML(`
                <Room uuid=(VORTEX) />
            `))
        })
    })

    describe('Component updated streaming', () => {
        it('should publish Component Updated event with delta WML for changed component', async () => {
            // db has a Room with one ShortName, file adds/changes description
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: new StandardForm(`
                    <Asset uuid=(primitives)>
                        <Room uuid=(VORTEX) />
                    </Asset>
                `)
            }])

            internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                zone: 'Canon'
            }])

            // file adds a ShortName to the existing Room (delta should be StandardReplace for Room with ShortName)
            standardFormMock = new StandardForm(`
                <Asset uuid=(primitives)>
                    <Room uuid=(VORTEX)><ShortName>Vortex</ShortName></Room>
                </Asset>
            `)

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Extract the actual component from the mock call
            const call = mockStreamEvent.mock.calls[0][0]
            
            // Validate component structure
            expect(call.update.type).toBe('Component Updated')
            expect(call.streamKey).toBe('primitives')
            
            // Validate that the component serializes to the expected WML
            const componentWML = schemaToWML([call.update.component.schema])
            expect(componentWML).toEqual(deIndentWML(`
                <Room uuid=(VORTEX)><ShortName>Vortex</ShortName></Room>
            `))
        })
    })
})
