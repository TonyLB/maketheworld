import {
    isRenderOrchestrationCurrentCacheValidPayload,
    isRenderOrchestrationExactMatchFoundPayload,
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
    isRenderOrchestrationPublishedPayload,
    isRenderOrchestrationRenderGeneratedPayload,
    sendRenderOrchestrationPublish,
    type RenderOrchestrationPublishedPayload,
} from './publishedEvents'
import {
    passThroughFixtureMinimalCacheId,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixtureRoomId,
    passThroughFixtureRouting,
} from '../passThroughContractFixtures'

const routing = passThroughFixtureRouting
const minimalCacheId = passThroughFixtureMinimalCacheId
const minimalDynamoItem = passThroughFixtureMinimalDynamoItem

describe('publishedEvents guards', () => {
    it('accepts Current Cache Valid minimal payload', () => {
        const p = {
            type: 'Current Cache Valid' as const,
            ...routing,
            cacheId: minimalCacheId,
        }
        expect(isRenderOrchestrationCurrentCacheValidPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects Current Cache Valid when cacheId is not CACHE#', () => {
        const p = {
            type: 'Current Cache Valid' as const,
            ...routing,
            cacheId: 'BAD',
        }
        expect(isRenderOrchestrationCurrentCacheValidPayload(p)).toBe(false)
    })

    it('accepts Exact Match Found minimal payload', () => {
        const p = {
            type: 'Exact Match Found' as const,
            ...routing,
            cacheId: minimalCacheId,
        }
        expect(isRenderOrchestrationExactMatchFoundPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('accepts Generation Started with optional phase', () => {
        const p: RenderOrchestrationPublishedPayload = {
            type: 'Generation Started',
            ...routing,
            phase: 'generating',
        }
        expect(isRenderOrchestrationGenerationStartedPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects Generation Started when phase is invalid', () => {
        const p = {
            type: 'Generation Started' as const,
            ...routing,
            phase: 'other',
        }
        expect(isRenderOrchestrationGenerationStartedPayload(p)).toBe(false)
    })

    it('accepts Render Generated when cacheRecord matches cacheId', () => {
        const p = {
            type: 'Render Generated' as const,
            ...routing,
            cacheId: minimalCacheId,
            cacheRecord: minimalDynamoItem,
        }
        expect(isRenderOrchestrationRenderGeneratedPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects Render Generated when DataCategory does not match cacheId', () => {
        const p = {
            type: 'Render Generated' as const,
            ...routing,
            cacheId: minimalCacheId,
            cacheRecord: { ...minimalDynamoItem, DataCategory: 'CACHE#other' },
        }
        expect(isRenderOrchestrationRenderGeneratedPayload(p)).toBe(false)
    })

    it('accepts Orchestration Error', () => {
        const p = {
            type: 'Orchestration Error' as const,
            ...routing,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        }
        expect(isRenderOrchestrationOrchestrationErrorPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('accepts Generation Deferred with optional policy', () => {
        const p = {
            type: 'Generation Deferred' as const,
            ...routing,
            reason: 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN',
            policy: 'costCap',
        }
        expect(isRenderOrchestrationGenerationDeferredPayload(p)).toBe(true)
        expect(isRenderOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects aggregate for non-object', () => {
        expect(isRenderOrchestrationPublishedPayload(null)).toBe(false)
        expect(isRenderOrchestrationPublishedPayload(1)).toBe(false)
    })
})

describe('sendRenderOrchestrationPublish', () => {
    it('sends StreamingEvent with header.type matching payload.type', () => {
        const bus = { send: jest.fn() }
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Current Cache Valid',
            ...routing,
            cacheId: minimalCacheId,
        }
        sendRenderOrchestrationPublish(bus, passThroughFixtureRoomId, content)
        expect(bus.send).toHaveBeenCalledTimes(1)
        const arg = bus.send.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe('mtw.ephemera.renderOrchestration')
        expect(arg.header.type).toBe('Current Cache Valid')
        expect(arg.header.streamKey).toBe(passThroughFixtureRoomId)
    })
})
