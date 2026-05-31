/**
 * Contract tests: orchestration emits mtw.ephemera.affordanceOrchestration StreamingEvents.
 * v1-active outbounds: Slice Ready, Orchestration Error.
 * Enrichment outbounds: skipped until LLM enrichment path.
 */
jest.mock('../affordanceCache/catalogRow')
jest.mock('../affordanceCache/ensureAffordanceTopology')

import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import { orchestrateAffordanceRequest } from './orchestrationHandler'
import { getAffordanceRow } from '../affordanceCache/catalogRow'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'
import type { AffordancesRequested } from './localApiEvents'
import {
    AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
    streamEventFromMessageBus,
} from './publishedEvents'

const getAffordanceRowMock = getAffordanceRow as jest.MockedFunction<typeof getAffordanceRow>
const ensureTopologyMock = ensureAffordanceTopology as jest.MockedFunction<typeof ensureAffordanceTopology>

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

describe('affordanceOrchestration stream outcomes (v1 emission)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ensureTopologyMock.mockResolvedValue(undefined)
        getAffordanceRowMock.mockResolvedValue({
            EphemeraId: 'ROOM#one',
            DataCategory: 'Affordance::PERSPECTIVE#v1#a',
            assetStack: ['ASSET#base'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: { roomUniversalKey: 'ROOM#one', exits: [] },
        })
    })

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
        ensureTopologyMock.mockRejectedValue(new Error('hydrate failed'))
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
