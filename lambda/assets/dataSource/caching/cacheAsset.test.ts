import eventBridgeClient from '@tonylb/mtw-utilities/ts/eventBridge'
import { cacheAsset } from './cacheAsset'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import internalCache from '../../internalCache'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('../../internalCache', () => ({
    ...jest.requireActual('../../internalCache'),
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

// Mock streamEvent function
const mockStreamEvent = jest.fn()
const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('Cache Asset (Data Source)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        standardFormMock = new StandardForm('<Asset key=(Test) />')
        mockStreamEvent.mockResolvedValue(undefined)
    })

    it('should publish Character Removed event', async () => {
        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([])

        await cacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })
        
        expect(mockStreamEvent).toHaveBeenCalledWith({
            update: {
                type: 'Character Removed',
                characterId: 'CHARACTER#12345'
            },
            streamKey: 'CHARACTER#12345',
            detailType: 'Character Removed'
        })
    })

    it('should publish Character Updated event', async () => {
        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([{
            ComponentId: 'CHARACTER#12345',
            byAssets: [{ AssetId: 'ASSET#Test', component: new StandardCharacter('<Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character>') }]
        }])
        standardFormMock = new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')

        await cacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })
        
        expect(mockStreamEvent).toHaveBeenCalledWith({
            update: {
                type: 'Character Updated',
                characterId: 'CHARACTER#12345',
                byAssets: [{
                    AssetId: 'ASSET#Test',
                    component: {
                        key: 'TestCharacter',
                        tag: 'Character',
                        shortName: 'Test',
                        universalKey: 'CHARACTER#12345'
                    }
                }]
            },
            streamKey: 'CHARACTER#12345',
            detailType: 'Character Updated'
        })
    })

    describe('Asset ID handling', () => {
        it('should handle asset key format (primitives)', async () => {
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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

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

            await cacheAsset({ assetId: 'ASSET#primitives', streamEvent: mockStreamEvent })

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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should not call putItem or optimisticUpdate
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should cache when address is present', async () => {
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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should call putItem for the new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(1)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        })
    })

    describe('Component removal', () => {
        it('should delete removed components', async () => {
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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should call deleteItem for the removed component
            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'KNOWLEDGE#knowledgeRoot',
                DataCategory: 'ASSET#primitives'
            })
        })
    })

    describe('Diff behavior', () => {
        it('should detect no changes when dbAsset and fileAsset are identical', async () => {
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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should not call any database operations
            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
            expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()
        })

        it('should detect new components when dbAsset is empty and fileAsset has content', async () => {
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

            await cacheAsset({ assetId: 'primitives', streamEvent: mockStreamEvent })

            // Should call putItem for each new component
            expect(assetDBMock.putItem).toHaveBeenCalledTimes(2)
            expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        })
    })
})
