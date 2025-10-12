import { libraryDataSource, SubscribedAssetsEvent } from './index'
import { LibraryEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

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
    AssetMetaData: {
        get: jest.fn()
    }
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })

describe('LibraryDataSource (mtw.assets.library)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Mock assetDB.query for snapshot generation tests
        assetDBMock.query.mockResolvedValue([])
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(libraryDataSource.dataSourceKey).toBe('mtw.assets.library')
            expect(libraryDataSource.replayable).toBe(true)
            expect(libraryDataSource.primaryKeyName).toBe('AssetId')
        })

        it('should have correct event serializer', () => {
            expect(libraryDataSource.eventSerializer).toBeInstanceOf(LibraryEventSerializer)
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to Zone Updated events from mtw.assets', () => {
            const zoneUpdatedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                event: {
                    type: 'Zone Updated',
                    fromZone: 'Canon',
                    toZone: 'Library'
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = libraryDataSource.subscribedEventTypeGuard?.(zoneUpdatedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should subscribe to Asset Cached events from mtw.assets', () => {
            const assetCachedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                event: {
                    type: 'Asset Cached',
                    zone: 'Library'
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = libraryDataSource.subscribedEventTypeGuard?.(assetCachedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should subscribe to Asset Removed events from mtw.assets', () => {
            const assetRemovedEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                event: {
                    type: 'Asset Removed'
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = libraryDataSource.subscribedEventTypeGuard?.(assetRemovedEvent)
            expect(shouldSubscribe).toBe(true)
        })

        it('should not subscribe to Component Updated events', () => {
            const componentEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                event: {
                    type: 'Component Updated',
                    component: {}
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = libraryDataSource.subscribedEventTypeGuard?.(componentEvent)
            expect(shouldSubscribe).toBe(false)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent: StreamingEventPayload = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#asset123',
                event: {
                    type: 'Content Update'
                },
                timestamp: Date.now()
            }

            const shouldSubscribe = libraryDataSource.subscribedEventTypeGuard?.(otherEvent)
            expect(shouldSubscribe).toBe(false)
        })
    })

    describe('Event Processing', () => {
        let mockStreamEvent: jest.Mock

        beforeEach(() => {
            mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        })

        describe('Zone Updated events', () => {
            it('should emit Asset Added when asset moves into Library', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Zone Updated',
                        fromZone: 'Personal',
                        toZone: 'Library'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1'
                    },
                    streamKey: 'global'
                })
            })

            it('should emit Asset Removed when asset moves out of Library', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Zone Updated',
                        fromZone: 'Library',
                        toZone: 'Personal'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test1'
                    },
                    streamKey: 'global'
                })
            })

            it('should ignore zone changes not involving Library', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Zone Updated',
                        fromZone: 'Canon',
                        toZone: 'Personal'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should ignore zone changes within Library', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Zone Updated',
                        fromZone: 'Library',
                        toZone: 'Library'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })
        })

        describe('Asset Cached events', () => {
            it('should emit Asset Added when asset cached in Library zone', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Asset Cached',
                        zone: 'Library'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: {
                        type: 'Asset Added',
                        assetId: 'ASSET#test1'
                    },
                    streamKey: 'global'
                })
            })

            it('should ignore Asset Cached in non-Library zones', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Asset Cached',
                        zone: 'Personal'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })
        })

        describe('Asset Removed events', () => {
            it('should emit Asset Removed for any asset removal', async () => {
                const event: SubscribedAssetsEvent = {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test1',
                    event: {
                        type: 'Asset Removed'
                    },
                    timestamp: Date.now()
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: {
                        type: 'Asset Removed',
                        assetId: 'ASSET#test1'
                    },
                    streamKey: 'global'
                })
            })
        })

        describe('Batch processing', () => {
            it('should process multiple events in parallel', async () => {
                const events: SubscribedAssetsEvent[] = [
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#test1',
                        event: {
                            type: 'Zone Updated',
                            fromZone: 'Canon',
                            toZone: 'Library'
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#test2',
                        event: {
                            type: 'Asset Cached',
                            zone: 'Library'
                        },
                        timestamp: Date.now()
                    },
                    {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#test3',
                        event: {
                            type: 'Zone Updated',
                            fromZone: 'Library',
                            toZone: 'Personal'
                        },
                        timestamp: Date.now()
                    }
                ]

                await libraryDataSource.receiveEvents?.({
                    events,
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).toHaveBeenCalledTimes(3)
                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: { type: 'Asset Added', assetId: 'ASSET#test1' },
                    streamKey: 'global'
                })
                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: { type: 'Asset Added', assetId: 'ASSET#test2' },
                    streamKey: 'global'
                })
                expect(mockStreamEvent).toHaveBeenCalledWith({
                    update: { type: 'Asset Removed', assetId: 'ASSET#test3' },
                    streamKey: 'global'
                })
            })
        })
    })
})

