import {
    isEphemeraPositionsSubscribedEnvelope,
    isEphemeraPositionsConnectionsCharactersEnvelope,
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
})
