import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderCacheTargetCatalog } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

jest.mock('../staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../roomOccupancyDriftSweep', () => ({
    roomOccupancyDriftSweep: jest.fn(async () => ({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] }))
}))
jest.mock('../playerMisalignmentSweep', () => ({
    playerMisalignmentSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../componentVerticalMisalignmentSweep', () => ({
    componentVerticalMisalignmentSweep: jest.fn(async () => ({ emitted: false }))
}))
jest.mock('../renderCacheDriftSweep', () => ({
    renderCacheDriftSweep: jest.fn(async () => ({
        emittedCount: 0,
        roomIds: [] as EphemeraRoomId[],
        catalogsChecked: 0,
        driftedCatalogs: [] as RenderCacheTargetCatalog[],
    }))
}))

import { componentVerticalMisalignmentSweep } from '../componentVerticalMisalignmentSweep'
import { renderCacheDriftSweep } from '../renderCacheDriftSweep'
import { staleSessionSweep } from '../staleSessionSweep'
import { roomOccupancyDriftSweep } from '../roomOccupancyDriftSweep'
import { playerMisalignmentSweep } from '../playerMisalignmentSweep'
import { processDiagnosticsSubscribedEvents } from './index'
import messageBus from '../messageBus'
import { getCollectedError, getCollectedReturnValueBody } from '../returnValue/collector'

const makeEnvelope = (header: { dataSourceKey: string; type: string }, content: unknown) => ({
    header: {
        dataSourceKey: header.dataSourceKey,
        type: header.type,
        streamKey: 'global',
        timestamp: Date.now()
    },
    getContent: async () => content
})

const sessionDisconnectProblemEnvelope = (dedupeKey: string) =>
    makeEnvelope(
        { dataSourceKey: 'mtw.connections', type: 'Session Disconnect Problem' },
        {
            type: 'Session Disconnect Problem',
            sessionId: 'session-1',
            sourceOperation: 'checkSession',
            attemptCount: 2,
            dedupeKey,
            timestamp: new Date().toISOString()
        }
    )

describe('diagnosticsDataSource subscribed event processing', () => {
    beforeEach(() => {
        jest.mocked(staleSessionSweep).mockReset()
        jest.mocked(staleSessionSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(roomOccupancyDriftSweep).mockReset()
        jest.mocked(roomOccupancyDriftSweep).mockResolvedValue({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] })
        jest.mocked(playerMisalignmentSweep).mockReset()
        jest.mocked(playerMisalignmentSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(componentVerticalMisalignmentSweep).mockReset()
        jest.mocked(componentVerticalMisalignmentSweep).mockResolvedValue({ emitted: false })
        jest.mocked(renderCacheDriftSweep).mockReset()
        jest.mocked(renderCacheDriftSweep).mockResolvedValue({
            emittedCount: 0,
            roomIds: [] as EphemeraRoomId[],
            catalogsChecked: 0,
            driftedCatalogs: [] as RenderCacheTargetCatalog[],
        })
        messageBus.clear()
    })

    it('dedupes repeated Session Disconnect Problem reports by dedupeKey within one batch', async () => {
        await processDiagnosticsSubscribedEvents([
            sessionDisconnectProblemEnvelope('dup-1'),
            sessionDisconnectProblemEnvelope('dup-1'),
        ])

        expect(staleSessionSweep).toHaveBeenCalledTimes(1)
    })

    it('dedupes repeated Session Disconnect Problem reports by dedupeKey across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-cross-batch')])
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-cross-batch')])

        expect(staleSessionSweep).toHaveBeenCalledTimes(1)
    })

    it('runs staleSessionSweep for distinct dedupeKeys across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-a')])
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-b')])

        expect(staleSessionSweep).toHaveBeenCalledTimes(2)
    })

    it('passes diagnosticRunId through for api.diagnostics StaleSessionSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'StaleSessionSweep' },
                {
                    type: 'StaleSessionSweep',
                    diagnosticRunId: 'diag-1'
                }
            )
        ])
        await messageBus.settle()

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-1' })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('passes nowMs through for api.diagnostics StaleSessionSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'StaleSessionSweep' },
                {
                    type: 'StaleSessionSweep',
                    nowMs: 12345
                }
            )
        ])
        await messageBus.settle()

        expect(staleSessionSweep).toHaveBeenCalledWith({ nowMs: 12345 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics RoomOccupancyDriftSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RoomOccupancyDriftSweep' },
                {
                    type: 'RoomOccupancyDriftSweep',
                    diagnosticRunId: 'diag-2',
                    nowMs: 54321
                }
            )
        ])
        await messageBus.settle()

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-2', nowMs: 54321 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics PlayerMisalignmentSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'PlayerMisalignmentSweep' },
                {
                    type: 'PlayerMisalignmentSweep',
                    diagnosticRunId: 'diag-3',
                    nowMs: 67890
                }
            )
        ])
        await messageBus.settle()

        expect(playerMisalignmentSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-3', nowMs: 67890 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('invokes componentVerticalMisalignmentSweep for ComponentVerticalMisalignmentSweep with assetId', async () => {
        jest.mocked(componentVerticalMisalignmentSweep).mockResolvedValueOnce({
            emitted: true,
            status: 'missing',
        })
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'ComponentVerticalMisalignmentSweep' },
                {
                    type: 'ComponentVerticalMisalignmentSweep',
                    assetId: 'ASSET#diag-asset',
                    diagnosticRunId: 'diag-cv',
                    nowMs: 11111,
                }
            )
        ])
        await messageBus.settle()

        expect(componentVerticalMisalignmentSweep).toHaveBeenCalledWith({
            assetId: 'ASSET#diag-asset',
            diagnosticRunId: 'diag-cv',
            nowMs: 11111,
        })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics RenderCacheDriftSweep events', async () => {
        jest.mocked(renderCacheDriftSweep).mockResolvedValueOnce({
            emittedCount: 1,
            roomIds: ['ROOM#alpha' as EphemeraRoomId],
            catalogsChecked: 1,
            driftedCatalogs: [{ ephemeraId: 'ROOM#alpha' as EphemeraRoomId, perspectiveKey: 'PERSPECTIVE#v1#abc' }],
        })
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RenderCacheDriftSweep' },
                {
                    type: 'RenderCacheDriftSweep',
                    roomIds: ['ROOM#alpha'],
                    diagnosticRunId: 'diag-rc',
                    nowMs: 22222,
                }
            )
        ])
        await messageBus.settle()

        expect(renderCacheDriftSweep).toHaveBeenCalledWith({
            roomIds: ['ROOM#alpha'],
            diagnosticRunId: 'diag-rc',
            nowMs: 22222,
        })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits Error when RenderCacheDriftSweep roomIds is not an array', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RenderCacheDriftSweep' },
                {
                    type: 'RenderCacheDriftSweep',
                    roomIds: 'ROOM#alpha',
                }
            )
        ])
        await messageBus.settle()

        expect(renderCacheDriftSweep).not.toHaveBeenCalled()
        expect(getCollectedError()).toEqual({
            error: 'RenderCacheDriftSweep requires roomIds array',
            statusCode: 400,
        })
    })
})
