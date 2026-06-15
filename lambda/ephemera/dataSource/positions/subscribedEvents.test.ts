import {
    isEphemeraPositionsSubscribedEnvelope,
    isEphemeraPositionsConnectionsCharactersEnvelope,
    isEphemeraPositionsActionsCharacterNavigateEnvelope,
    isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope,
} from './subscribedEvents'

describe('mtw.ephemera.positions subscribedEvents', () => {
    it('accepts mtw.connections.characters Character Connected envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections.characters',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Connected' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Character Connected' as const,
                characterId: 'CHARACTER#alpha' as const,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsConnectionsCharactersEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.connections.characters Character Disconnected envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections.characters',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Disconnected' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Character Disconnected' as const,
                characterId: 'CHARACTER#alpha' as const,
                sessionId: 'SESSION#1',
                timestamp: '2026-05-08T12:00:00.000Z',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('rejects unrelated dataSourceKey', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Session Disconnect',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsConnectionsCharactersEnvelope(envelope as any)).toBe(false)
    })

    it('rejects unrelated event type on the connections.characters source', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections.characters',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Registered',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(false)
    })

    it('accepts mtw.ephemera.actions Character Navigate envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Navigate' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Character Navigate' as const,
                characterId: 'CHARACTER#alpha' as const,
                fromRoomId: 'ROOM#from' as const,
                toRoomId: 'ROOM#to' as const,
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsCharacterNavigateEnvelope(envelope as any)).toBe(true)
    })

    it('rejects unrelated event type on mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Home',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsActionsCharacterNavigateEnvelope(envelope as any)).toBe(false)
    })

    it('accepts mtw.diagnostics Room Occupancy Drift Finding envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Room Occupancy Drift Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Room Occupancy Drift Finding' as const,
                roomId: 'ROOM#alpha' as const,
                diagnosticRunId: 'diag-1',
                timestamp: '2026-05-06T10:00:00.000Z',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope(envelope as any)).toBe(true)
    })

    it('rejects unrelated event type on mtw.diagnostics', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Ephemera RenderCache Finding',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope(envelope as any)).toBe(false)
    })
})
