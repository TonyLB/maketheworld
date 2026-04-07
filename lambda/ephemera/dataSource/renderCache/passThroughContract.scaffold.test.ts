/**
 * Contract tests: renderCache subscribes to mtw.ephemera.renderOrchestration; hit outbounds should
 * refetch + emit Render Pertains; Render Generated should persist + emit per pass-through contract.
 * Importing ./index registers the DataSource once (ESM module cache; safe with index.test.ts).
 * Hit-path tests spy internalCache.RenderCache.get to supply a refetched row (avoids Dynamo).
 * Generate path mocks putCacheRecord to avoid Dynamo.
 */
jest.mock('./putCacheRecord', () => ({
    __esModule: true,
    putCacheRecord: jest.fn(),
}))

import './index'
import { putCacheRecord } from './putCacheRecord'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { sendRenderOrchestrationPublish } from '../renderOrchestration/publishedEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY } from './baseClasses'
import {
    makePassThroughCurrentCacheValidPayload,
    makePassThroughExactMatchFoundPayload,
    makePassThroughGenerationDeferredPayload,
    makePassThroughGenerationStartedPayload,
    makePassThroughOrchestrationErrorPayload,
    makePassThroughRenderGeneratedPayload,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixtureMinimalCacheId,
    passThroughFixtureRoomId,
    passThroughFixturePerspectiveKey,
} from '../passThroughContractFixtures'

const mockedPutCacheRecord = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>

describe('renderCache receives renderOrchestration stream', () => {
    beforeEach(() => {
        messageBus.clear()
        internalCache.RenderCache.clear()
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([passThroughFixtureMinimalDynamoItem])
        mockedPutCacheRecord.mockReset()
        mockedPutCacheRecord.mockResolvedValue(passThroughFixtureMinimalCacheId)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it(
        'Current Cache Valid leads to Render Pertains after refetch (IDs-only hit; lean routing)',
        async () => {
            const received: unknown[] = []
            messageBus.subscribe({
                tag: 'scaffold-render-pertains-ccv',
                priority: 20,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Render Pertains',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
                        received.push(await p.getContent())
                    }
                },
            })

            sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughCurrentCacheValidPayload())
            await messageBus.flush()

            expect(received).toHaveLength(1)
            expect(received[0]).toMatchObject({
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
            })
            expect((received[0] as { conversationId?: string }).conversationId).toBeUndefined()
        }
    )

    it(
        'Exact Match Found leads to Render Pertains after refetch (lean routing)',
        async () => {
            const received: unknown[] = []
            messageBus.subscribe({
                tag: 'scaffold-render-pertains-emf',
                priority: 20,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Render Pertains',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
                        received.push(await p.getContent())
                    }
                },
            })

            sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughExactMatchFoundPayload())
            await messageBus.flush()

            expect(received).toHaveLength(1)
            expect(received[0]).toMatchObject({
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
            })
        }
    )

    it(
        'Render Generated leads to durable write then Render Pertains then Cache Updated (Cache-OI-1)',
        async () => {
            const pertains: unknown[] = []
            const cacheUpdated: unknown[] = []
            const streamOrder: string[] = []
            messageBus.subscribe({
                tag: 'scaffold-render-pertains-gen',
                priority: 20,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Render Pertains',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
                        streamOrder.push('Render Pertains')
                        pertains.push(await p.getContent())
                    }
                },
            })
            messageBus.subscribe({
                tag: 'scaffold-cache-updated-gen',
                priority: 21,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Cache Updated',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
                        streamOrder.push('Cache Updated')
                        cacheUpdated.push(await p.getContent())
                    }
                },
            })

            const payload = makePassThroughRenderGeneratedPayload()
            sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, payload)
            await messageBus.flush()

            expect(mockedPutCacheRecord).toHaveBeenCalledTimes(1)
            expect(mockedPutCacheRecord).toHaveBeenCalledWith(
                passThroughFixtureRoomId,
                expect.objectContaining({
                    markState: passThroughFixtureMinimalDynamoItem.markState,
                    renderedContent: passThroughFixtureMinimalDynamoItem.renderedContent,
                    provenance: passThroughFixtureMinimalDynamoItem.provenance,
                    perspectiveId: passThroughFixtureMinimalDynamoItem.perspectiveId,
                    perspectiveMatcher: passThroughFixtureMinimalDynamoItem.perspectiveMatcher,
                }),
                passThroughFixtureMinimalCacheId
            )
            expect(pertains).toHaveLength(1)
            expect(cacheUpdated).toHaveLength(1)
            expect(streamOrder).toEqual(['Render Pertains', 'Cache Updated'])
            expect(pertains[0]).toMatchObject({
                componentId: passThroughFixtureRoomId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
            })
            expect(cacheUpdated[0]).toMatchObject({
                type: 'Cache Updated',
                componentId: passThroughFixtureRoomId,
                dataCategory: passThroughFixtureMinimalCacheId,
                perspectiveId: passThroughFixtureMinimalDynamoItem.perspectiveId,
            })
        }
    )

    it('Orchestration Error does not emit Render Pertains or Cache Updated from renderCache', async () => {
        const readiness: unknown[] = []
        messageBus.subscribe({
            tag: 'scaffold-error-no-readiness',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && (m.header?.type === 'Render Pertains' || m.header?.type === 'Cache Updated'),
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    readiness.push(await p.getContent())
                }
            },
        })

        sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughOrchestrationErrorPayload())
        await messageBus.flush()

        expect(readiness).toHaveLength(0)
    })

    it('Generation Deferred does not emit Render Pertains or Cache Updated from renderCache', async () => {
        const readiness: unknown[] = []
        messageBus.subscribe({
            tag: 'scaffold-deferred-no-readiness',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && (m.header?.type === 'Render Pertains' || m.header?.type === 'Cache Updated'),
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    readiness.push(await p.getContent())
                }
            },
        })

        sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughGenerationDeferredPayload())
        await messageBus.flush()

        expect(readiness).toHaveLength(0)
    })

    it('Generation Started does not emit Render Pertains or Cache Updated from renderCache (Cache-OI-2)', async () => {
        const readiness: unknown[] = []
        messageBus.subscribe({
            tag: 'scaffold-started-no-readiness',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                && (m.header?.type === 'Render Pertains' || m.header?.type === 'Cache Updated'),
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    readiness.push(await p.getContent())
                }
            },
        })

        sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughGenerationStartedPayload())
        await messageBus.flush()

        expect(readiness).toHaveLength(0)
    })
})
