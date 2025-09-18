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
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('../internalCache', () => ({
    ...jest.requireActual('../internalCache'),
    AssetData: {
        get: jest.fn(),
        invalidate: jest.fn()
    },
    Meta: {
        get: jest.fn().mockResolvedValue([{ address: { zone: 'Draft', player: 'Test' } }]),
        invalidate: jest.fn()
    },
    ComponentData: {
        get: jest.fn().mockResolvedValue([]),
        invalidate: jest.fn()
    }
}))

const internalCacheMock = jest.mocked(internalCache, { shallow: false })

let standardFormMock = new StandardForm('<Asset key=(Test) />')
jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            loadJSON: jest.fn(),
            standard: standardFormMock
        }
    })
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
        standardFormMock = new StandardForm('<Asset key=(Test) />')
    })

    it('should not publish Character Removed event (handled by characters data source)', async () => {
        const event = {
            type: 'CacheAsset',
            assetId: 'Test'
        } as const

        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
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
            standardForm: new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([{
            ComponentId: 'CHARACTER#12345',
            byAssets: [{ AssetId: 'ASSET#Test', component: new StandardCharacter('<Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character>') }]
        }])
        standardFormMock = new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')

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
                standardForm: new StandardForm('<Asset key=(primitives) />')
            }])

            // Mock Meta.get to return address
            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset key=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should call putItem for each new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
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
                standardForm: new StandardForm('<Asset key=(primitives) />')
            }])

            // Mock Meta.get to return address
            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset key=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should call putItem for each new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            const putItemCalls = assetDBMock.putItem.mock.calls
            const componentIds = putItemCalls.map(call => call[0].AssetId)
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
                standardForm: new StandardForm('<Asset key=(primitives) />')
            }])

            // Mock Meta.get to return no address
            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: undefined
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
                standardForm: new StandardForm('<Asset key=(primitives) />')
            }])

            // Mock Meta.get to return address
            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset key=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should call putItem for the new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(1)
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
                    <Asset key=(primitives)>
                        <Room uuid=(VORTEX) />
                        <Knowledge uuid=(knowledgeRoot) />
                    </Asset>
                `)
            }])

            // Mock Meta.get to return address
            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            // Mock fileAsset with only one component (removed one)
            standardFormMock = new StandardForm(`
                <Asset key=(primitives)>
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
                <Asset key=(primitives)>
                    <Room uuid=(VORTEX) />
                </Asset>
            `)

            // Mock dbAsset and fileAsset with identical content
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                standardForm: identicalForm
            }])

            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            standardFormMock = identicalForm

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should not call any database operations
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
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
                standardForm: new StandardForm('<Asset key=(primitives) />')
            }])

            internalCacheMock.Meta.get.mockResolvedValue([{
                AssetId: 'ASSET#primitives',
                address: {
                    zone: 'Canon',
                    fileName: 'primitives',
                    subFolder: 'Assets'
                }
            }])

            // Mock fileAsset with content
            standardFormMock = new StandardForm(`
                <Asset key=(primitives)>
                    <Room uuid=(VORTEX) />
                    <Knowledge uuid=(knowledgeRoot) />
                </Asset>
            `)

            const messageBus = {
                send: jest.fn()
            } as unknown as MessageBus

            await cacheAssetMessage({ payloads: [event], messageBus })

            // Should call putItem for each new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })
    })
})