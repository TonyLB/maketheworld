import type { PublishTarget } from '../../messageBus/baseClasses'
import { ContentIngressIndex, type IngressAddress, type IngressListenerSpec, type RenderContent } from './contentIngress'

const spec = (overrides: Partial<{ componentId: string; perspectiveKey: string; contentStream: 'render' | 'affordances'; format: string; targets: PublishTarget[] }> = {}): IngressListenerSpec => ({
    componentId: 'ROOM#a',
    perspectiveKey: 'PERSPECTIVE#a',
    targets: [],
    contentStream: 'render',
    format: 'header',
    ...overrides,
} as IngressListenerSpec)

const address = (messageId: string): IngressAddress => ({ createdTime: 1000, messageId })

const content = (wmlContent: string): RenderContent => ({
    kind: 'literal',
    message: {
        type: 'PublishMessage',
        displayProtocol: 'PerceptionMessage',
        wmlContent,
        metaData: { componentUUID: 'ROOM#a', displayMode: 'header', roomChannel: 'render' },
    },
} as RenderContent)

const roomRenderContent = (summary: string): RenderContent => ({
    kind: 'roomRender',
    componentId: 'ROOM#a' as any,
    renderedContent: { description: [], summary: [summary] } as any,
})

describe('ContentIngressIndex', () => {
    it('the first registration against a key returns shouldKickoff: true', () => {
        const index = new ContentIngressIndex()
        const result = index.registerSlot(address('MESSAGE#a'), spec())
        expect(result).toEqual({ shouldKickoff: true })
    })

    it('a second registration against the still-live key returns shouldKickoff: false with no replay if nothing has resolved yet', () => {
        const index = new ContentIngressIndex()
        index.registerSlot(address('MESSAGE#a'), spec())
        const result = index.registerSlot(address('MESSAGE#b'), spec())
        expect(result).toEqual({ shouldKickoff: false, replay: [] })
    })

    it('a late registration replays every event recorded so far, without re-triggering kickoff', () => {
        const index = new ContentIngressIndex()
        index.registerSlot(address('MESSAGE#a'), spec())
        index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Generating'))

        const result = index.registerSlot(address('MESSAGE#b'), spec())
        expect(result).toEqual({ shouldKickoff: false, replay: [content('Generating')] })
    })

    it('reportContent returns every registered listener, and does not shrink the list on repeat calls (placeholder wave then terminal wave both see the full set)', () => {
        const index = new ContentIngressIndex()
        index.registerSlot(address('MESSAGE#a'), spec({ targets: ['CHARACTER#one'] }))
        index.registerSlot(address('MESSAGE#b'), spec({ targets: ['CHARACTER#two'] }))

        const placeholderListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Generating'))
        expect(placeholderListeners.map((l) => l.address.messageId)).toEqual(['MESSAGE#a', 'MESSAGE#b'])

        const terminalListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))
        expect(terminalListeners.map((l) => l.address.messageId)).toEqual(['MESSAGE#a', 'MESSAGE#b'])
    })

    it('a contentStream mismatch on the same (componentId, perspectiveKey) is isolated into its own bucket', () => {
        const index = new ContentIngressIndex()
        index.registerSlot(address('MESSAGE#a'), spec({ contentStream: 'render' }))
        const affordancesResult = index.registerSlot(address('MESSAGE#b'), spec({ contentStream: 'affordances', format: 'default' }))
        expect(affordancesResult).toEqual({ shouldKickoff: true })

        const listeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))
        expect(listeners.map((l) => l.address.messageId)).toEqual(['MESSAGE#a'])
    })

    it('two slots differing only in format share one bucket and one kickoff, each delivered its own correctly-projected envelope', () => {
        const index = new ContentIngressIndex()
        const headerResult = index.registerSlot(address('MESSAGE#header'), spec({ format: 'header', targets: ['CHARACTER#one'] }))
        expect(headerResult).toEqual({ shouldKickoff: true })
        const fullResult = index.registerSlot(address('MESSAGE#full'), spec({ format: 'full', targets: ['CHARACTER#two'] }))
        expect(fullResult).toEqual({ shouldKickoff: false, replay: [] })

        const listeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', roomRenderContent('a summary'))
        expect(listeners.map((l) => l.address.messageId)).toEqual(['MESSAGE#header', 'MESSAGE#full'])
        expect(listeners.map((l) => l.spec.format)).toEqual(['header', 'full'])
    })

    it('reportContent against a key with no registered listener returns an empty list and does not throw', () => {
        const index = new ContentIngressIndex()
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))).toEqual([])
    })

    it('registerSlot no-ops (never live, never kicks off) when componentId or perspectiveKey is empty', () => {
        const index = new ContentIngressIndex()
        const result = index.registerSlot(address('MESSAGE#a'), spec({ perspectiveKey: '' }))
        expect(result).toEqual({ shouldKickoff: false, replay: [] })
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))).toEqual([])
    })

    it('clear() resets kickoff-eligibility for a fresh invocation', () => {
        const index = new ContentIngressIndex()
        index.registerSlot(address('MESSAGE#a'), spec())
        index.clear()
        const result = index.registerSlot(address('MESSAGE#b'), spec())
        expect(result).toEqual({ shouldKickoff: true })
    })

    it('a listener keeps the address object it registered with', () => {
        const index = new ContentIngressIndex()
        const own = { createdTime: 1001, messageId: 'MESSAGE#1' }
        index.registerSlot(own, spec())
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))[0].address).toBe(own)
    })
})
