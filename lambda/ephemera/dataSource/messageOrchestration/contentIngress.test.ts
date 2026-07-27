import type { PublishTarget } from '../../messageBus/baseClasses'
import { ContentIngressIndex, type RenderContent } from './contentIngress'

const spec = (slotId: string, overrides: Partial<{ componentId: string; perspectiveKey: string; threadKind: string; targets: PublishTarget[] }> = {}) => ({
    slotId,
    expectedPublishType: 'PerceptionMessage' as const,
    componentId: 'ROOM#a',
    perspectiveKey: 'PERSPECTIVE#a',
    threadKind: 'characterMove',
    ...overrides,
})

const content = (wmlContent: string): RenderContent => ({
    type: 'PublishMessage',
    displayProtocol: 'PerceptionMessage',
    wmlContent,
    metaData: { componentUUID: 'ROOM#a', displayMode: 'header', roomChannel: 'render' },
} as RenderContent)

describe('ContentIngressIndex', () => {
    it('the first registration against a key returns shouldKickoff: true', () => {
        const index = new ContentIngressIndex()
        const result = index.registerSlot('bundle-a', spec('header'))
        expect(result).toEqual({ shouldKickoff: true })
    })

    it('a second registration against the still-live key returns shouldKickoff: false with no replay if nothing has resolved yet', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header'))
        const result = index.registerSlot('bundle-b', spec('header'))
        expect(result).toEqual({ shouldKickoff: false, replay: [] })
    })

    it('a late registration replays every event recorded so far, without re-triggering kickoff', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header'))
        index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Generating'))

        const result = index.registerSlot('bundle-b', spec('header'))
        expect(result).toEqual({ shouldKickoff: false, replay: [content('Generating')] })
    })

    it('reportContent returns every registered listener, and does not shrink the list on repeat calls (placeholder wave then terminal wave both see the full set)', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header', { targets: ['CHARACTER#one'] }))
        index.registerSlot('bundle-b', spec('header', { targets: ['CHARACTER#two'] }))

        const placeholderListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Generating'))
        expect(placeholderListeners.map((l) => l.bundleId)).toEqual(['bundle-a', 'bundle-b'])

        const terminalListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Final'))
        expect(terminalListeners.map((l) => l.bundleId)).toEqual(['bundle-a', 'bundle-b'])
    })

    it('a threadKind mismatch on the same (componentId, perspectiveKey) is isolated into its own bucket', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header', { threadKind: 'characterMove' }))
        const broadcastResult = index.registerSlot('bundle-b', spec('broadcast', { threadKind: 'roomHeaderBroadcast' }))
        expect(broadcastResult).toEqual({ shouldKickoff: true })

        const listeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Final'))
        expect(listeners.map((l) => l.bundleId)).toEqual(['bundle-a'])
    })

    it('reportContent against a key with no registered listener returns an empty list and does not throw', () => {
        const index = new ContentIngressIndex()
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Final'))).toEqual([])
    })

    it('registerSlot no-ops (never live, never kicks off) when componentId/perspectiveKey/threadKind are not all present', () => {
        const index = new ContentIngressIndex()
        const result = index.registerSlot('bundle-a', { slotId: 'leave', expectedPublishType: 'WorldMessage' })
        expect(result).toEqual({ shouldKickoff: false, replay: [] })
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'characterMove', content('Final'))).toEqual([])
    })

    it('clear() resets kickoff-eligibility for a fresh invocation', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header'))
        index.clear()
        const result = index.registerSlot('bundle-b', spec('header'))
        expect(result).toEqual({ shouldKickoff: true })
    })
})
