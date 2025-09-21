import { contentHeadersDataSource, SubscribedAssetsEvent } from './index'
import { ContentHeadersSnapshot, ContentHeadersUpdate } from './baseClasses'
import { ContentHeadersEventSerializer } from './serializers'
import { ComponentEventUpdate } from '../dataSource/serializers'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardFeature } from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { extractComponentMetadata } from './serializers'
import internalCache from '../internalCache'

// Mock external dependencies
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: { send: jest.fn() }
}))

jest.mock('../messageBus')
jest.mock('../internalCache', () => ({
    AssetData: {
        get: jest.fn()
    },
    Meta: {
        get: jest.fn()
    }
}))

jest.mock('./serializers', () => ({
    ...jest.requireActual('./serializers'),
    extractComponentMetadata: jest.fn()
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })
const extractComponentMetadataMock = jest.mocked(extractComponentMetadata, { shallow: false })

describe('ContentHeadersDataSource (mtw.assets.contentHeaders)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Mock assetDB.query for snapshot generation tests
        assetDBMock.query.mockResolvedValue([])
        assetDBMock.getItem.mockResolvedValue({ zone: 'Canon' })
        // Mock internal cache
        internalCacheMock.AssetData.get.mockResolvedValue([])
        internalCacheMock.Meta.get.mockResolvedValue([])
        // Mock extractComponentMetadata
        extractComponentMetadataMock.mockReturnValue(null)
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(contentHeadersDataSource.dataSourceKey).toBe('mtw.assets.contentHeaders')
            expect(contentHeadersDataSource.replayable).toBe(true)
            expect(contentHeadersDataSource.primaryKeyName).toBe('AssetId')
        })

        it('should have correct event serializer', () => {
            expect(contentHeadersDataSource.eventSerializer).toBeInstanceOf(ContentHeadersEventSerializer)
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to Component Updated events from mtw.assets', () => {
            const componentUpdatedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component: new StandardRoom({
                            tag: 'Room',
                            shortName: 'Test Room',
                            universalKey: 'ROOM#room123'
                        })
                    } as ComponentEventUpdate
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(componentUpdatedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should subscribe to Component Removed events from mtw.assets', () => {
            const componentRemovedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Removed',
                        assetId: 'ASSET#asset123',
                        componentId: 'ROOM#room123'
                    } as ComponentEventUpdate
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(componentRemovedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.ephemera',
                event: {
                    streamKey: 'CHARACTER#char123',
                    update: {
                        type: 'Character Updated',
                        characterId: 'CHARACTER#char123'
                    }
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(otherEvent)
            expect(shouldSubscribe).toBe(false)
        })

        it('should not subscribe to non-component events from mtw.assets', () => {
            const nonComponentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'CacheAsset',
                        assetId: 'ASSET#asset123'
                    }
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(nonComponentEvent)
            expect(shouldSubscribe).toBe(false)
        })
    })

    describe('Snapshot Generation', () => {
        it('should generate empty snapshot when no assets exist', async () => {
            assetDBMock.query.mockResolvedValue([])

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot Generated',
                assets: []
            })
        })

        it('should generate snapshot with assets from all zones', async () => {
            // Mock assets from different zones
            const mockAssets = [
                { AssetId: 'ASSET#canon1', DataCategory: 'Meta::Asset', zone: 'Canon' },
                { AssetId: 'ASSET#library1', DataCategory: 'Meta::Asset', zone: 'Library' },
                { AssetId: 'ASSET#personal1', DataCategory: 'Meta::Asset', zone: 'Personal' }
            ]
            assetDBMock.query.mockResolvedValue(mockAssets)

            // Mock asset data with components that have headers
            const mockStandardForm = new StandardForm(`<Asset key=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                </Room>
            </Asset>`)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: mockStandardForm
            }])

            // Mock extractComponentMetadata to return a StandardForm
            const mockHeaderStandardForm = new StandardForm(`
                <Asset key=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Test Room</ShortName>
                    </Room>
                </Asset>`)
            extractComponentMetadataMock.mockReturnValue(mockHeaderStandardForm)

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            // First, verify the overall structure
            expect(snapshot).toEqual({
                type: 'Snapshot Generated',
                assets: [
                    {
                        assetId: 'ASSET#canon1',
                        zone: 'Canon',
                        standardForm: expect.any(Object)
                    },
                    {
                        assetId: 'ASSET#library1',
                        zone: 'Library',
                        standardForm: expect.any(Object)
                    },
                    {
                        assetId: 'ASSET#personal1',
                        zone: 'Personal',
                        standardForm: expect.any(Object)
                    }
                ]
            })

            // Then verify the WML content of each StandardForm
            
            const expectedWML = deIndentWML(`
                <Asset key=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `)

            snapshot!.assets.forEach(asset => {
                const actualWML = schemaToWML([asset.standardForm.schema])
                expect(actualWML).toBe(expectedWML)
            })
        })

        it('should handle assets without components that have headers', async () => {
            const mockAssets = [
                { AssetId: 'ASSET#test1', DataCategory: 'Meta::Asset', zone: 'Canon' }
            ]
            assetDBMock.query.mockResolvedValue(mockAssets)

            // Mock asset data with components that don't have headers
            const mockStandardForm = new StandardForm(`<Asset key=(test)>
                <Map uuid=(map1) key=(map1) />
            </Asset>`)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test1',
                standardForm: mockStandardForm
            }])

            // Mock extractComponentMetadata to return null (no header found)
            extractComponentMetadataMock.mockReturnValue(null)

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot Generated',
                assets: [] // Should be empty since no components have headers
            })
        })

        it('should handle errors gracefully and return empty snapshot', async () => {
            assetDBMock.query.mockRejectedValue(new Error('Database error'))

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot Generated',
                assets: []
            })
        })
    })

})
