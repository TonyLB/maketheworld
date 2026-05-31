import type { MessageBus } from '../../messageBus/baseClasses'
import { orchestrateAffordanceRequest } from './orchestrationHandler'
import type { AffordancesRequested } from './localApiEvents'

describe('orchestrateAffordanceRequest (scaffold)', () => {
    const basePayload: AffordancesRequested = {
        type: 'AffordancesRequested',
        roomId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
        reason: 'topology',
    }

    it('resolves without publishing stream events (stub)', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const messageBus = {
            send: jest.fn(),
            flush: jest.fn().mockResolvedValue(undefined),
        } as unknown as MessageBus

        await orchestrateAffordanceRequest({
            payload: basePayload,
            messageBus,
            streamEvent,
        })

        expect(streamEvent).not.toHaveBeenCalled()
    })
})
