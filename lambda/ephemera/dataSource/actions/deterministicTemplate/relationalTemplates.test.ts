import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { DeterministicTemplate } from './deterministicTemplate'
import { matchDeterministicTemplate } from './index'
import {
    dissolveAgainstTemplate,
    dissolveContainmentTemplate,
    dissolveCustomTemplate,
    dissolveOnTemplate,
    dissolveUnderTemplate,
    establishAgainstTemplate,
    establishContainmentTemplate,
    establishCustomTemplate,
    establishOnTemplate,
    establishUnderTemplate,
} from './relationalTemplates'

const RELATE_INTENT = { type: 'ObjectRelateIntent', confidence: 1 }

describe('enum bucket', () => {
    const cases: {
        name: string
        template: DeterministicTemplate
        command: string
        verb: string
        prep: string
    }[] = [
        { name: 'establish/Against', template: establishAgainstTemplate, command: 'put lamp against wall', verb: 'put', prep: 'against' },
        { name: 'establish/Under', template: establishUnderTemplate, command: 'place lamp under table', verb: 'place', prep: 'under' },
        { name: 'dissolve/Against', template: dissolveAgainstTemplate, command: 'take lamp against wall', verb: 'take', prep: 'against' },
        { name: 'dissolve/Under', template: dissolveUnderTemplate, command: 'remove lamp under table', verb: 'remove', prep: 'under' },
    ]

    it.each(cases)('$name matches via matchString with correct intent + skeleton', ({ template, command, verb, prep }) => {
        const result = template.matchString(command)
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', target: expect.any(String) })
        expect(result.skeleton).toHaveLength(4)
        expect(result.skeleton[0]).toEqual({ type: 'text', text: verb })
        expect(result.skeleton[1]).toMatchObject({ type: 'objectSpan', span: 'lamp' })
        expect(result.skeleton[2]).toEqual({ type: 'text', text: prep })
        expect(result.skeleton[3]).toMatchObject({ type: 'objectSpan' })
    })

    it.each(cases)('$name matches via matchTokens with correct intent', ({ template, verb, prep }) => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: verb },
            { type: 'objectSpan', span: 'lamp', stableRefKey: 'lampRef' },
            { type: 'text', text: prep },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]
        const result = template.matchTokens(skeleton)
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', target: 'table' })
        expect(result.skeleton).toBe(skeleton)
    })

    it('handles a multi-word prep phrase without the subject span swallowing part of it', () => {
        const result = establishAgainstTemplate.matchString('put lamp leaning against wall')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', target: 'wall' })
        expect(result.skeleton[0]).toEqual({ type: 'text', text: 'put' })
        expect(result.skeleton[1]).toMatchObject({ type: 'objectSpan', span: 'lamp' })
        expect(result.skeleton[2]).toEqual({ type: 'text', text: 'leaning against' })
        expect(result.skeleton[3]).toMatchObject({ type: 'objectSpan', span: 'wall' })
    })

    it('rejects a non-matching verb/prep combination', () => {
        expect(establishAgainstTemplate.matchString('take lamp against wall').type).toBe('noMatch')
        expect(establishAgainstTemplate.matchString('put lamp under wall').type).toBe('noMatch')
    })
})

describe('custom bucket', () => {
    it('captures an arbitrary preposition into the skeleton text token and intent.relationLabel', () => {
        const result = establishCustomTemplate.matchString('put lamp atop wall')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', relationLabel: 'atop', target: 'wall' })
        expect(result.skeleton[2]).toEqual({ type: 'text', text: 'atop' })
    })

    it('works for the dissolve verb-class too', () => {
        const result = dissolveCustomTemplate.matchString('take lamp atop wall')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', relationLabel: 'atop', target: 'wall' })
    })

    it('recognizes "tie" as an establish verb (PV1-3, "tie rope to cup")', () => {
        const result = establishCustomTemplate.matchString('tie rope to cup')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'rope', relationLabel: 'to', target: 'cup' })
    })
})

describe('containment/defer bucket', () => {
    it.each([
        ['establish', establishContainmentTemplate, 'put coin in box'],
        ['dissolve', dissolveContainmentTemplate, 'take coin in box'],
        ['establish', establishOnTemplate, 'put lamp on table'],
        ['dissolve', dissolveOnTemplate, 'take lamp on table'],
    ] as const)('%s verb-class defers with reason nesting via matchString', (_name, template, command) => {
        const result = template.matchString(command)
        expect(result).toEqual({ type: 'defer', reason: 'nesting' })
    })

    it('defers via matchTokens too', () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'into' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ]
        expect(establishContainmentTemplate.matchTokens(skeleton)).toEqual({ type: 'defer', reason: 'nesting' })
    })

    it('does not defer on a non-hosting, non-containment preposition', () => {
        expect(establishContainmentTemplate.matchString('put coin under box').type).toBe('noMatch')
    })
})

describe('registry ordering', () => {
    it('routes a containment phrase to defer, not the custom bucket', () => {
        expect(matchDeterministicTemplate('put coin in box')).toEqual({ type: 'defer', reason: 'nesting' })
    })

    it('routes an enum phrase to its specific relationKind, not the custom bucket', () => {
        const result = matchDeterministicTemplate('put lamp under table')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', target: 'table' })
        expect(result.skeleton[2]).toEqual({ type: 'text', text: 'under' })
    })

    it('routes an On phrase to defer, not the custom bucket (Channel D CD2: On joins In/PartOf)', () => {
        expect(matchDeterministicTemplate('put lamp on table')).toEqual({ type: 'defer', reason: 'nesting' })
    })

    it('still falls through to the custom bucket for a genuinely arbitrary preposition', () => {
        const result = matchDeterministicTemplate('put lamp atop table')
        if (result.type !== 'matched') throw new Error('expected matched')
        expect(result.intent).toEqual({ ...RELATE_INTENT, subject: 'lamp', relationLabel: 'atop', target: 'table' })
    })

    it('returns noMatch for a non-relational, non-bare-word command', () => {
        expect(matchDeterministicTemplate('xyzzy').type).toBe('noMatch')
    })
})
