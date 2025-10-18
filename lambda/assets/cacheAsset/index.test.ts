import eventBridgeClient from '@tonylb/mtw-utilities/ts/eventBridge'
import { MessageBus } from '../messageBus/baseClasses'
import { cacheAssetMessage } from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import internalCache from '../internalCache'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn(),
        getItem: jest.fn()
    }
}))

jest.mock('../internalCache', () => ({
    ...jest.requireActual('../internalCache'),
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

jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
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
        ReadOnlyAssetWorkspace: mockAssetWorkspaceClass
    }
})

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    send: jest.fn()
}))

const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })
const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('Cache Asset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        standardFormMock = new StandardForm('<Asset uuid=(Test) />')
        // Mock getItem to return empty result by default (simulating no prior Meta::Asset record)
        assetDBMock.getItem.mockResolvedValue({})
    })

    it('should not publish Character Removed event (handled by characters data source)', async () => {
        const event = {
            type: 'CacheAsset',
            assetId: 'Test'
        } as const

        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm('<Asset uuid=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([])

        const messageBus = {
            send: jest.fn()
        } as unknown as MessageBus
        await cacheAssetMessage({ payloads: [event], messageBus })
        expect(eventBridgeSendMock).not.toHaveBeenCalled()
    })

    it('should not publish Character Updated event (handled by characters data source)', async () => {
        const event = {
            type: 'CacheAsset',
            assetId: 'Test'
        } as const

        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm('<Asset uuid=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([{
            ComponentId: 'CHARACTER#12345',
            byAssets: [{ AssetId: 'ASSET#Test', component: new StandardCharacter('<Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character>') }]
        }])
        standardFormMock = new StandardForm('<Asset uuid=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')

        const messageBus = {
            send: jest.fn()
        } as unknown as MessageBus
        await cacheAssetMessage({ payloads: [event], messageBus })
        expect(eventBridgeSendMock).not.toHaveBeenCalled()
    })

    describe('Asset ID handling', () => {
        it('should handle asset key format (primitives)', async () => {
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

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
            const event = {
                type: 'CacheAsset',
                assetId: 'ASSET#primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

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
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should not call putItem or optimisticUpdate
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should cache when address is present', async () => {
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Phase 1B: Should call putItem for Meta::Asset + the new component (1 + 1 = 2)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        })
    })

    describe('Component removal', () => {
        it('should delete removed components', async () => {
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should call deleteItem for the removed component
            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'KNOWLEDGE#knowledgeRoot',
                DataCategory: 'ASSET#primitives'
            })
        })
    })

    describe('Diff behavior', () => {
        it('should detect no changes when dbAsset and fileAsset are identical', async () => {
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

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
            const event = {
                type: 'CacheAsset',
                assetId: 'primitives'
            } as const

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

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Phase 1B: Should call putItem for Meta::Asset + each new component (1 + 2 = 3)
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(3)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })
    })
})