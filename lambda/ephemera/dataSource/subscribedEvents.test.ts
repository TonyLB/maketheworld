import {
    isEphemeraSubscribedEnvelope,
} from './subscribedEvents'

describe('ephemera subscribedEvents', () => {
    it('rejects mtw.diagnostics Ephemera RenderCache Finding envelope', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Ephemera RenderCache Finding' as const,
            },
            getContent: () => Promise.resolve({
                type: 'Ephemera RenderCache Finding' as const,
                perspective: ['ASSET#primitives'],
                status: 'missing' as const,
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
