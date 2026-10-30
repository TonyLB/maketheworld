import type { ParseSkeleton } from '../parse/parseToken'
import { matchTemplate } from './attemptTemplateFixture'
import { tieTemplate, untieTemplate } from './matchSecuredToTemplates'
import type { Change } from './planStep'

const matchTieTemplate = matchTemplate(tieTemplate)
const matchUntieTemplate = matchTemplate(untieTemplate)

const relationSkeleton = (verb: string, subjectSpan: string, link: string, targetSpan: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: `${subjectSpan}Ref` },
    { type: 'text', text: link },
    { type: 'objectSpan', span: targetSpan, stableRefKey: `${targetSpan}Ref` },
]

const rope = { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' }
const pole = { referentType: 'objectSpan', span: 'pole', stableRefKey: 'poleRef' }

const changeOf = (result: ReturnType<typeof matchTieTemplate>): Change => {
    if (result.type !== 'matched') {
        throw new Error('expected a match')
    }
    expect(result.attempt.kind).toBe('relation')
    const [action, ...rest] = result.attempt.actions()
    expect(rest).toEqual([])
    return action!.desiredResult as Change
}

describe('tieTemplate', () => {
    it('plans "tie rope to pole" as one assign of the tie triple, the Justifies naming both edges by ref, each ref minted', () => {
        const change = changeOf(matchTieTemplate(relationSkeleton('tie', 'rope', 'to', 'pole'), 'test command'))
        expect(change).toEqual({
            kind: 'change',
            primitive: 'assignEdgeRelations',
            entries: [
                { edgeRef: 'tyingEdge', from: rope, to: pole, relationKind: 'Custom', relationLabel: 'tied to' },
                { edgeRef: 'secureEdge', from: rope, to: pole, relationKind: 'SecuredTo' },
                { from: { edgeRef: 'tyingEdge' }, to: { edgeRef: 'secureEdge' }, relationKind: 'Justifies' },
            ],
            mintedEdgeIds: { tyingEdge: expect.any(String), secureEdge: expect.any(String) },
        })
    })

    it('authors one unit over the actor and both objects, before, from the closed verb form', () => {
        const result = matchTieTemplate(relationSkeleton('Tie', 'rope', 'to', 'pole'), 'test command')
        if (result.type !== 'matched') {
            throw new Error('expected a match')
        }
        const [action] = result.attempt.actions()
        expect(result.attempt.narrationUnits()).toEqual([{
            covers: [action!.id],
            variants: [{
                audience: { refs: ['actor', 'ropeRef', 'poleRef'], phase: 'before' },
                parts: [{ slot: 'actor' }, { text: ' ties ' }, { ref: 'ropeRef' }, { text: ' to ' }, { ref: 'poleRef' }],
            }],
        }])
    })

    it('claims no other verb or link: "lash rope to pole" and "tie rope on pole" are not ties', () => {
        expect(matchTieTemplate(relationSkeleton('lash', 'rope', 'to', 'pole'), 'test command')).toEqual({ type: 'noMatch' })
        expect(matchTieTemplate(relationSkeleton('tie', 'rope', 'on', 'pole'), 'test command')).toEqual({ type: 'noMatch' })
    })
})

describe('untieTemplate', () => {
    it('plans "untie rope from pole" as one dissolve of the tie triple, every entry optional, the Justifies first', () => {
        const change = changeOf(matchUntieTemplate(relationSkeleton('untie', 'rope', 'from', 'pole'), 'test command'))
        expect(change).toEqual({
            kind: 'change',
            primitive: 'dissolveEdgeRelations',
            entries: [
                { from: { edgeRef: 'tyingEdge' }, to: { edgeRef: 'secureEdge' }, relationKind: 'Justifies', mustBePresent: false },
                { edgeRef: 'secureEdge', from: rope, to: pole, relationKind: 'SecuredTo', mustBePresent: false },
                { edgeRef: 'tyingEdge', from: rope, to: pole, relationKind: 'Custom', relationLabel: 'tied to', mustBePresent: false },
            ],
        })
    })

    it('does not read "untie rope to pole"', () => {
        expect(matchUntieTemplate(relationSkeleton('untie', 'rope', 'to', 'pole'), 'test command')).toEqual({ type: 'noMatch' })
    })
})
