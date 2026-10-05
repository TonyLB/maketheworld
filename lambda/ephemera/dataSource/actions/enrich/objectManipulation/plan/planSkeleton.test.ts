import type { ParseSkeleton } from '../parse/parseToken'
import { planSkeleton } from './planSkeleton'

const COMMAND = 'test command'

const relationalSkeleton = (verb: string, subjectSpan: string, prep: string, targetSpan: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: `${subjectSpan}Ref` },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: `${targetSpan}Ref` },
]

const attemptsOf = (skeleton: ParseSkeleton) => {
    const result = planSkeleton(skeleton, COMMAND)
    if (result.type !== 'attempts') {
        throw new Error(`expected attempts, got ${result.errorMessage}`)
    }
    return result.attempts
}

describe('planSkeleton', () => {
    it('plans a peer relation as one establishRelation step, with no referents yet', () => {
        const [primary] = attemptsOf(relationalSkeleton('put', 'broom', 'against', 'table'))
        const [action] = primary.actions()
        expect(action.desiredResult).toEqual({
            kind: 'change',
            primitive: 'establishRelation',
            subject: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            target: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            relationKind: 'Against',
        })
        expect(primary.referents()).toEqual([])
    })

    it('plans put-in and put-on as the containment transfer, flagged with its containment', () => {
        const [primary] = attemptsOf(relationalSkeleton('put', 'coin', 'in', 'jar'))
        expect(primary.actions()[0].desiredResult).toEqual({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' } },
            to: { referentType: 'objectSpan', span: 'jar', stableRefKey: 'jarRef' },
            containment: 'In',
        })
    })

    it('plans "partof" as a Custom relation: no player phrase reaches PartOf (relationKind.ts), so the declined path is typed only', () => {
        const [primary] = attemptsOf(relationalSkeleton('put', 'coin', 'partof', 'jar'))
        expect(primary.actions()[0].desiredResult).toMatchObject({
            primitive: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'partof',
        })
    })

    it('plans a leading take as membership acquire, a leading drop as release', () => {
        const [take] = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ])
        expect(take.actions()[0].desiredResult).toMatchObject({
            primitive: 'transferMembership',
            from: { referentType: 'currentHost' },
            to: { referentType: 'actingCharacter' },
        })

        const [drop] = attemptsOf([
            { type: 'text', text: 'drop' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ])
        expect(drop.actions()[0].desiredResult).toMatchObject({
            primitive: 'transferMembership',
            from: { referentType: 'actingCharacter' },
            to: { referentType: 'currentHost' },
        })
    })

    it('keeps the relational attempt primary for take X off Y, ahead of the membership attempt', () => {
        const attempts = attemptsOf(relationalSkeleton('take', 'rope', 'off', 'crate'))
        expect(attempts.length).toBeGreaterThan(0)
        expect(attempts[0].actions()[0].desiredResult).toMatchObject({ primitive: 'dissolveRelation' })
    })

    it('plans a look as one narration whose action names the referent', () => {
        const [primary] = attemptsOf([
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        ])
        const [action] = primary.actions()
        expect(action.desiredResult).toBeUndefined()
        expect(action.referents()).toEqual([
            { referentType: 'objectSpan', span: 'rocket skates', stableRefKey: 'rocketSkatesRef' },
        ])
    })

    it('returns no attempts for a skeleton no template claims', () => {
        expect(attemptsOf([{ type: 'text', text: 'balance' }, { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' }])).toEqual([])
    })

})
