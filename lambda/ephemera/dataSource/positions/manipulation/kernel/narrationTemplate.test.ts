import { fillNarrationTemplate } from './narrationTemplate'
import type { TemplateNarrationSpec } from './kernelStep'

const BROOM = 'OBJECT#broom'

describe('narrationTemplate', () => {
    const dropTemplate: TemplateNarrationSpec = {
        kind: 'template',
        parts: [{ slot: 'actor' }, { text: ' drops ' }, { ref: BROOM }],
        actorName: 'Alice',
        labels: { [BROOM]: 'broom' },
    }

    it('fills the actor slot, literal text and a ref into its copy', () => {
        expect(fillNarrationTemplate(dropTemplate)).toEqual('Alice drops broom')
    })

    it('falls back to Someone for an empty actor name, in any template', () => {
        const authored: TemplateNarrationSpec = {
            kind: 'template',
            parts: [{ slot: 'actor' }, { text: ' hurriedly lifts ' }, { ref: BROOM }],
            actorName: '',
            labels: { [BROOM]: 'broom' },
        }
        expect(fillNarrationTemplate(authored)).toEqual('Someone hurriedly lifts broom')
    })

    it('fills any number of refs from one label map, with no role-named field per entity', () => {
        const relational: TemplateNarrationSpec = {
            kind: 'template',
            parts: [{ slot: 'actor' }, { text: ' ties ' }, { ref: 'OBJECT#rope' }, { text: ' to ' }, { ref: 'OBJECT#pole' }],
            actorName: 'Tess',
            labels: { 'OBJECT#rope': 'the rope', 'OBJECT#pole': 'the pole' },
        }
        expect(fillNarrationTemplate(relational)).toEqual('Tess ties the rope to the pole')
    })

    it('throws on a ref with no label rather than rendering a hole', () => {
        const missing: TemplateNarrationSpec = { ...dropTemplate, labels: {} }
        expect(() => fillNarrationTemplate(missing)).toThrow(/OBJECT#broom/)
    })

    it('passes literal text through without interpreting it', () => {
        const literal: TemplateNarrationSpec = {
            kind: 'template',
            parts: [{ text: 'a {object} & <b>' }],
            actorName: 'Alice',
            labels: {},
        }
        expect(fillNarrationTemplate(literal)).toEqual('a {object} & <b>')
    })
})
