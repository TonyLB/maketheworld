import { componentExamplesDataSource } from './index'
import { enrichExampleEvent } from './exampleEnrichment'
import { ComponentExamplesIncomingEvent } from './subscribedEvents'
import { StandardExample } from '@tonylb/mtw-wml/ts/standardize/components/example'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import internalCache from '../internalCache'

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
    ComponentData: { get: jest.fn() },
}))

jest.mock('./exampleEnrichment', () => {
    const actual = jest.requireActual('./exampleEnrichment')
    return {
        __esModule: true,
        ...actual,
        enrichExampleEvent: jest.fn(),
    }
})

describe('ComponentExamplesDataSource (mtw.assets.componentExamples)', () => {
    const mockInternalCache = internalCache as unknown as {
        AssetMetaData: { get: jest.Mock };
        ComponentData: { get: jest.Mock };
    }

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

        it('should subscribe to Component Republished events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Republished',
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
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#asset1'], forbiddenAssetIds: [] },
                    example: {
                        markState: { markValue: [] },
                        renderedContent: { description: [] },
                        provenance: { type: 'authored' },
                    },
                },
                header: { type: 'ExampleUpdated' },
            })
        })

        it('should publish ExampleUpdated for Example Component Republished events with enrichment', async () => {
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
                        type: 'Component Republished',
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
            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'EXAMPLE#one',
                update: {
                    type: 'ExampleUpdated',
                    exampleId: 'EXAMPLE#one',
                    parentIds: ['ROOM#one'],
                    assetStack: ['ASSET#asset1'],
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#asset1'], forbiddenAssetIds: [] },
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
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#asset1'], forbiddenAssetIds: [] },
                },
                header: { type: 'ExampleRemoved' },
            })
        })

        it('publishes ExampleUpdated for Room updates by mirroring Situation facets', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const roomId = 'ROOM#one' as const
            const situationId = 'SITUATION#s1' as const
            const lensId = 'LENS#lens1' as const

            const room = new StandardRoom({
                tag: 'Room',
                universalKey: roomId,
                lens: [
                    { universalKey: lensId, key: 'roomLens', tag: 'Lens' } as any,
                ],
                situations: [
                    {
                        reference: { universalKey: situationId },
                        payload: {} as any,
                    } as any,
                ],
            } as any)

            const lens = new StandardLens(deIndentWML(`
                <Lens key=(illumination) uuid=(LENS#lens1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Default>lighted</Default>
                    </Mark>
                    <Mark key=(timeofday) uuid=(MARK#timeofday)>
                        <Default>Afternoon</Default>
                    </Mark>
                </Lens>
            `))

            const situation = new StandardSituation(deIndentWML(`
                <Situation key=(s1) uuid=(SITUATION#s1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Match>dim</Match>
                    </Mark>
                    <Mark key=(extraneous) uuid=(MARK#other)>
                        <Match>ignored</Match>
                    </Mark>
                </Situation>
            `))

            const roomComponentData = {
                ComponentId: roomId,
                byAssets: [
                    {
                        AssetId: 'ASSET#room1',
                        component: room as any,
                    },
                ],
            }
            const lensComponentData = {
                ComponentId: lensId,
                byAssets: [
                    {
                        AssetId: 'ASSET#lens1',
                        component: lens as any,
                    },
                ],
            }
            const situationComponentData = {
                ComponentId: situationId,
                byAssets: [
                    {
                        AssetId: 'ASSET#situation1',
                        component: situation as any,
                    },
                ],
            }

            mockInternalCache.ComponentData.get
                .mockResolvedValueOnce([roomComponentData])
                .mockResolvedValueOnce([lensComponentData])
                .mockResolvedValueOnce([situationComponentData])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#room1',
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: room as any,
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#s1',
                update: expect.objectContaining({
                    type: 'ExampleUpdated',
                    exampleId: 'SITUATION#s1',
                    parentIds: ['ROOM#one'],
                    assetStack: ['ASSET#room1'],
                }),
                header: { type: 'ExampleUpdated' },
            })
        })

        it('publishes ExampleUpdated for Feature updates by mirroring Situation facets', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const featureId = 'FEATURE#one' as const
            const situationId = 'SITUATION#DEFAULT' as const

            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(feat) uuid=(FEATURE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Feature prose</DisplayName></Situation>
                </Feature>
            `))

            const situation = new StandardSituation(deIndentWML(`
                <Situation uuid=(DEFAULT) />
            `))

            const featureComponentData = {
                ComponentId: featureId,
                byAssets: [
                    {
                        AssetId: 'ASSET#feat1',
                        component: feature as any,
                    },
                ],
            }
            const situationComponentData = {
                ComponentId: situationId,
                byAssets: [
                    {
                        AssetId: 'ASSET#situation1',
                        component: situation as any,
                    },
                ],
            }

            mockInternalCache.ComponentData.get
                .mockResolvedValueOnce([featureComponentData])
                .mockResolvedValueOnce([situationComponentData])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#feat1',
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: feature as any,
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(mockInternalCache.ComponentData.get).toHaveBeenCalledTimes(2)
            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#DEFAULT',
                update: expect.objectContaining({
                    type: 'ExampleUpdated',
                    exampleId: 'SITUATION#DEFAULT',
                    parentIds: ['FEATURE#one'],
                    assetStack: ['ASSET#feat1'],
                    example: expect.objectContaining({
                        renderedContent: expect.objectContaining({
                            displayName: ['Feature prose'],
                        }),
                    }),
                }),
                header: { type: 'ExampleUpdated' },
            })
        })

        it('does not publish when Feature has empty situations', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const featureId = 'FEATURE#empty' as const
            const feature = new StandardFeature({
                tag: 'Feature',
                universalKey: featureId,
                key: 'empty',
            } as any)

            mockInternalCache.ComponentData.get.mockResolvedValueOnce([
                {
                    ComponentId: featureId,
                    byAssets: [
                        {
                            AssetId: 'ASSET#feat1',
                            component: feature as any,
                        },
                    ],
                },
            ])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#feat1',
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: feature as any,
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

        it('publishes ExampleRemoved for Knowledge removal by mirroring Situation facets', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const knowledgeId = 'KNOWLEDGE#one' as const
            const situationId1 = 'SITUATION#s1' as const
            const situationId2 = 'SITUATION#s2' as const

            const knowledge = new StandardKnowledge({
                tag: 'Knowledge',
                universalKey: knowledgeId,
                key: 'know',
                situations: [
                    {
                        reference: { universalKey: situationId1 },
                        payload: {} as any,
                    } as any,
                    {
                        reference: { universalKey: situationId2 },
                        payload: {} as any,
                    } as any,
                ],
            } as any)

            const knowledgeComponentData = {
                ComponentId: knowledgeId,
                byAssets: [
                    {
                        AssetId: 'ASSET#know1',
                        component: knowledge as any,
                    },
                ],
            }

            mockInternalCache.ComponentData.get
                .mockResolvedValueOnce([knowledgeComponentData])
                .mockResolvedValueOnce([
                    { ComponentId: situationId1, byAssets: [] },
                    { ComponentId: situationId2, byAssets: [] },
                ])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: 'ASSET#know1',
                        timestamp: 123,
                        type: 'Component Removed',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Removed',
                            component: knowledge as any,
                        } as any),
                },
            ]

            await componentExamplesDataSource.receiveEvents?.({
                events,
                streamEvent: mockStreamEvent,
                streamEnvelope: mockStreamEnvelope,
            })

            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#s1',
                update: expect.objectContaining({
                    type: 'ExampleRemoved',
                    exampleId: 'SITUATION#s1',
                    parentIds: ['KNOWLEDGE#one'],
                    assetStack: ['ASSET#know1'],
                }),
                header: { type: 'ExampleRemoved' },
            })
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#s2',
                update: expect.objectContaining({
                    type: 'ExampleRemoved',
                    exampleId: 'SITUATION#s2',
                    parentIds: ['KNOWLEDGE#one'],
                    assetStack: ['ASSET#know1'],
                }),
                header: { type: 'ExampleRemoved' },
            })
        })
    })
})
