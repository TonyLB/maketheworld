import { contentHeadersDataSource, SubscribedAssetsEvent, SubscribedWMLEvent, SubscribedEvent } from './index'
import { ContentHeadersEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import internalCache from '../internalCache'
import messageBus from '../messageBus'

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

jest.mock('../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() }
}))

jest.mock('../messageBus', () => ({
    default: {
        send: jest.fn(),
        subscribe: jest.fn()
    },
    send: jest.fn(),
    subscribe: jest.fn()
}))
jest.mock('../internalCache', () => ({
    AssetData: {
        get: jest.fn()
    },
    AssetMetaData: {
        get: jest.fn()
    }
}))
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

describe('ContentHeadersDataSource (mtw.assets.contentHeaders)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Mock assetDB.query for snapshot generation tests
        assetDBMock.query.mockResolvedValue([])
        assetDBMock.getItem.mockResolvedValue({ zone: 'Canon' })
        // Mock internal cache
        internalCacheMock.AssetData.get.mockResolvedValue([])
        internalCacheMock.AssetMetaData.get.mockResolvedValue([])
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
                streamKey: 'ASSET#asset123',
                detailEnvelope: {
                    type: 'Component Updated',
                    assetId: 'ASSET#asset123',
                    component: new StandardRoom({
                        tag: 'Room',
                        shortName: 'Test Room',
                        universalKey: 'ROOM#room123'
                    })
                },
                timestamp: Date.now()
            } as const

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(componentUpdatedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.ephemera',
                streamKey: 'CHARACTER#char123',
                detailEnvelope: {
                    type: 'Character Updated',
                    characterId: 'CHARACTER#char123'
                },
                timestamp: Date.now()
            } as const

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(otherEvent)
            expect(shouldSubscribe).toBe(false)
        })

        it('should not subscribe to non-component events from mtw.assets', () => {
            const nonComponentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                detailEnvelope: {
                    type: 'CacheAsset',
                    assetId: 'ASSET#asset123'
                },
                timestamp: Date.now()
            } as const

            const shouldSubscribe = contentHeadersDataSource.subscribedEventTypeGuard?.(nonComponentEvent)
            expect(shouldSubscribe).toBe(false)
        })
    })

    describe('Snapshot Generation', () => {
        it('should generate empty snapshot when no assets exist', async () => {
            assetDBMock.query.mockResolvedValue([])

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot',
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
            const mockStandardForm = new StandardForm(`<Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <ShortName>Test Room</ShortName>
                </Room>
            </Asset>`)
            internalCacheMock.AssetData.get.mockResolvedValue([{
                AssetId: 'ASSET#test',
                standardForm: mockStandardForm
            }])

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            // First, verify the overall structure
            expect(snapshot).toEqual({
                type: 'Snapshot',
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

            // Verify the actual WML content for each asset
            const canonAsset = snapshot!.assets[0]
            const canonWML = schemaToWML([canonAsset.standardForm.schema])
            expect(canonWML).toBe(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))

            const libraryAsset = snapshot!.assets[1]
            const libraryWML = schemaToWML([libraryAsset.standardForm.schema])
            expect(libraryWML).toBe(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))

            const personalAsset = snapshot!.assets[2]
            const personalWML = schemaToWML([personalAsset.standardForm.schema])
            expect(personalWML).toBe(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))

        })

        it('should handle errors gracefully and return empty snapshot', async () => {
            assetDBMock.query.mockRejectedValue(new Error('Database error'))

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot',
                assets: []
            })
        })
    })

    describe('Event Processing Integration', () => {
        let mockStreamEvent: jest.Mock

        beforeEach(() => {
            mockStreamEvent = jest.fn()
        })

        describe('Component Updated Events', () => {
            it('should process Component Updated events and stream content header updates', async () => {
                // Mock zone lookup
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                    AssetId: 'ASSET#asset123',
                    zone: 'Canon'
                }])

                // Mock extractHeader to return a component with header
                const mockHeaderComponent = new StandardRoom({
                    tag: 'Room',
                    shortName: 'Test Room',
                    universalKey: 'ROOM#room123'
                })

                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    detailEnvelope: {
                        type: 'Component Updated',
                        component: mockHeaderComponent
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: expect.objectContaining({
                        type: 'Headers Updated',
                        assetId: 'ASSET#asset123',
                        zone: 'Canon',
                        standardForm: expect.any(Object)
                    }),
                    streamKey: 'global'
                })

                // Verify the actual WML content
                const streamEventCall = mockStreamEvent.mock.calls[0][0]
                const standardForm = streamEventCall.update.standardForm
                const wmlContent = schemaToWML([standardForm.schema])
                expect(wmlContent).toBe(deIndentWML(`
                    <Asset uuid=(asset123)>
                        <Room uuid=(room123)><ShortName>Test Room</ShortName></Room>
                    </Asset>
                `))
            })

            it('should skip events when zone cannot be determined', async () => {
                // Mock zone lookup failure
                internalCacheMock.AssetMetaData.get.mockResolvedValue([])

                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    detailEnvelope: {
                        type: 'Component Updated',
                        component: new StandardRoom({
                            tag: 'Room',
                            shortName: 'Test Room',
                            universalKey: 'ROOM#room123'
                        })
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle missing component gracefully', async () => {
                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    detailEnvelope: {
                        type: 'Component Updated',
                        component: undefined as any
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle errors and send error message to messageBus', async () => {
                // Mock zone lookup to throw error
                internalCacheMock.AssetMetaData.get.mockRejectedValue(new Error('Cache error'))

                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    detailEnvelope: {
                        type: 'Component Updated',
                        component: new StandardRoom({
                            tag: 'Room',
                            shortName: 'Test Room',
                            universalKey: 'ROOM#room123'
                        })
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(messageBus.send).toHaveBeenCalledWith({
                    type: 'Error',
                    body: {
                        error: 'Could not determine zone for asset ASSET#asset123',
                        statusCode: 400
                    }
                })
            })
        })

        describe('Zone Changed Event Processing', () => {
            it('should stream Zone Updated event when receiving Zone Changed from WML', async () => {
                const zoneChangedEvent: SubscribedWMLEvent = {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'global',
                    detailEnvelope: {
                        type: 'Zone Changed',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [zoneChangedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    streamKey: 'global',
                    update: {
                        type: 'Zone Updated',
                        assetId: 'global',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }
                })
            })

            it('should process multiple Zone Changed events', async () => {
                const zoneChangedEvents: SubscribedWMLEvent[] = [
                    {
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test1',
                        detailEnvelope: {
                            type: 'Zone Changed',
                            fromZone: 'Canon',
                            toZone: 'Library'
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test2',
                        detailEnvelope: {
                            type: 'Zone Changed',
                            fromZone: 'Library',
                            toZone: 'Personal'
                        },
                        timestamp: Date.now()
                    }
                ]

                await contentHeadersDataSource.receiveEvents?.({
                    events: zoneChangedEvents,
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledTimes(2)
                expect(mockStreamEvent).toHaveBeenNthCalledWith(1, {
                    streamKey: 'global',
                    update: {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test1',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }
                })
                expect(mockStreamEvent).toHaveBeenNthCalledWith(2, {
                    streamKey: 'global',
                    update: {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test2',
                        fromZone: 'Library',
                        toZone: 'Personal'
                    }
                })
            })

            it('should handle mixed Zone Changed and Component Updated events', async () => {
                // Mock zone lookup for component event
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#test1', zone: 'Canon' }])

                const mixedEvents: SubscribedEvent[] = [
                    {
                        dataSourceKey: 'mtw.wml',
                        streamKey: 'ASSET#test1',
                        detailEnvelope: {
                            type: 'Zone Changed',
                            fromZone: 'Canon',
                            toZone: 'Library'
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#test1',
                        detailEnvelope: {
                            type: 'Component Updated',
                            component: new StandardRoom({
                                tag: 'Room',
                                shortName: 'Updated Room',
                                universalKey: 'ROOM#room123'
                            })
                        },
                        timestamp: Date.now()
                    }
                ]

                await contentHeadersDataSource.receiveEvents?.({
                    events: mixedEvents,
                    streamEvent: mockStreamEvent
                })

                // Should stream both Zone Updated and Headers Updated events
                expect(mockStreamEvent).toHaveBeenCalledWith({
                    streamKey: 'global',
                    update: {
                        type: 'Zone Updated',
                        assetId: 'ASSET#test1',
                        fromZone: 'Canon',
                        toZone: 'Library'
                    }
                })
                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: expect.objectContaining({
                        type: 'Headers Updated',
                        assetId: 'ASSET#test1',
                        zone: 'Canon'
                    }),
                    streamKey: 'global'
                })
            })
        })

        describe('Multiple Events Processing', () => {
            it('should process multiple events in parallel', async () => {
                // Mock zone lookups
                internalCacheMock.AssetMetaData.get
                    .mockResolvedValueOnce([{ AssetId: 'ASSET#asset1', zone: 'Canon' }])
                    .mockResolvedValueOnce([{ AssetId: 'ASSET#asset2', zone: 'Library' }])

                const events: SubscribedAssetsEvent[] = [
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset1',
                        detailEnvelope: {
                            type: 'Component Updated',
                            component: new StandardRoom({
                                tag: 'Room',
                                shortName: 'Room 1',
                                universalKey: 'ROOM#room1'
                            })
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset2',
                        detailEnvelope: {
                            type: 'Component Updated',
                            component: new StandardRoom({
                                tag: 'Room',
                                shortName: 'Room 2',
                                universalKey: 'ROOM#room2'
                            })
                        },
                        timestamp: Date.now()
                    }
                ]

                await contentHeadersDataSource.receiveEvents?.({
                    events,
                    streamEvent: mockStreamEvent
                })

                // Both Component Updated events should generate content header updates
                expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            })
        })

        describe('Asset Updated Events', () => {
            it('should process Asset Updated event and include asset metadata in headers update', async () => {
                // Zone lookup
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#assetMeta', zone: 'Canon' }])

                const assetUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#assetMeta',
                    detailEnvelope: {
                        type: 'Asset Updated',
                        standardForm: new StandardForm(deIndentWML(`
                            <Asset uuid=(assetMeta)><ShortName>Meta Name</ShortName></Asset>
                        `))
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [assetUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: expect.objectContaining({
                        type: 'Headers Updated',
                        assetId: 'ASSET#assetMeta',
                        zone: 'Canon',
                        standardForm: expect.any(Object)
                    }),
                    streamKey: 'global'
                })

                const call = mockStreamEvent.mock.calls[0][0]
                const wml = schemaToWML([call.update.standardForm.schema])
                expect(wml).toBe(deIndentWML(`
                    <Asset uuid=(assetMeta)><ShortName>Meta Name</ShortName></Asset>
                `))
            })

            it('should merge Asset Updated metadata with component header updates', async () => {
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{ AssetId: 'ASSET#mix', zone: 'Library' }])

                const events: SubscribedEvent[] = [
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#mix',
                        detailEnvelope: {
                            type: 'Asset Updated',
                            standardForm: new StandardForm(deIndentWML(`<Asset uuid=(mix)><ShortName>Asset Hdr</ShortName></Asset>`))
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#mix',
                        detailEnvelope: {
                            type: 'Component Updated',
                            component: new StandardRoom({ tag: 'Room', shortName: 'Hdr', universalKey: 'ROOM#r1' })
                        },
                        timestamp: Date.now()
                    }
                ]

                await contentHeadersDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

                const call = mockStreamEvent.mock.calls[0][0]
                const wml = schemaToWML([call.update.standardForm.schema])
                expect(wml).toBe(deIndentWML(`
                    <Asset uuid=(mix)>
                        <ShortName>Asset Hdr</ShortName>
                        <Room uuid=(r1)><ShortName>Hdr</ShortName></Room>
                    </Asset>
                `))
            })
        })
    })

})
