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

    it('invokes staleSessionSweep for mtw.diagnostics Stale Session Sweep', async () => {
        await handler({
            source: 'mtw.diagnostics',
            'detail-type': 'Stale Session Sweep',
            detail: { diagnosticRunId: 'dr-1' }
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'dr-1' })
    })

    it('invokes staleSessionSweep for direct StaleSessionSweep type', async () => {
        await handler({
            type: 'StaleSessionSweep',
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })
    })

    it('invokes roomOccupancyDriftSweep for direct RoomOccupancyDriftSweep type', async () => {
        await handler({
            type: 'RoomOccupancyDriftSweep',
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })
    })
})
