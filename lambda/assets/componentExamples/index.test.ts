import { componentExamplesDataSource } from './index'
import { ComponentExamplesIncomingEvent } from './subscribedEvents'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AuthoritativeComponentData } from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import internalCache from '../internalCache'

const mockAuthoritativeComponentData = (
    ComponentId: string,
    byAssets: { AssetId: string; component: unknown }[]
): AuthoritativeComponentData => ({
    ComponentId: ComponentId as EphemeraId,
    byAssets: byAssets.map(({ AssetId, component }) => ({
        AssetId: AssetId as AssetUUID,
        component: component as StandardComponent,
    })),
})

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
    AssetData: { get: jest.fn() },
}))

jest.mock('./loadAuthoritativeForMirroring', () => ({
    loadAuthoritativeForMirroring: jest.fn(),
    loadAuthoritativeBatchForMirroring: jest.fn(),
    deriveMirroringParticipationOrder: jest.fn(),
}))

import {
    loadAuthoritativeBatchForMirroring,
    loadAuthoritativeForMirroring,
} from './loadAuthoritativeForMirroring'

const mockLoadAuthoritativeForMirroring = jest.mocked(loadAuthoritativeForMirroring)
const mockLoadAuthoritativeBatchForMirroring = jest.mocked(loadAuthoritativeBatchForMirroring)

describe('ComponentExamplesDataSource (mtw.assets.componentExamples)', () => {
    const mockInternalCache = internalCache as unknown as {
        AssetMetaData: { get: jest.Mock };
        AssetData: { get: jest.Mock };
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

            const roomComponentData = mockAuthoritativeComponentData(roomId, [
                { AssetId: 'ASSET#room1', component: room },
            ])
            const lensComponentData = mockAuthoritativeComponentData(lensId, [
                { AssetId: 'ASSET#lens1', component: lens },
            ])
            const situationComponentData = mockAuthoritativeComponentData(situationId, [
                { AssetId: 'ASSET#situation1', component: situation },
            ])

            mockLoadAuthoritativeForMirroring
                .mockResolvedValueOnce(roomComponentData)
                .mockResolvedValueOnce(lensComponentData)
            mockLoadAuthoritativeBatchForMirroring.mockResolvedValueOnce([situationComponentData])

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

            const featureComponentData = mockAuthoritativeComponentData(featureId, [
                { AssetId: 'ASSET#feat1', component: feature },
            ])
            const situationComponentData = mockAuthoritativeComponentData(situationId, [
                { AssetId: 'ASSET#situation1', component: situation },
            ])

            mockLoadAuthoritativeForMirroring.mockResolvedValueOnce(featureComponentData)
            mockLoadAuthoritativeBatchForMirroring.mockResolvedValueOnce([situationComponentData])

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

            expect(mockLoadAuthoritativeForMirroring).toHaveBeenCalledTimes(1)
            expect(mockLoadAuthoritativeBatchForMirroring).toHaveBeenCalledTimes(1)
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

            mockLoadAuthoritativeForMirroring.mockResolvedValueOnce(
                mockAuthoritativeComponentData(featureId, [
                    { AssetId: 'ASSET#feat1', component: feature },
                ])
            )

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

            const knowledgeComponentData = mockAuthoritativeComponentData(knowledgeId, [
                { AssetId: 'ASSET#know1', component: knowledge },
            ])

            mockLoadAuthoritativeForMirroring.mockResolvedValueOnce(knowledgeComponentData)
            mockLoadAuthoritativeBatchForMirroring.mockResolvedValueOnce([
                mockAuthoritativeComponentData(situationId1, []),
                mockAuthoritativeComponentData(situationId2, []),
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

        it('publishes ExampleUpdated per parent when Situation is updated and facets reference it', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const situationId = 'SITUATION#DEFAULT' as const
            const featureId = 'FEATURE#one' as const
            const knowledgeId = 'KNOWLEDGE#one' as const
            const eventAssetId = 'ASSET#asset1' as const

            const situation = new StandardSituation(deIndentWML(`
                <Situation uuid=(DEFAULT)>
                    <Mark key=(m1) uuid=(MARK#m1)><Match>on</Match></Mark>
                </Situation>
            `))

            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(feat) uuid=(FEATURE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Feature prose</DisplayName></Situation>
                </Feature>
            `))

            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(know) uuid=(KNOWLEDGE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Knowledge prose</DisplayName></Situation>
                </Knowledge>
            `))

            const standardForm = new StandardForm([
                { tag: 'Asset', key: 'asset1', universalKey: eventAssetId } as any,
                situation.toJSON() as any,
                feature.toJSON() as any,
                knowledge.toJSON() as any,
            ])

            const situationComponentData = mockAuthoritativeComponentData(situationId, [
                { AssetId: eventAssetId, component: situation },
            ])
            const featureComponentData = mockAuthoritativeComponentData(featureId, [
                { AssetId: eventAssetId, component: feature },
            ])
            const knowledgeComponentData = mockAuthoritativeComponentData(knowledgeId, [
                { AssetId: eventAssetId, component: knowledge },
            ])

            mockLoadAuthoritativeForMirroring.mockResolvedValueOnce(situationComponentData)
            mockLoadAuthoritativeBatchForMirroring.mockResolvedValueOnce([
                featureComponentData,
                knowledgeComponentData,
            ])

            mockInternalCache.AssetData.get.mockResolvedValue([
                {
                    AssetId: eventAssetId,
                    standardForm,
                },
            ])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: eventAssetId,
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

            expect(mockInternalCache.AssetData.get).toHaveBeenCalled()
            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#DEFAULT',
                update: expect.objectContaining({
                    type: 'ExampleUpdated',
                    exampleId: 'SITUATION#DEFAULT',
                    parentIds: ['FEATURE#one'],
                    example: expect.objectContaining({
                        renderedContent: expect.objectContaining({
                            displayName: ['Feature prose'],
                        }),
                    }),
                }),
                header: { type: 'ExampleUpdated' },
            })
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'SITUATION#DEFAULT',
                update: expect.objectContaining({
                    type: 'ExampleUpdated',
                    exampleId: 'SITUATION#DEFAULT',
                    parentIds: ['KNOWLEDGE#one'],
                    example: expect.objectContaining({
                        renderedContent: expect.objectContaining({
                            displayName: ['Knowledge prose'],
                        }),
                    }),
                }),
                header: { type: 'ExampleUpdated' },
            })
        })

        it('does not publish when Situation update has no facet parents', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStreamEnvelope = jest.fn().mockResolvedValue(undefined)

            const situationId = 'SITUATION#orphan' as const
            const eventAssetId = 'ASSET#asset1' as const

            const situation = new StandardSituation({
                tag: 'Situation',
                universalKey: situationId,
                key: 'orphan',
            } as any)

            const standardForm = new StandardForm([
                { tag: 'Asset', key: 'asset1', universalKey: eventAssetId } as any,
                situation.toJSON() as any,
            ])

            mockLoadAuthoritativeForMirroring.mockResolvedValueOnce(
                mockAuthoritativeComponentData(situationId, [
                    { AssetId: eventAssetId, component: situation },
                ])
            )

            mockInternalCache.AssetData.get.mockResolvedValue([
                {
                    AssetId: eventAssetId,
                    standardForm,
                },
            ])

            const events: ComponentExamplesIncomingEvent[] = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets',
                        streamKey: eventAssetId,
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

            expect(mockStreamEvent).not.toHaveBeenCalled()
        })
    })
})
