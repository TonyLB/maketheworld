import { sendPutCacheRecord } from '../apiEphemera'
import messageBus from '../../messageBus'
import {
    isComponentExamplesInvalidatedEnvelope,
    isDiagnosticsRenderCacheFindingEnvelope,
    isRenderCacheSubscribedEnvelope,
    isPutOrDeleteCacheCommandEnvelope,
} from './subscribedEvents'
import {
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    sendRenderOrchestrationPublish,
    type RenderOrchestrationPublishedPayload,
} from '../renderOrchestration/publishedEvents'
import {
    makePassThroughCurrentCacheValidPayload,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'

describe('renderCache subscribedEvents', () => {
    it('isRenderCacheSubscribedEnvelope accepts renderOrchestration outbound envelope', () => {
        const content: RenderOrchestrationPublishedPayload = makePassThroughCurrentCacheValidPayload()
        const envelope = {
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Current Cache Valid' as const,
            },
            getContent: () => Promise.resolve(content),
        }
        expect(isRenderCacheSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('isRenderCacheSubscribedEnvelope accepts api.ephemera Put Cache Record envelope', async () => {
        messageBus.clear()
        let captured: any
        messageBus.subscribe({
            tag: 'capture-put',
            priority: 1,
            filter: (m: any) => m.type === 'StreamingEvent' && m.dataSourceKey === 'api.ephemera',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    captured = {
                        header: {
                            dataSourceKey: p.dataSourceKey,
                            streamKey: p.streamKey,
                            timestamp: p.timestamp,
                            type: p.header?.type,
                        },
                        getContent: p.getContent,
                    }
                }
            },
        })
        sendPutCacheRecord(messageBus, 'ROOM#room-one', {
            componentId: 'ROOM#room-one' as const,
            record: {
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' as const },
                perspectiveId: 'PERSPECTIVE#v1#abc',
                perspectiveMatcher: { requiredAssetIds: ['ASSET#one'] as `ASSET#${string}`[], forbiddenAssetIds: [] },
            },
        })
        await messageBus.flushAndSettle()
        expect(captured).toBeDefined()
        expect(isPutOrDeleteCacheCommandEnvelope(captured)).toBe(true)
        expect(isRenderCacheSubscribedEnvelope(captured)).toBe(true)
    })

    it('isRenderCacheSubscribedEnvelope rejects unrelated streaming envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#x',
                timestamp: Date.now(),
                type: 'Component Updated',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isRenderCacheSubscribedEnvelope(envelope as any)).toBe(false)
    })

    it('isComponentExamplesInvalidatedEnvelope accepts ExampleInvalidated from mtw.assets.componentExamples', async () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.assets.componentExamples',
                streamKey: 'ASSET#canon',
                timestamp: Date.now(),
                type: 'ExampleInvalidated' as const,
            },
            getContent: () => Promise.resolve({
                type: 'ExampleInvalidated' as const,
                componentIds: ['ROOM#hall'],
                editAssetId: 'ASSET#canon',
            }),
        }
        expect(isComponentExamplesInvalidatedEnvelope(envelope as any)).toBe(true)
        expect(isRenderCacheSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('isDiagnosticsRenderCacheFindingEnvelope accepts Ephemera RenderCache Finding', async () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Ephemera RenderCache Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Ephemera RenderCache Finding' as const,
                targetCatalogs: [
                    { ephemeraId: 'ROOM#a', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                ],
                status: 'corrupted' as const,
                diagnosticRunId: 'run-1',
                timestamp: '2025-01-01T00:00:00.000Z',
            }),
        }
        expect(isDiagnosticsRenderCacheFindingEnvelope(envelope as any)).toBe(true)
        expect(isRenderCacheSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('sendRenderOrchestrationPublish produces envelopes accepted by isRenderCacheSubscribedEnvelope', async () => {
        messageBus.clear()
        let captured: any
        messageBus.subscribe({
            tag: 'capture-orch',
            priority: 1,
            filter: (m: any) =>
                m.type === 'StreamingEvent' && m.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    captured = {
                        header: {
                            dataSourceKey: p.dataSourceKey,
                            streamKey: p.streamKey,
                            timestamp: p.timestamp,
                            type: p.header?.type,
                        },
                        getContent: p.getContent,
                    }
                }
            },
        })
        sendRenderOrchestrationPublish(messageBus, passThroughFixtureRoomId, makePassThroughCurrentCacheValidPayload())
        await messageBus.flushAndSettle()
        expect(captured).toBeDefined()
        expect(isRenderCacheSubscribedEnvelope(captured)).toBe(true)
    })
})
