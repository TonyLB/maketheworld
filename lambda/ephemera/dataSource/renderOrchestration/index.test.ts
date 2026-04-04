import { renderOrchestrationDataSource } from './index'
import * as orchestrationHandler from './orchestrationHandler'
import * as fanOutStateChanged from './fanOutStateChangedToPassiveRenders'

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

    it('delegates mtw.ephemera.state State Changed to fanOutStateChangedToPassiveRenders', async () => {
        const fanOutSpy = jest.spyOn(fanOutStateChanged, 'fanOutStateChangedToPassiveRenders').mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const payload = {
            type: 'State Changed' as const,
            componentId: 'ROOM#sc',
            incomingMarkState: { markValue: [{ mark: 'M', value: 'v' }] },
            priorState: { marks: { markValue: [] } },
            newState: { marks: { markValue: [{ mark: 'M', value: 'v' }] } },
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.ephemera.state',
                    streamKey: 'ROOM#sc',
                    timestamp: Date.now(),
                    type: 'State Changed',
                },
                getContent: () => Promise.resolve(payload),
            },
        ]

        await renderOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(fanOutSpy).toHaveBeenCalledTimes(1)
        expect(fanOutSpy.mock.calls[0][0].stateChanged).toEqual(payload)
        expect(orchestrateSpy).not.toHaveBeenCalled()
        fanOutSpy.mockRestore()
        orchestrateSpy.mockRestore()
    })

    it('is non-replayable until replay semantics are defined (see AGENT.md graduation)', () => {
        expect(renderOrchestrationDataSource.replayable).toBe(false)
    })
})
