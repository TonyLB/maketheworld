import { componentExamplesDataSource } from './index'
import { ComponentExamplesIncomingEvent } from './subscribedEvents'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

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

        it('should not subscribe to Component Republished events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#asset123',
                    timestamp: Date.now(),
                    type: 'Component Republished',
                },
                getContent: () => Promise.resolve({ component: {} }),
            }
            expect(componentExamplesDataSource.subscribedEventTypeGuard?.(envelope)).toBe(false)
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

        it('should ignore unrelated components when events are subscribed', async () => {
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

        it('publishes one component-scoped ExampleInvalidated for Room updates', async () => {
            const roomId = 'ROOM#one' as const
            const situationId = 'SITUATION#s1' as const
            const editAssetId = 'ASSET#room1' as const

            const room = new StandardRoom({
                tag: 'Room',
                universalKey: roomId,
                situations: [
                    {
                        reference: { universalKey: situationId },
                        payload: {} as any,
                    } as any,
                ],
            } as any)

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
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
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    componentIds: [roomId],
                    editAssetId,
                    affectedSituationIds: [situationId],
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes one component-scoped ExampleInvalidated for Feature updates', async () => {
            const featureId = 'FEATURE#one' as const
            const situationId = 'SITUATION#DEFAULT' as const
            const editAssetId = 'ASSET#feat1' as const

            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(feat) uuid=(FEATURE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Feature prose</DisplayName></Situation>
                </Feature>
            `))

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
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

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    componentIds: [featureId],
                    editAssetId,
                    affectedSituationIds: [situationId],
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes component-scoped ExampleInvalidated when Feature has empty situations', async () => {
            const featureId = 'FEATURE#empty' as const
            const editAssetId = 'ASSET#feat1' as const
            const feature = new StandardFeature({
                tag: 'Feature',
                universalKey: featureId,
                key: 'empty',
            } as any)

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
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

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    componentIds: [featureId],
                    editAssetId,
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes one component-scoped ExampleInvalidated for Knowledge removal', async () => {
            const knowledgeId = 'KNOWLEDGE#one' as const
            const situationId1 = 'SITUATION#s1' as const
            const situationId2 = 'SITUATION#s2' as const
            const editAssetId = 'ASSET#know1' as const

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

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
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

            expect(mockStreamEvent).toHaveBeenCalledTimes(1)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    componentIds: [knowledgeId],
                    editAssetId,
                    affectedSituationIds: [situationId1, situationId2],
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes one situation-scoped ExampleInvalidated when Situation is updated', async () => {
            const situationId = 'SITUATION#DEFAULT' as const
            const editAssetId = 'ASSET#asset1' as const

            const situation = new StandardSituation(deIndentWML(`
                <Situation uuid=(DEFAULT)>
                    <Mark key=(m1) uuid=(MARK#m1)><Match>on</Match></Mark>
                </Situation>
            `))

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: situation as any,
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
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    situationId,
                    editAssetId,
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes situation-scoped ExampleInvalidated when Situation has no facet parents', async () => {
            const situationId = 'SITUATION#orphan' as const
            const editAssetId = 'ASSET#asset1' as const

            const situation = new StandardSituation({
                tag: 'Situation',
                universalKey: situationId,
                key: 'orphan',
            } as any)

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
                        timestamp: 123,
                        type: 'Component Updated',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Updated',
                            component: situation as any,
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
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    situationId,
                    editAssetId,
                },
                header: { type: 'ExampleInvalidated' },
            })
        })

        it('publishes situation-scoped ExampleInvalidated with entityRemoved on Situation removal', async () => {
            const situationId = 'SITUATION#gone' as const
            const editAssetId = 'ASSET#asset1' as const

            const situation = new StandardSituation({
                tag: 'Situation',
                universalKey: situationId,
                key: 'gone',
            } as any)

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: editAssetId,
                        timestamp: 123,
                        type: 'Component Removed',
                    },
                    getContent: () =>
                        Promise.resolve({
                            type: 'Component Removed',
                            component: situation as any,
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
                streamKey: editAssetId,
                update: {
                    type: 'ExampleInvalidated',
                    situationId,
                    editAssetId,
                    entityRemoved: true,
                },
                header: { type: 'ExampleInvalidated' },
            })
        })
    })
})
