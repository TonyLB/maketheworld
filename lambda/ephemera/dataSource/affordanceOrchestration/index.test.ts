import { affordanceOrchestrationDataSource } from './index'
import * as orchestrationHandler from './orchestrationHandler'
import * as fanOutAffordanceRefresh from './fanOutAffordanceRefreshForRoom'
import * as orientationHandler from '../connectionsCharacterRegistered/handleCharacterRegisteredOrientation'
import messageBus from '../../messageBus'

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

    it('delegates mtw.assets.componentTopology TopologyInvalidated to fanOutAffordanceRefreshForRoom', async () => {
        const fanOutSpy = jest.spyOn(fanOutAffordanceRefresh, 'fanOutAffordanceRefreshForRoom').mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.assets.componentTopology',
                    streamKey: 'ROOM#topo',
                    timestamp: Date.now(),
                    type: 'TopologyInvalidated',
                },
                getContent: () => Promise.resolve({
                    type: 'TopologyInvalidated',
                    roomIds: ['ROOM#topo'],
                    editAssetId: 'ASSET#edit',
                }),
            },
        ]

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(fanOutSpy).toHaveBeenCalledTimes(1)
        expect(fanOutSpy.mock.calls[0][0]).toMatchObject({
            roomId: 'ROOM#topo',
            reason: 'topology',
        })
        expect(orchestrateSpy).not.toHaveBeenCalled()
        fanOutSpy.mockRestore()
        orchestrateSpy.mockRestore()
    })

    it('fans out TopologyInvalidated once per valid roomId', async () => {
        const fanOutSpy = jest.spyOn(fanOutAffordanceRefresh, 'fanOutAffordanceRefreshForRoom').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.assets.componentTopology',
                    streamKey: 'AREA#x',
                    timestamp: Date.now(),
                    type: 'TopologyInvalidated',
                },
                getContent: () => Promise.resolve({
                    type: 'TopologyInvalidated',
                    roomIds: ['ROOM#a', 'ROOM#b', 'MAP#notaroom'],
                    editAssetId: 'ASSET#edit',
                }),
            },
        ]

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(fanOutSpy).toHaveBeenCalledTimes(2)
        expect(fanOutSpy.mock.calls.map((c) => c[0].roomId)).toEqual(['ROOM#a', 'ROOM#b'])
        fanOutSpy.mockRestore()
    })

    it('no-ops area-scoped TopologyInvalidated without roomIds', async () => {
        const fanOutSpy = jest.spyOn(fanOutAffordanceRefresh, 'fanOutAffordanceRefreshForRoom').mockResolvedValue(undefined)
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.assets.componentTopology',
                    streamKey: 'AREA#x',
                    timestamp: Date.now(),
                    type: 'TopologyInvalidated',
                },
                getContent: () => Promise.resolve({
                    type: 'TopologyInvalidated',
                    areaId: 'AREA#x',
                    editAssetId: 'ASSET#edit',
                }),
            },
        ]

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(fanOutSpy).not.toHaveBeenCalled()
        fanOutSpy.mockRestore()
    })

    it('delegates mtw.connections Character Registered to handleCharacterRegisteredOrientation affordances channel', async () => {
        const orientationSpy = jest
            .spyOn(orientationHandler, 'handleCharacterRegisteredOrientation')
            .mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)
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

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(orientationSpy).toHaveBeenCalledTimes(1)
        expect(orientationSpy).toHaveBeenCalledWith(messageBus, payload, 'affordances')
        expect(orchestrateSpy).not.toHaveBeenCalled()
        orientationSpy.mockRestore()
        orchestrateSpy.mockRestore()
    })

    it('delegates mtw.ephemera.objects Objects Changed to fanOutAffordanceRefreshForRoom', async () => {
        const fanOutSpy = jest.spyOn(fanOutAffordanceRefresh, 'fanOutAffordanceRefreshForRoom').mockResolvedValue(undefined)
        const orchestrateSpy = jest.spyOn(orchestrationHandler, 'orchestrateAffordanceRequest').mockResolvedValue(undefined)
        const payload = {
            type: 'Objects Changed' as const,
            componentId: 'ROOM#obj',
            add: [],
            remove: [],
            priorObjects: [],
            newObjects: [],
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.ephemera.objects',
                    streamKey: 'ROOM#obj',
                    timestamp: Date.now(),
                    type: 'Objects Changed',
                },
                getContent: () => Promise.resolve(payload),
            },
        ]

        await affordanceOrchestrationDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(fanOutSpy).toHaveBeenCalledTimes(1)
        expect(fanOutSpy.mock.calls[0][0]).toMatchObject({
            roomId: 'ROOM#obj',
            reason: 'objects',
        })
        expect(orchestrateSpy).not.toHaveBeenCalled()
        fanOutSpy.mockRestore()
        orchestrateSpy.mockRestore()
    })

    it('is non-replayable', () => {
        expect(affordanceOrchestrationDataSource.replayable).toBe(false)
    })
})
