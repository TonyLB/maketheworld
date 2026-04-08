import { renderOrchestrationDataSource } from './index'
import * as orchestrationHandler from './orchestrationHandler'
import * as fanOutStateChanged from './fanOutStateChangedToPassiveRenders'

describe('mtw.ephemera.renderOrchestration DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('delegates Render Requested ingress event to orchestrateRenderRequest', async () => {
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Render Requested',
                },
                getContent: () => Promise.resolve({
                    componentId: 'ROOM#one',
                    perspective: { assetStack: ['ASSET#one'] },
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
            type: 'RenderRequested',
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

    it('is non-replayable (current product choice; see AGENT.md)', () => {
        expect(renderOrchestrationDataSource.replayable).toBe(false)
    })
})
