import {
    isRenderOrchestrationCurrentCacheValidPayload,
    isRenderOrchestrationExactMatchFoundPayload,
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
    isRenderOrchestrationPublishedPayload,
    isRenderOrchestrationPublishedStreamEnvelope,
    isRenderOrchestrationRenderGeneratedPayload,
    publishRenderOrchestrationStreamEvent,
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    sendRenderOrchestrationPublish,
    streamEventFromMessageBus,
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

describe('isRenderOrchestrationPublishedStreamEnvelope', () => {
    it('accepts envelope with renderOrchestration dataSourceKey and known header.type', () => {
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Current Cache Valid',
            ...routing,
            cacheId: minimalCacheId,
        }
        const envelope = {
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Current Cache Valid',
            },
            getContent: () => Promise.resolve(content),
        }
        expect(isRenderOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(true)
    })

    it('rejects wrong dataSourceKey', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera',
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Current Cache Valid',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isRenderOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(false)
    })

    it('rejects unknown header.type for orchestration stream', () => {
        const envelope = {
            header: {
                dataSourceKey: RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Unknown Event',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isRenderOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(false)
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
        expect(bus.send.mock.calls[0].length).toBe(1)
    })

    it('passes non-empty laneId as second send argument', () => {
        const bus = { send: jest.fn() }
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Generation Started',
            ...routing,
            phase: 'generating',
        }
        sendRenderOrchestrationPublish(bus, passThroughFixtureRoomId, content, 'lane-x')
        expect(bus.send.mock.calls[0][1]).toBe('lane-x')
    })
})

describe('publishRenderOrchestrationStreamEvent', () => {
    it('invokes streamEvent with update, streamKey, and header.type', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Exact Match Found',
            ...routing,
            cacheId: minimalCacheId,
        }
        await publishRenderOrchestrationStreamEvent(streamEvent, passThroughFixtureRoomId, content)
        expect(streamEvent).toHaveBeenCalledWith({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: 'Exact Match Found' },
        })
    })

    it('forwards laneId option to streamEvent when set', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Exact Match Found',
            ...routing,
            cacheId: minimalCacheId,
        }
        await publishRenderOrchestrationStreamEvent(streamEvent, passThroughFixtureRoomId, content, { laneId: '' })
        expect(streamEvent).toHaveBeenCalledWith({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: 'Exact Match Found' },
            laneId: '',
        })
    })
})

describe('streamEventFromMessageBus', () => {
    it('delegates to sendRenderOrchestrationPublish', async () => {
        const bus = { send: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Current Cache Valid',
            ...routing,
            cacheId: minimalCacheId,
        }
        await streamEvent({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: content.type },
        })
        expect(bus.send).toHaveBeenCalledTimes(1)
        const arg = bus.send.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe('mtw.ephemera.renderOrchestration')
    })

    it('forwards params.laneId to send', async () => {
        const bus = { send: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content: RenderOrchestrationPublishedPayload = {
            type: 'Current Cache Valid',
            ...routing,
            cacheId: minimalCacheId,
        }
        await streamEvent({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: content.type },
            laneId: 'z-lane',
        })
        expect(bus.send.mock.calls[0][1]).toBe('z-lane')
    })
})
