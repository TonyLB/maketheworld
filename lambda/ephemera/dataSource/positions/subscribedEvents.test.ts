import {
    isEphemeraPositionsSubscribedEnvelope,
    isEphemeraPositionsConnectionsCharactersEnvelope,
    isEphemeraPositionsActionsCharacterNavigateEnvelope,
    isEphemeraPositionsActionsCharacterHomeEnvelope,
    isEphemeraPositionsActionsObjectTakeHoldEnvelope,
    isEphemeraPositionsActionsObjectDropEnvelope,
    isEphemeraPositionsActionsObjectEstablishRelationEnvelope,
    isEphemeraPositionsActionsObjectDissolveRelationEnvelope,
    isEphemeraPositionsActionsObjectRehostEnvelope,
    isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope,
    isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope,
    isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope,
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

    it('accepts mtw.ephemera.actions Character Home envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Home',
            },
            getContent: () => Promise.resolve({
                type: 'Character Home',
                characterId: 'CHARACTER#alpha',
                fromRoomId: 'ROOM#from',
                toRoomId: 'ROOM#home',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsCharacterHomeEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.ephemera.actions Object Take Hold envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Object Take Hold' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Object Take Hold' as const,
                characterId: 'CHARACTER#alpha' as const,
                objectId: 'OBJECT#Broom' as const,
                roomId: 'ROOM#from' as const,
                confidence: 0.9,
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsObjectTakeHoldEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.ephemera.actions Object Drop envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Object Drop' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Object Drop' as const,
                characterId: 'CHARACTER#alpha' as const,
                objectId: 'OBJECT#Broom' as const,
                roomId: 'ROOM#from' as const,
                confidence: 0.9,
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsObjectDropEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.ephemera.actions Object Establish Relation envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Object Establish Relation' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Object Establish Relation' as const,
                characterId: 'CHARACTER#alpha' as const,
                subjectId: 'OBJECT#Broom' as const,
                targetId: 'OBJECT#Table' as const,
                hostId: 'ROOM#from' as const,
                relationKind: 'Under' as const,
                steps: [{
                    kind: 'establishRelation' as const,
                    subjectId: 'OBJECT#Broom' as const,
                    targetId: 'OBJECT#Table' as const,
                    relationKind: 'Under' as const,
                    hostId: 'ROOM#from' as const,
                }],
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsObjectEstablishRelationEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.ephemera.actions Object Rehost envelope (PV1-2)', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Object Rehost' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Object Rehost' as const,
                characterId: 'CHARACTER#alpha' as const,
                subjectId: 'OBJECT#Cup' as const,
                targetId: 'OBJECT#Tray' as const,
                roomId: 'ROOM#from' as const,
                containment: 'On' as const,
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsObjectRehostEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.ephemera.actions Object Dissolve Relation envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Object Dissolve Relation' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Object Dissolve Relation' as const,
                characterId: 'CHARACTER#alpha' as const,
                subjectId: 'OBJECT#Broom' as const,
                targetId: 'OBJECT#Table' as const,
                roomId: 'ROOM#from' as const,
                relationKind: 'On' as const,
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsActionsObjectDissolveRelationEnvelope(envelope as any)).toBe(true)
    })

    it('rejects unrelated event type on mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Acme Order',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsActionsCharacterNavigateEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsActionsCharacterHomeEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsActionsObjectTakeHoldEnvelope(envelope as any)).toBe(false)
        expect(isEphemeraPositionsActionsObjectDropEnvelope(envelope as any)).toBe(false)
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

    it('accepts mtw.diagnostics Ludic Graph Stale Structure Finding envelope (LP4i)', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Ludic Graph Stale Structure Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Ludic Graph Stale Structure Finding' as const,
                ephemeraId: 'ROOM#alpha' as const,
                diagnosticRunId: 'diag-1',
                timestamp: '2026-08-20T10:00:00.000Z',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope(envelope as any)).toBe(true)
    })

    it('accepts mtw.diagnostics Ludic Graph Port Mismatch Finding envelope (LP6a)', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Ludic Graph Port Mismatch Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Ludic Graph Port Mismatch Finding' as const,
                ephemeraId: 'OBJECT#Rope' as const,
                portId: 'abcd123',
                diagnosticRunId: 'diag-2',
                timestamp: '2026-08-23T10:00:00.000Z',
            }),
        }

        expect(isEphemeraPositionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope(envelope as any)).toBe(true)
        expect(isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope(envelope as any)).toBe(false)
    })
})
