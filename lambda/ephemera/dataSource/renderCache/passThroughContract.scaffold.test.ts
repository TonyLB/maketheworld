/**
 * Contract tests: renderCache subscribes to mtw.ephemera.renderOrchestration; hit outbounds should
 * refetch + emit Render Pertains; Render Generated should persist + emit per pass-through contract.
 * Importing ./index registers the DataSource once (ESM module cache; safe with index.test.ts).
 * Skipped its: Hit path / Generate path until those milestones (see AGENT.passThrough.planning.md).
 */
import './index'
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
    passThroughFixtureMinimalCacheId,
    passThroughFixtureRoomId,
    passThroughFixturePerspectiveKey,
} from '../passThroughContractFixtures'

describe('renderCache receives renderOrchestration stream', () => {
    beforeEach(() => {
        messageBus.clear()
    })

    it.skip(
        'Current Cache Valid leads to Render Pertains after refetch (IDs-only hit; lean routing) [until Hit path]',
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

    it.skip(
        'Exact Match Found leads to Render Pertains after refetch (lean routing) [until Hit path]',
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

    it.skip(
        'Render Generated leads to durable write then Render Pertains and/or Cache Updated (Cache-OI-1) [until Generate path]',
        async () => {
            const pertains: unknown[] = []
            const cacheUpdated: unknown[] = []
            messageBus.subscribe({
                tag: 'scaffold-render-pertains-gen',
                priority: 20,
                filter: (m: any) =>
                    m.type === 'StreamingEvent'
                    && m.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
                    && m.header?.type === 'Render Pertains',
                callback: async ({ payloads }) => {
                    for (const p of payloads) {
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
                        cacheUpdated.push(await p.getContent())
                    }
                },
            })

            sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughRenderGeneratedPayload())
            await messageBus.flush()

            expect(pertains.length + cacheUpdated.length).toBeGreaterThan(0)
            if (pertains.length > 0) {
                expect(pertains[0]).toMatchObject({
                    componentId: passThroughFixtureRoomId,
                    perspectiveKey: passThroughFixturePerspectiveKey,
                    cacheId: passThroughFixtureMinimalCacheId,
                })
            }
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
