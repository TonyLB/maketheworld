import { libraryDataSource } from './index'
import { LibraryEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'
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
            const header = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                timestamp: Date.now(),
                type: 'Zone Updated'
            }

            expect(libraryDataSource.subscribedEventTypeGuard?.(header)).toBe(true)
        })

        it('should subscribe to Asset Cached events from mtw.assets', () => {
            const header = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                timestamp: Date.now(),
                type: 'Asset Cached'
            }

            expect(libraryDataSource.subscribedEventTypeGuard?.(header)).toBe(true)
        })

        it('should subscribe to Asset Removed events from mtw.assets', () => {
            const header = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                timestamp: Date.now(),
                type: 'Asset Removed'
            }

            expect(libraryDataSource.subscribedEventTypeGuard?.(header)).toBe(true)
        })

        it('should not subscribe to Component Updated events', () => {
            const header = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#asset123',
                timestamp: Date.now(),
                type: 'Component Updated'
            }

            expect(libraryDataSource.subscribedEventTypeGuard?.(header)).toBe(false)
        })

        it('should not subscribe to events from other data sources', () => {
            const header = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#asset123',
                timestamp: Date.now(),
                type: 'Content Update'
            }

            expect(libraryDataSource.subscribedEventTypeGuard?.(header)).toBe(false)
        })
    })

    describe('Event Processing', () => {
        let mockStreamEvent: jest.Mock

        beforeEach(() => {
            mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        })

        describe('Zone Updated events', () => {
            it('should emit Asset Added when asset moves into Library', async () => {
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Zone Updated' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Personal',
                        toZone: 'Library'
                    })
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
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Zone Updated' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Personal'
                    })
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
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Zone Updated' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Canon',
                        toZone: 'Personal'
                    })
                }

                await libraryDataSource.receiveEvents?.({
                    events: [event],
                    streamEvent: mockStreamEvent
                })

                expect(mockStreamEvent).not.toHaveBeenCalled()
            })

            it('should ignore zone changes within Library', async () => {
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Zone Updated' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Library'
                    })
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
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Asset Cached' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Asset Cached' as const,
                        zone: 'Library'
                    })
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
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Asset Cached' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Asset Cached' as const,
                        zone: 'Personal'
                    })
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
                const event = {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test1',
                        timestamp: Date.now(),
                        type: 'Asset Removed' as const
                    },
                    getContentInternal: () => Promise.resolve({
                        type: 'Asset Removed' as const,
                        zone: 'Library'
                    })
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
                const events = [
                    {
                        header: {
                            dataSourceKey: 'mtw.assets' as const,
                            streamKey: 'ASSET#test1',
                            timestamp: Date.now(),
                            type: 'Zone Updated' as const
                        },
                        getContentInternal: () => Promise.resolve({
                            type: 'Zone Updated' as const,
                            fromZone: 'Canon',
                            toZone: 'Library'
                        })
                    },
                    {
                        header: {
                            dataSourceKey: 'mtw.assets' as const,
                            streamKey: 'ASSET#test2',
                            timestamp: Date.now(),
                            type: 'Asset Cached' as const
                        },
                        getContentInternal: () => Promise.resolve({
                            type: 'Asset Cached' as const,
                            zone: 'Library'
                        })
                    },
                    {
                        header: {
                            dataSourceKey: 'mtw.assets' as const,
                            streamKey: 'ASSET#test3',
                            timestamp: Date.now(),
                            type: 'Zone Updated' as const
                        },
                        getContentInternal: () => Promise.resolve({
                            type: 'Zone Updated' as const,
                            fromZone: 'Library',
                            toZone: 'Personal'
                        })
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

