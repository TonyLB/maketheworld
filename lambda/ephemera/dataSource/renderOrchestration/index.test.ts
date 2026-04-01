import { renderOrchestrationDataSource } from './index'
import * as orchestrationHandler from '../../renderOrchestration/orchestrationHandler'

describe('mtw.ephemera.renderOrchestration DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('delegates Render Preview Requested ingress event to orchestrateRenderRequest', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Render Preview Requested',
                },
                getContent: () => Promise.resolve({
                    componentId: 'ROOM#one',
                    perspective: { assetStack: ['ASSET#one'] },
                    markState: { markValue: [] },
                }),
            },
        ]

        await renderOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(orchestrateSpy).toHaveBeenCalledTimes(1)
        expect(orchestrateSpy.mock.calls[0][0].payload).toMatchObject({
            type: 'RenderPreviewRequested',
            componentId: 'ROOM#one',
        })
        orchestrateSpy.mockRestore()
    })

    it('is non-replayable until replay semantics are defined (see AGENT.md graduation)', () => {
        expect(renderOrchestrationDataSource.replayable).toBe(false)
    })
})
