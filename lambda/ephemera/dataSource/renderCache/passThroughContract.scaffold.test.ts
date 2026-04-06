/**
 * Skipped contract tests: when renderCache subscribes to mtw.ephemera.renderOrchestration,
 * handlers should refetch on hit outbounds, persist on Render Generated, and emit
 * Render Pertains / Cache Updated per pass-through contract.
 * Do not top-level import ./index here (avoids duplicate DataSource subscribe side effects).
 * Un-skip with Subscribe + handlers (phase C).
 */
import messageBus from '../../messageBus'
import { sendRenderOrchestrationPublish } from '../renderOrchestration/publishedEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY } from './baseClasses'
import {
    makePassThroughCurrentCacheValidPayload,
    makePassThroughExactMatchFoundPayload,
    makePassThroughRenderGeneratedPayload,
    passThroughFixtureMinimalCacheId,
    passThroughFixtureRoomId,
    passThroughFixturePerspectiveKey,
} from '../passThroughContractFixtures'

describe.skip('renderCache receives renderOrchestration stream (until subscription + handlers)', () => {
    beforeEach(() => {
        messageBus.clear()
    })

    it('Current Cache Valid leads to Render Pertains after refetch (IDs-only hit; lean routing)', async () => {
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
    })

    it('Exact Match Found leads to Render Pertains after refetch (lean routing)', async () => {
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
    })

    it('Render Generated leads to durable write then Render Pertains and/or Cache Updated (Cache-OI-1)', async () => {
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
    })

    it.todo('Generation Started: no-op or limited cache updates (Cache-OI-2)')
    it.todo('Orchestration Error: no Render Pertains from cache')
    it.todo('Generation Deferred: no-op for cache rows; pointer clearing is currentCachePointers')
})
