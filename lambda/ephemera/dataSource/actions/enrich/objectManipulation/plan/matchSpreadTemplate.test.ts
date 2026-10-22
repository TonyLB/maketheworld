import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { ParseSkeleton } from '../parse/parseToken'
import { matchContainmentTemplate } from './matchContainmentTemplate'
import { matchSpreadTemplate } from './matchSpreadTemplate'
import type { SpreadTemplateMatchResult } from './matchSpreadTemplate'
import type { Change } from './planStep'

/** The attempt's steps, so the expectations below read the plan's shape, not the attempt's. */
const summarize = (result: SpreadTemplateMatchResult) => {
    if (result.type !== 'matched') {
        return result
    }
    return { type: 'matched' as const, changes: result.attempt.actions().map((action) => action.desiredResult as Change) }
}

const spreadSkeleton = (verb: string, subjectSpan: string, prep: string, targetSpan: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: `${subjectSpan}Ref` },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: `${targetSpan}Ref` },
]

describe('matchSpreadTemplate', () => {
    it('plans "spread rug over table" as an extend, then a move of the new binding', () => {
        const result = summarize(matchSpreadTemplate(spreadSkeleton('spread', 'rug', 'over', 'table'), 'test command'))
        if (result.type !== 'matched') {
            throw new Error('expected a match')
        }
        const rug = { referentType: 'objectSpan', span: 'rug', stableRefKey: 'rugRef' }
        const [extend, move] = result.changes
        expect(extend).toEqual({ kind: 'change', primitive: 'extend', object: rug, presenceUuid: expect.any(String) })
        expect(move).toEqual({
            kind: 'change',
            primitive: 'transferMembership',
            object: { ...rug, view: [PresenceKey((extend as { presenceUuid: string }).presenceUuid)] },
            from: { referentType: 'currentHost', referentTarget: rug },
            to: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            containment: 'On',
        })
    })

    it.each([
        ['spread', 'onto', 'On'],
        ['spread', 'on', 'On'],
        ['drape', 'across', 'On'],
        ['drape', 'over', 'On'],
        ['spread', 'into', 'In'],
        ['drape', 'in', 'In'],
    ] as const)('plans "%s X %s Y" as a spread, kind %s', (verb, prep, containment) => {
        const result = summarize(matchSpreadTemplate(spreadSkeleton(verb, 'rug', prep, 'table'), 'test command'))
        expect(result).toMatchObject({ type: 'matched', changes: [{ primitive: 'extend' }, { primitive: 'transferMembership', containment }] })
    })

    it('authors one unit over the actor and both objects, before, from the verb form and the matched phrase', () => {
        const result = matchSpreadTemplate(spreadSkeleton('Drape', 'rug', 'partly over', 'table'), 'test command')
        if (result.type !== 'matched') {
            throw new Error('expected a match')
        }
        const [, move] = result.attempt.actions()
        expect(result.attempt.narrationUnits()).toEqual([{
            covers: [move!.id],
            variants: [{
                audience: { refs: ['actor', 'rugRef', 'tableRef'], phase: 'before' },
                parts: [{ slot: 'actor' }, { text: ' drapes ' }, { ref: 'rugRef' }, { text: ' over ' }, { ref: 'tableRef' }],
            }],
        }])
    })

    it('leaves put and place to the containment template, and does not lend it "over"', () => {
        expect(matchSpreadTemplate(spreadSkeleton('put', 'rug', 'on', 'table'), 'test command')).toEqual({ type: 'noMatch' })
        expect(matchContainmentTemplate(spreadSkeleton('put', 'rug', 'over', 'table'), 'test command')).toEqual({ type: 'noMatch' })
    })

    it('answers noMatch for an unknown preposition, a non-spreading verb, or another skeleton shape', () => {
        expect(matchSpreadTemplate(spreadSkeleton('spread', 'rug', 'beside', 'table'), 'test command')).toEqual({ type: 'noMatch' })
        expect(matchSpreadTemplate(spreadSkeleton('lay', 'rug', 'over', 'table'), 'test command')).toEqual({ type: 'noMatch' })
        expect(matchSpreadTemplate([
            { type: 'text', text: 'spread' },
            { type: 'objectSpan', span: 'rug', stableRefKey: 'rugRef' },
        ], 'test command')).toEqual({ type: 'noMatch' })
    })
})
