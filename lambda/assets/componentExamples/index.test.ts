import { componentExamplesDataSource } from './index'
import { enrichExampleEvent } from './exampleEnrichment'
import { ComponentExamplesIncomingEvent } from './subscribedEvents'
import { StandardExample } from '@tonylb/mtw-wml/ts/standardize/components/example'

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

jest.mock('./exampleEnrichment', () => ({
    enrichExampleEvent: jest.fn(),
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

    describe('receiveEvents publishing', () => {
        const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

        beforeEach(() => {
            jest.clearAllMocks()
        })

        it('should ignore non-Example components even when events are subscribed', async () => {
            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset1',
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: {} as any,
                        } as any),
                },
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset2',
                        timestamp: 456,
                        type: 'Component Removed',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Removed',
                            component: {} as any,
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should publish ExampleUpdated for Example Component Updated events with enrichment', async () => {
            ;(enrichExampleEvent as jest.Mock).mockResolvedValue({
                exampleId: 'EXAMPLE#one',
                assetStack: ['ASSET#asset1'],
                parentIds: ['ROOM#one'],
                example: {
                    markState: { markValue: [] },
                    renderedContent: { description: [] },
                    provenance: { type: 'authored' },
                },
            })

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset1',
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: new StandardExample({
                                tag: 'Example',
                                universalKey: 'EXAMPLE#one',
                            } as any),
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(enrichExampleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    exampleId: 'EXAMPLE#one',
                    eventAssetId: 'ASSET#asset1',
                    eventType: 'Component Updated',
                })
            )

            const firstCall = (enrichExampleEvent as jest.Mock).mock.calls[0][0]
            expect(firstCall.component.toJSON()).toEqual({
                tag: 'Example',
                universalKey: 'EXAMPLE#one',
            })

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'EXAMPLE#one',
                update: {
                    type: 'ExampleUpdated',
                    exampleId: 'EXAMPLE#one',
                    parentIds: ['ROOM#one'],
                    assetStack: ['ASSET#asset1'],
                    example: {
                        markState: { markValue: [] },
                        renderedContent: { description: [] },
                        provenance: { type: 'authored' },
                    },
                },
                header: { type: 'ExampleUpdated' },
            })
        })

        it('should publish ExampleRemoved for Example Component Removed events with enrichment', async () => {
            ;(enrichExampleEvent as jest.Mock).mockResolvedValue({
                exampleId: 'EXAMPLE#one',
                assetStack: ['ASSET#asset1'],
                parentIds: ['ROOM#one'],
            })

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#asset1',
                        timestamp: 123,
                        type: 'Component Removed',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Removed',
                            component: new StandardExample({
                                tag: 'Example',
                                universalKey: 'EXAMPLE#one',
                            } as any),
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(enrichExampleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    exampleId: 'EXAMPLE#one',
                    eventAssetId: 'ASSET#asset1',
                    eventType: 'Component Removed',
                })
            )

            const firstCall = (enrichExampleEvent as jest.Mock).mock.calls[0][0]
            expect(firstCall.component.toJSON()).toEqual({
                tag: 'Example',
                universalKey: 'EXAMPLE#one',
            })

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'EXAMPLE#one',
                update: {
                    type: 'ExampleRemoved',
                    exampleId: 'EXAMPLE#one',
                    parentIds: ['ROOM#one'],
                    assetStack: ['ASSET#asset1'],
                },
                header: { type: 'ExampleRemoved' },
            })
        })
    })
})
