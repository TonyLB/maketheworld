import {
    isEphemeraSubscribedEnvelope,
} from './subscribedEvents'

describe('ephemera subscribedEvents', () => {
    it('does not subscribe to mtw.diagnostics Room Occupancy Drift Finding (positions-owned S2-6-DR)', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Room Occupancy Drift Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Room Occupancy Drift Finding' as const,
                roomId: 'ROOM#alpha',
                diagnosticRunId: 'diag-1',
                timestamp: '2026-04-21T12:00:00.000Z',
            }),
        }

        expect(isEphemeraSubscribedEnvelope(envelope as any)).toBe(false)
    })

    it('rejects non-matching diagnostics event types', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Cache Consistency Finding',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraSubscribedEnvelope(envelope as any)).toBe(false)
    })
})
