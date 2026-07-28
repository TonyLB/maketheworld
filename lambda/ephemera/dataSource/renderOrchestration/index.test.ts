import messageBus from '../../messageBus'
import { renderOrchestrationDataSource } from './index'
import * as orchestrationHandler from './orchestrationHandler'
import * as fanOutStateChanged from './fanOutStateChangedToPassiveRenders'
import * as lookHandler from './handleLookCommandRequestedForRenderOrchestration'
import * as orientationHandler from '../connectionsCharacterRegistered/handleCharacterRegisteredOrientation'

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

    it('delegates mtw.ephemera.actions Look Command Requested to handleLookCommandRequestedForRenderOrchestration', async () => {
        const lookSpy = jest
            .spyOn(lookHandler, 'handleLookCommandRequestedForRenderOrchestration')
            .mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.ephemera.actions',
                    streamKey: 'CHARACTER#c',
                    timestamp: Date.now(),
                    type: 'Look Command Requested',
                },
                getContent: () => Promise.resolve({
                    type: 'Look Command Requested',
                    characterId: 'CHARACTER#c',
                    componentId: 'ROOM#r',
                    confidence: 0.9,
                }),
            },
        ]

        const streamEvent = jest.fn().mockResolvedValue(undefined)
        await renderOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent,
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(lookSpy).toHaveBeenCalledTimes(1)
        expect(lookSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                type: 'Look Command Requested',
                characterId: 'CHARACTER#c',
                componentId: 'ROOM#r',
            }),
            streamEvent,
        )
        expect(orchestrateSpy).not.toHaveBeenCalled()
        lookSpy.mockRestore()
        orchestrateSpy.mockRestore()
    })

    it('delegates mtw.connections Character Registered to handleCharacterRegisteredOrientation render channel', async () => {
        const orientationSpy = jest
            .spyOn(orientationHandler, 'handleCharacterRegisteredOrientation')
            .mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateRenderRequest').mockResolvedValue(undefined)
        const payload = {
            type: 'Character Registered' as const,
            characterId: 'CHARACTER#c',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z',
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.connections',
                    streamKey: 'CHARACTER#c',
                    timestamp: Date.now(),
                    type: 'Character Registered',
                },
                getContent: () => Promise.resolve(payload),
            },
        ]

        const streamEvent = jest.fn().mockResolvedValue(undefined)
        await renderOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent,
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(orientationSpy).toHaveBeenCalledTimes(1)
        expect(orientationSpy).toHaveBeenCalledWith(messageBus, payload, 'render', undefined, streamEvent)
        expect(orchestrateSpy).not.toHaveBeenCalled()
        orientationSpy.mockRestore()
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
