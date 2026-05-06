import { jest, describe, it, expect, beforeEach } from '@jest/globals'

jest.mock('../staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../player', () => ({
    healPlayer: jest.fn(async () => ({}))
}))

import { staleSessionSweep } from '../staleSessionSweep'
import { healPlayer } from '../player'
import { processDiagnosticsSubscribedEvents } from './index'

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
        jest.mocked(healPlayer).mockReset()
        jest.mocked(healPlayer).mockResolvedValue({ Characters: [], Assets: [], guestName: '', guestId: '' })
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
    })

    it('routes mtw.connections New Player events to healPlayer', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'mtw.connections', type: 'New Player' },
                {
                    player: 'player-new'
                }
            )
        ])

        expect(healPlayer).toHaveBeenCalledWith('player-new')
    })
})
