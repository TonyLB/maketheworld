import { contentHeadersDataSource, SubscribedAssetsEvent } from './index'
import { ContentHeadersEventSerializer } from './serializers'
import { ComponentEventUpdate } from '../dataSource/serializers'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardRemove } from '@tonylb/mtw-wml/ts/standardize/components/edits'
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

jest.mock('./serializers', () => ({
    ...jest.requireActual('./serializers'),
    extractComponentMetadata: jest.fn()
}))

jest.mock('./extractHeader', () => ({
    extractHeader: jest.fn()
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })
const extractComponentMetadataMock = jest.mocked(extractComponentMetadata, { shallow: false })
const extractHeaderMock = jest.mocked(require('./extractHeader').extractHeader, { shallow: false })
const messageBusMock = jest.mocked(require('../messageBus').default.send, { shallow: false })

describe('ContentHeadersDataSource (mtw.assets.contentHeaders)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Mock assetDB.query for snapshot generation tests
        assetDBMock.query.mockResolvedValue([])
        assetDBMock.getItem.mockResolvedValue({ zone: 'Canon' })
        // Mock internal cache
        internalCacheMock.AssetData.get.mockResolvedValue([])
        internalCacheMock.AssetMetaData.get.mockResolvedValue([])
        // Mock extractComponentMetadata
        extractComponentMetadataMock.mockReturnValue(null)
        // Mock extractHeader
        extractHeaderMock.mockReturnValue(null)
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

        it('should subscribe to Component Updated events with StandardRemove from mtw.assets', () => {
            const componentRemovedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                event: {
                    streamKey: 'ASSET#asset123',
                    update: {
                        type: 'Component Updated',
                        assetId: 'ASSET#asset123',
                        component: new StandardRemove(new StandardRoom({
                            tag: 'Room',
                            shortName: 'Test Room',
                            universalKey: 'ROOM#room123'
                        }))
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
            
            // Mock extractHeader to return a component with header
            const mockHeaderComponent = new StandardRoom({
                tag: 'Room',
                shortName: 'Test Room',
                universalKey: 'ROOM#room1'
            })
            extractHeaderMock.mockReturnValue(mockHeaderComponent)

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
                    <Room uuid=(room1)><ShortName>Test Room</ShortName></Room>
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
            
            // Don't mock extractHeader - let it work with the real Map component
            // Map components don't have shortName, but should still be included in headers

            const snapshot = await contentHeadersDataSource.snapshotContentGenerator?.('global')

            expect(snapshot).toEqual({
                type: 'Snapshot Generated',
                assets: [
                    {
                        assetId: 'ASSET#test1',
                        zone: 'Canon',
                        standardForm: expect.any(Object)
                    }
                ] // Should include the Map component even without shortName
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

    describe('Event Processing Integration', () => {
        let mockStreamEvent: jest.Mock

        beforeEach(() => {
            mockStreamEvent = jest.fn()
            
            // Reset extractHeader mock
            extractHeaderMock.mockReset()
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
                extractHeaderMock.mockReturnValue(mockHeaderComponent)

                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: mockHeaderComponent
                        }
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
                    streamKey: 'global',
                    detailType: 'Headers Updated'
                })
            })

            it('should skip events when zone cannot be determined', async () => {
                // Mock zone lookup failure
                internalCacheMock.AssetMetaData.get.mockResolvedValue([])

                const componentUpdatedEvent: SubscribedAssetsEvent = {
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
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should skip events when component does not have header information', async () => {
                // Mock zone lookup
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                    AssetId: 'ASSET#asset123',
                    zone: 'Canon'
                }])

                // Mock extractHeader to return null (no header)
                extractHeaderMock.mockReturnValue(null)

                const componentUpdatedEvent: SubscribedAssetsEvent = {
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
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle missing assetId gracefully', async () => {
                const componentUpdatedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: undefined as any,
                            component: new StandardRoom({
                                tag: 'Room',
                                shortName: 'Test Room',
                                universalKey: 'ROOM#room123'
                            })
                        }
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
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: undefined as any
                        }
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
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentUpdatedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(messageBusMock).toHaveBeenCalledWith({
                    type: 'Error',
                    body: {
                        error: 'Failed to process events for asset ASSET#asset123: Cache error',
                        statusCode: 500
                    }
                })
            })
        })

        describe('Component Updated Events with StandardRemove', () => {
            it('should process Component Updated events with StandardRemove and not stream content header updates', async () => {
                // Mock zone lookup
                internalCacheMock.AssetMetaData.get.mockResolvedValue([{
                    AssetId: 'ASSET#asset123',
                    zone: 'Library'
                }])

                const componentRemovedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: new StandardRemove(new StandardRoom({
                                tag: 'Room',
                                shortName: 'Test Room',
                                universalKey: 'ROOM#room123'
                            }))
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentRemovedEvent],
                    streamEvent: mockStreamEvent
                })

                // StandardRemove components should not generate content header updates
                // The actual removal logic is handled by snapshot generation
                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should skip events when zone cannot be determined', async () => {
                // Mock zone lookup failure
                internalCacheMock.AssetMetaData.get.mockResolvedValue([])

                const componentRemovedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: new StandardRemove(new StandardRoom({
                                tag: 'Room',
                                shortName: 'Test Room',
                                universalKey: 'ROOM#room123'
                            }))
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentRemovedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle missing assetId gracefully', async () => {
                const componentRemovedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: undefined as any,
                            component: new StandardRemove(new StandardRoom({
                                tag: 'Room',
                                shortName: 'Test Room',
                                universalKey: 'ROOM#room123'
                            }))
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentRemovedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle missing component gracefully', async () => {
                const componentRemovedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: undefined as any
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentRemovedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should handle errors and send error message to messageBus', async () => {
                // Mock zone lookup to throw error
                internalCacheMock.AssetMetaData.get.mockRejectedValue(new Error('Cache error'))

                const componentRemovedEvent: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    event: {
                        streamKey: 'ASSET#asset123',
                        update: {
                            type: 'Component Updated',
                            assetId: 'ASSET#asset123',
                            component: new StandardRemove(new StandardRoom({
                                tag: 'Room',
                                shortName: 'Test Room',
                                universalKey: 'ROOM#room123'
                            }))
                        }
                    },
                    timestamp: Date.now()
                }

                await contentHeadersDataSource.receiveEvents?.({
                    events: [componentRemovedEvent],
                    streamEvent: mockStreamEvent
                })

                expect(messageBusMock).toHaveBeenCalledWith({
                    type: 'Error',
                    body: {
                        error: 'Failed to process events for asset ASSET#asset123: Cache error',
                        statusCode: 500
                    }
                })
            })
        })

        describe('Multiple Events Processing', () => {
            it('should process multiple events in parallel', async () => {
                // Mock zone lookups
                internalCacheMock.AssetMetaData.get
                    .mockResolvedValueOnce([{ AssetId: 'ASSET#asset1', zone: 'Canon' }])
                    .mockResolvedValueOnce([{ AssetId: 'ASSET#asset2', zone: 'Library' }])

                // Mock extractHeader
                extractHeaderMock.mockReturnValue(new StandardRoom({
                    tag: 'Room',
                    shortName: 'Test Room',
                    universalKey: 'ROOM#room123'
                }))

                const events: SubscribedAssetsEvent[] = [
                    {
                        dataSourceKey: 'mtw.assets',
                        event: {
                            streamKey: 'ASSET#asset1',
                            update: {
                                type: 'Component Updated',
                                assetId: 'ASSET#asset1',
                                component: new StandardRoom({
                                    tag: 'Room',
                                    shortName: 'Room 1',
                                    universalKey: 'ROOM#room1'
                                })
                            }
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        event: {
                            streamKey: 'ASSET#asset2',
                            update: {
                                type: 'Component Updated',
                                assetId: 'ASSET#asset2',
                                component: new StandardRemove(new StandardRoom({
                                    tag: 'Room',
                                    shortName: 'Room 2',
                                    universalKey: 'ROOM#room2'
                                }))
                            }
                        },
                        timestamp: Date.now()
                    }
                ]

                await contentHeadersDataSource.receiveEvents?.({
                    events,
                    streamEvent: mockStreamEvent
                })

                // Both Component Updated and StandardRemove events should generate content header updates
                expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            })
        })
    })

})
