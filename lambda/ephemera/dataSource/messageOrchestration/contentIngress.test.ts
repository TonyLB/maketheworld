import type { PublishTarget } from '../../messageBus/baseClasses'
import { ContentIngressIndex, type RenderContent } from './contentIngress'
import type { MessageOrchestrationSlotSpec } from './localApiEvents'

const spec = (slotId: string, overrides: Partial<{ componentId: string; perspectiveKey: string; contentStream: 'render' | 'affordances'; format: string; targets: PublishTarget[] }> = {}): MessageOrchestrationSlotSpec => ({
    slotId,
    expectedPublishType: 'PerceptionMessage' as const,
    componentId: 'ROOM#a',
    perspectiveKey: 'PERSPECTIVE#a',
    contentStream: 'render',
    format: 'header',
    ...overrides,
} as MessageOrchestrationSlotSpec)

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
        index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Generating'))

        const result = index.registerSlot('bundle-b', spec('header'))
        expect(result).toEqual({ shouldKickoff: false, replay: [content('Generating')] })
    })

    it('reportContent returns every registered listener, and does not shrink the list on repeat calls (placeholder wave then terminal wave both see the full set)', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header', { targets: ['CHARACTER#one'] }))
        index.registerSlot('bundle-b', spec('header', { targets: ['CHARACTER#two'] }))

        const placeholderListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Generating'))
        expect(placeholderListeners.map((l) => l.bundleId)).toEqual(['bundle-a', 'bundle-b'])

        const terminalListeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))
        expect(terminalListeners.map((l) => l.bundleId)).toEqual(['bundle-a', 'bundle-b'])
    })

    it('a contentStream mismatch on the same (componentId, perspectiveKey) is isolated into its own bucket', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header', { contentStream: 'render' }))
        const affordancesResult = index.registerSlot('bundle-b', spec('affordances', { contentStream: 'affordances', format: 'default' }))
        expect(affordancesResult).toEqual({ shouldKickoff: true })

        const listeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))
        expect(listeners.map((l) => l.bundleId)).toEqual(['bundle-a'])
    })

    it('two slots differing only in format share one bucket and one kickoff, each delivered its own correctly-projected envelope', () => {
        const index = new ContentIngressIndex()
        const headerResult = index.registerSlot('bundle-header', spec('header', { format: 'header', targets: ['CHARACTER#one'] }))
        expect(headerResult).toEqual({ shouldKickoff: true })
        const fullResult = index.registerSlot('bundle-full', spec('full', { format: 'full', targets: ['CHARACTER#two'] }))
        expect(fullResult).toEqual({ shouldKickoff: false, replay: [] })

        const listeners = index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', roomRenderContent('a summary'))
        expect(listeners.map((l) => l.bundleId)).toEqual(['bundle-header', 'bundle-full'])
        expect(listeners.map((l) => l.spec.format)).toEqual(['header', 'full'])
    })

    it('reportContent against a key with no registered listener returns an empty list and does not throw', () => {
        const index = new ContentIngressIndex()
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))).toEqual([])
    })

    it('registerSlot no-ops (never live, never kicks off) when componentId/perspectiveKey/contentStream are not all present', () => {
        const index = new ContentIngressIndex()
        const result = index.registerSlot('bundle-a', { slotId: 'leave', expectedPublishType: 'WorldMessage' })
        expect(result).toEqual({ shouldKickoff: false, replay: [] })
        expect(index.reportContent('ROOM#a', 'PERSPECTIVE#a', 'render', content('Final'))).toEqual([])
    })

    it('clear() resets kickoff-eligibility for a fresh invocation', () => {
        const index = new ContentIngressIndex()
        index.registerSlot('bundle-a', spec('header'))
        index.clear()
        const result = index.registerSlot('bundle-b', spec('header'))
        expect(result).toEqual({ shouldKickoff: true })
    })
})
