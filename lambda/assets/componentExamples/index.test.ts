import { componentExamplesDataSource } from './index'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: { send: jest.fn() },
}))

jest.mock('../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() },
}))

jest.mock('../messageBus', () => ({
    default: {
        send: jest.fn(),
        subscribe: jest.fn(),
    },
    send: jest.fn(),
    subscribe: jest.fn(),
}))

jest.mock('../internalCache', () => ({
    AssetMetaData: { get: jest.fn() },
}))

describe('ComponentExamplesDataSource (mtw.assets.componentExamples)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Constructor', () => {
        it('should create instance with correct configuration', () => {
            expect(componentExamplesDataSource.dataSourceKey).toBe('mtw.assets.componentExamples')
            expect(componentExamplesDataSource.replayable).toBe(false)
            expect(componentExamplesDataSource.primaryKeyName).toBe('AssetId')
        })

        it('should not have event serializer (stub does not publish)', () => {
            expect(componentExamplesDataSource.eventSerializer).toBeUndefined()
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to Component Updated events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Updated',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(componentExamplesDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
        })

        it('should subscribe to Component Removed events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Removed',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(componentExamplesDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
        })

        it('should not subscribe to events from other data sources', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Content Update',
                },
                getContent: () => Promise.resolve({}),
            }
            expect(componentExamplesDataSource.subscribedEventTypeGuard?.(envelope)).toBe(false)
        })
    })

    describe('receiveEvents (stub)', () => {
        it('should complete without throwing when given Component Updated/Removed events', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#asset1',
                        timestamp: 123,
                        type: 'Component Updated' as const,
                    },
                    getContent: () => Promise.resolve({ component: {} }),
                },
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#asset2',
                        timestamp: 456,
                        type: 'Component Removed' as const,
                    },
                    getContent: () => Promise.resolve({ component: {} }),
                },
            ]
            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })
            expect(mockStreamEvent).not.toHaveBeenCalled()
            expect(mockStreamEnvelope).not.toHaveBeenCalled()
        })
    })
})
