import {
    AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
    isAffordanceOrchestrationOrchestrationErrorPayload,
    isAffordanceOrchestrationPublishedPayload,
    isAffordanceOrchestrationPublishedStreamEnvelope,
    isAffordanceOrchestrationSliceReadyPayload,
    publishAffordanceOrchestrationStreamEvent,
    sendAffordanceOrchestrationPublish,
    streamEventFromMessageBus,
    type AffordanceOrchestrationPublishedPayload,
} from './publishedEvents'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'

const routing = affordancePassThroughFixtureRouting

describe('publishedEvents guards (v1-active)', () => {
    it('accepts Slice Ready minimal payload', () => {
        const p = {
            type: 'Slice Ready' as const,
            ...routing,
        }
        expect(isAffordanceOrchestrationSliceReadyPayload(p)).toBe(true)
        expect(isAffordanceOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects Slice Ready when roomId is invalid', () => {
        const p = {
            type: 'Slice Ready' as const,
            ...routing,
            roomId: 'BAD',
        }
        expect(isAffordanceOrchestrationSliceReadyPayload(p)).toBe(false)
    })

    it('accepts Orchestration Error', () => {
        const p = {
            type: 'Orchestration Error' as const,
            ...routing,
            errorCode: 'INTAKE_FAILED',
            errorMessage: 'Invalid affordance request',
        }
        expect(isAffordanceOrchestrationOrchestrationErrorPayload(p)).toBe(true)
        expect(isAffordanceOrchestrationPublishedPayload(p)).toBe(true)
    })

    it('rejects aggregate for non-object', () => {
        expect(isAffordanceOrchestrationPublishedPayload(null)).toBe(false)
        expect(isAffordanceOrchestrationPublishedPayload(1)).toBe(false)
    })
})

describe.skip('publishedEvents guards (enrichment outbounds; until LLM enrichment path)', () => {
    it('accepts Enrichment Started with optional phase', () => {
        // phase: until generateAffordanceEnrichment lands
    })

    it('accepts Enrichment Complete with optional enrichmentId', () => {
        // enrichmentId shape TBD
    })

    it('accepts Enrichment Deferred with optional policy', () => {
        // policy: mirror Generation Deferred
    })
})

describe('isAffordanceOrchestrationPublishedStreamEnvelope', () => {
    it('accepts envelope with affordanceOrchestration dataSourceKey and known header.type', () => {
        const content: AffordanceOrchestrationPublishedPayload = {
            type: 'Slice Ready',
            ...routing,
        }
        const envelope = {
            header: {
                dataSourceKey: AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Slice Ready',
            },
            getContent: () => Promise.resolve(content),
        }
        expect(isAffordanceOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(true)
    })

    it('rejects wrong dataSourceKey', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera',
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Slice Ready',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isAffordanceOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(false)
    })

    it('rejects unknown header.type for orchestration stream', () => {
        const envelope = {
            header: {
                dataSourceKey: AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
                streamKey: passThroughFixtureRoomId,
                timestamp: Date.now(),
                type: 'Unknown Event',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isAffordanceOrchestrationPublishedStreamEnvelope(envelope as any)).toBe(false)
    })
})

describe('sendAffordanceOrchestrationPublish', () => {
    it('sends StreamingEvent with header.type matching payload.type', () => {
        const bus = { send: jest.fn() }
        const content: AffordanceOrchestrationPublishedPayload = {
            type: 'Slice Ready',
            ...routing,
        }
        sendAffordanceOrchestrationPublish(bus, passThroughFixtureRoomId, content)
        expect(bus.send).toHaveBeenCalledTimes(1)
        const arg = bus.send.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe('mtw.ephemera.affordanceOrchestration')
        expect(arg.header.type).toBe('Slice Ready')
        expect(arg.header.streamKey).toBe(passThroughFixtureRoomId)
        expect(bus.send.mock.calls[0].length).toBe(1)
    })

    it('passes non-empty laneId as second send argument', () => {
        const bus = { send: jest.fn() }
        const content: AffordanceOrchestrationPublishedPayload = {
            type: 'Orchestration Error',
            ...routing,
            errorCode: 'X',
            errorMessage: 'y',
        }
        sendAffordanceOrchestrationPublish(bus, passThroughFixtureRoomId, content, 'lane-x')
        expect(bus.send.mock.calls[0][1]).toBe('lane-x')
    })
})

describe('publishAffordanceOrchestrationStreamEvent', () => {
    it('invokes streamEvent with update, streamKey, and header.type', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const content: AffordanceOrchestrationPublishedPayload = {
            type: 'Slice Ready',
            ...routing,
        }
        await publishAffordanceOrchestrationStreamEvent(streamEvent, passThroughFixtureRoomId, content)
        expect(streamEvent).toHaveBeenCalledWith({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: 'Slice Ready' },
        })
    })
})

describe('streamEventFromMessageBus', () => {
    it('delegates to sendAffordanceOrchestrationPublish', async () => {
        const bus = { send: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content: AffordanceOrchestrationPublishedPayload = {
            type: 'Slice Ready',
            ...routing,
        }
        await streamEvent({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: content.type },
        })
        expect(bus.send).toHaveBeenCalledTimes(1)
        const arg = bus.send.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe('mtw.ephemera.affordanceOrchestration')
    })
})
