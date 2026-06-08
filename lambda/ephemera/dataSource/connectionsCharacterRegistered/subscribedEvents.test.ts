import { isConnectionsCharacterRegisteredEnvelope } from './subscribedEvents'

describe('connectionsCharacterRegistered subscribedEvents', () => {
    it('accepts mtw.connections Character Registered envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Registered' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Character Registered' as const,
                characterId: 'CHARACTER#alpha' as const,
                sessionId: 'SESSION#1',
                timestamp: '2026-06-08T12:00:00.000Z',
            }),
        }

        expect(isConnectionsCharacterRegisteredEnvelope(envelope as any)).toBe(true)
    })

    it('rejects Session Disconnect on mtw.connections', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Session Disconnect' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Session Disconnect' as const,
                sessionId: 'SESSION#1',
                timestamp: '2026-06-08T12:00:00.000Z',
            }),
        }

        expect(isConnectionsCharacterRegisteredEnvelope(envelope as any)).toBe(false)
    })

    it('rejects Character Registered on mtw.connections.characters', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.connections.characters',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Registered' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Character Registered' as const,
                characterId: 'CHARACTER#alpha' as const,
                sessionId: 'SESSION#1',
                timestamp: '2026-06-08T12:00:00.000Z',
            }),
        }

        expect(isConnectionsCharacterRegisteredEnvelope(envelope as any)).toBe(false)
    })
})
