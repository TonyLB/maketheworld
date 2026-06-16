import {
    isActionsSubscribedEnvelope,
    isActionsParseRequestedEnvelope,
    isActionsActionAssessedEnvelope,
} from './subscribedEvents'

describe('mtw.ephemera.actions subscribedEvents', () => {
    it('accepts api.ephemera Parse Requested envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Parse Requested' as const,
            },
            getContent: () => Promise.resolve({
                characterId: 'CHARACTER#123' as const,
                command: 'look',
            }),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isActionsParseRequestedEnvelope(envelope as any)).toBe(true)
        expect(isActionsActionAssessedEnvelope(envelope as any)).toBe(false)
    })

    it('accepts api.ephemera Action Assessed envelope with Navigation assessed', () => {
        const envelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Action Assessed' as const,
            },
            getContent: () => Promise.resolve({
                characterId: 'CHARACTER#123' as const,
                assessed: {
                    type: 'Navigation' as const,
                    targetId: 'ROOM#789' as const,
                    confidence: 1,
                },
                source: 'uiExit' as const,
            }),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isActionsActionAssessedEnvelope(envelope as any)).toBe(true)
        expect(isActionsParseRequestedEnvelope(envelope as any)).toBe(false)
    })

    it('accepts api.ephemera Action Assessed envelope with Home assessed', () => {
        const envelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Action Assessed' as const,
            },
            getContent: () => Promise.resolve({
                characterId: 'CHARACTER#123' as const,
                assessed: {
                    type: 'Home' as const,
                    confidence: 1,
                },
                source: 'uiHome' as const,
            }),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isActionsActionAssessedEnvelope(envelope as any)).toBe(true)
    })

    it('accepts api.ephemera Action Assessed envelope with CharacterSpoke assessed', () => {
        const envelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Action Assessed' as const,
            },
            getContent: () => Promise.resolve({
                characterId: 'CHARACTER#123' as const,
                assessed: {
                    type: 'CharacterSpoke' as const,
                    message: 'Hello',
                    displayProtocol: 'SayMessage' as const,
                    confidence: 1,
                },
                source: 'uiSpeech' as const,
            }),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(true)
        expect(isActionsActionAssessedEnvelope(envelope as any)).toBe(true)
    })

    it('rejects unrelated dataSourceKey', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Character Navigate',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(false)
    })

    it('rejects unrelated event type on api.ephemera', () => {
        const envelope = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Put Cache Record',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isActionsSubscribedEnvelope(envelope as any)).toBe(false)
    })
})
