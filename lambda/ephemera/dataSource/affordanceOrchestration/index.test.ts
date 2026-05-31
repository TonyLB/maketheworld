import { affordanceOrchestrationDataSource } from './index'
import * as orchestrationHandler from './orchestrationHandler'

describe('mtw.ephemera.affordanceOrchestration DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('delegates Affordances Requested ingress event to orchestrateAffordanceRequest', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Affordances Requested',
                },
                getContent: () => Promise.resolve({
                    roomId: 'ROOM#one',
                    perspective: { assetStack: ['ASSET#one'] },
                    reason: 'roster',
                }),
            },
        ]

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(orchestrateSpy).toHaveBeenCalledTimes(1)
        expect(orchestrateSpy.mock.calls[0][0].payload).toMatchObject({
            type: 'AffordancesRequested',
            roomId: 'ROOM#one',
            reason: 'roster',
        })
        orchestrateSpy.mockRestore()
    })

    it('is non-replayable', () => {
        expect(affordanceOrchestrationDataSource.replayable).toBe(false)
    })
})
