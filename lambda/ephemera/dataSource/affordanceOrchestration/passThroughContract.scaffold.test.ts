/**
 * Contract tests: orchestration emits mtw.ephemera.affordanceOrchestration StreamingEvents.
 * v1-active outbounds: Slice Ready, Orchestration Error (emission tests skipped until handler wires streamEvent).
 * Enrichment outbounds: skipped until LLM enrichment path.
 */
import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import { orchestrateAffordanceRequest } from './orchestrationHandler'
import type { AffordancesRequested } from './localApiEvents'
import {
    AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
    streamEventFromMessageBus,
} from './publishedEvents'

const makeBus = (): MessageBusType & { send: jest.Mock; flush: jest.Mock } => (
    {
        send: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageBusType & { send: jest.Mock; flush: jest.Mock }
)

const findOrchestrationStreamingEvent = (send: jest.Mock): { getContent: () => Promise<unknown> } | undefined => {
    for (const call of send.mock.calls) {
        const msg = call[0] as { type?: string; dataSourceKey?: string; getContent?: () => Promise<unknown> }
        if (msg?.type === 'StreamingEvent' && msg?.dataSourceKey === AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY && msg.getContent) {
            return msg as { getContent: () => Promise<unknown> }
        }
    }
    return undefined
}

const basePayload: AffordancesRequested = {
    type: 'AffordancesRequested',
    roomId: 'ROOM#one',
    perspective: { assetStack: ['ASSET#base'] },
    reason: 'topology',
}

describe.skip('affordanceOrchestration stream outcomes (enrichment outbounds; until LLM enrichment path)', () => {
    it('slow path emits Enrichment Started on mtw.ephemera.affordanceOrchestration', async () => {
        // until generateAffordanceEnrichment lands
    })

    it('enrichment success emits Enrichment Complete on mtw.ephemera.affordanceOrchestration', async () => {
        // enrichmentId shape TBD
    })

    it('defer when enrichment not run emits Enrichment Deferred on mtw.ephemera.affordanceOrchestration', async () => {
        // policy mirror Generation Deferred
    })
})

describe.skip('affordanceOrchestration stream outcomes (v1 emission; until affordanceCache subscribes)', () => {
    it('success path emits Slice Ready on mtw.ephemera.affordanceOrchestration', async () => {
        const messageBus = makeBus()
        await orchestrateAffordanceRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
        )
        const evt = findOrchestrationStreamingEvent(messageBus.send)
        expect(evt).toBeDefined()
        const content = await evt!.getContent()
        expect(content).toMatchObject({ type: 'Slice Ready', roomId: 'ROOM#one' })
    })

    it('intake failure emits Orchestration Error on mtw.ephemera.affordanceOrchestration', async () => {
        const messageBus = makeBus()
        await orchestrateAffordanceRequest(
            { payload: basePayload, messageBus, streamEvent: streamEventFromMessageBus(messageBus) },
        )
        const evt = findOrchestrationStreamingEvent(messageBus.send)
        expect(evt).toBeDefined()
        const content = await evt!.getContent()
        expect(content).toMatchObject({ type: 'Orchestration Error' })
    })
})
