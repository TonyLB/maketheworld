import { jest, describe, it, expect, beforeEach } from '@jest/globals'

jest.mock('../staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../roomOccupancyDriftSweep', () => ({
    roomOccupancyDriftSweep: jest.fn(async () => ({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] }))
}))

import { staleSessionSweep } from '../staleSessionSweep'
import { roomOccupancyDriftSweep } from '../roomOccupancyDriftSweep'
import { processDiagnosticsSubscribedEvents } from './index'
import messageBus from '../messageBus'

const makeEnvelope = (header: { dataSourceKey: string; type: string }, content: unknown) => ({
    header: {
        dataSourceKey: header.dataSourceKey,
        type: header.type,
        streamKey: 'global',
        timestamp: Date.now()
    },
    getContent: async () => content
})

describe('diagnosticsDataSource subscribed event processing', () => {
    beforeEach(() => {
        jest.mocked(staleSessionSweep).mockReset()
        jest.mocked(staleSessionSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(roomOccupancyDriftSweep).mockReset()
        jest.mocked(roomOccupancyDriftSweep).mockResolvedValue({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] })
        messageBus.clear()
    })

    it('dedupes repeated Session Disconnect Problem reports by dedupeKey within one batch', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'mtw.connections', type: 'Session Disconnect Problem' },
                {
                    type: 'Session Disconnect Problem',
                    sessionId: 'session-1',
                    sourceOperation: 'checkSession',
                    attemptCount: 2,
                    dedupeKey: 'dup-1',
                    timestamp: new Date().toISOString()
                }
            ),
            makeEnvelope(
                { dataSourceKey: 'mtw.connections', type: 'Session Disconnect Problem' },
                {
                    type: 'Session Disconnect Problem',
                    sessionId: 'session-1',
                    sourceOperation: 'checkSession',
                    attemptCount: 2,
                    dedupeKey: 'dup-1',
                    timestamp: new Date().toISOString()
                }
            )
        ])

        expect(staleSessionSweep).toHaveBeenCalledTimes(1)
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

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-1' })
        const returnValueMessages = messageBus._stream.map(({ payload }) => payload).filter(({ type }) => type === 'ReturnValue')
        expect(returnValueMessages).toHaveLength(1)
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

        expect(staleSessionSweep).toHaveBeenCalledWith({ nowMs: 12345 })
        const returnValueMessages = messageBus._stream.map(({ payload }) => payload).filter(({ type }) => type === 'ReturnValue')
        expect(returnValueMessages).toHaveLength(1)
    })

    it('accepts mtw.connections New Player events without repair action', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'mtw.connections', type: 'New Player' },
                {
                    player: 'player-new'
                }
            )
        ])
        expect(staleSessionSweep).not.toHaveBeenCalled()
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

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-2', nowMs: 54321 })
        const returnValueMessages = messageBus._stream.map(({ payload }) => payload).filter(({ type }) => type === 'ReturnValue')
        expect(returnValueMessages).toHaveLength(1)
    })
})
