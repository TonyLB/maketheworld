import { jest, describe, it, expect, beforeEach } from '@jest/globals'

jest.mock('./staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('./roomOccupancyDriftSweep', () => ({
    roomOccupancyDriftSweep: jest.fn(async () => ({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] }))
}))

import { staleSessionSweep } from './staleSessionSweep'
import { roomOccupancyDriftSweep } from './roomOccupancyDriftSweep'
import { handler } from './app'

describe('diagnostics handler', () => {
    beforeEach(() => {
        jest.mocked(staleSessionSweep).mockReset()
        jest.mocked(staleSessionSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(roomOccupancyDriftSweep).mockReset()
        jest.mocked(roomOccupancyDriftSweep).mockResolvedValue({ emittedCount: 0, roomIds: [] as string[], checkLocationCandidates: [] as string[] })
    })

    it('invokes staleSessionSweep for direct StaleSessionSweep via api.diagnostics synthetic lane', async () => {
        const result = await handler({
            type: 'StaleSessionSweep',
            diagnosticRunId: 'dr-1'
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'dr-1' })
        expect(result).toEqual({ emittedCount: 0, players: [] })
    })

    it('invokes staleSessionSweep for mtw.connections Session Disconnect Problem', async () => {
        await handler({
            source: 'mtw.connections',
            'detail-type': 'Session Disconnect Problem',
            detail: {
                sessionId: 'session-1',
                player: 'player-1',
                sourceOperation: 'checkSession',
                attemptCount: 3,
                dedupeKey: 'session-1::checkSession::3'
            }
        })

        expect(staleSessionSweep).toHaveBeenCalledWith()
    })

    it('routes mtw.connections New Player through DataSource subscribed intake', async () => {
        await handler({
            source: 'mtw.connections',
            'detail-type': 'New Player',
            detail: {
                player: 'player-1'
            }
        })

        expect(staleSessionSweep).not.toHaveBeenCalled()
    })

    it('drops malformed mtw.connections Session Disconnect Problem payloads without throwing', async () => {
        await expect(handler({
            source: 'mtw.connections',
            'detail-type': 'Session Disconnect Problem',
            detail: {
                sessionId: 'session-1',
                sourceOperation: 'checkSession',
                attemptCount: 3
            }
        })).resolves.toBeUndefined()

        expect(staleSessionSweep).not.toHaveBeenCalled()
    })

    it('passes nowMs through direct StaleSessionSweep synthetic intake', async () => {
        const result = await handler({
            type: 'StaleSessionSweep',
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })
        expect(result).toEqual({ emittedCount: 0, players: [] })
    })

    it('invokes roomOccupancyDriftSweep for direct RoomOccupancyDriftSweep type', async () => {
        const result = await handler({
            type: 'RoomOccupancyDriftSweep',
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })
        expect(result).toEqual({ emittedCount: 0, roomIds: [], checkLocationCandidates: [] })
    })

})
