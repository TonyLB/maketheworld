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
    return planSkeleton(skeleton, COMMAND).attempts
}

describe('planSkeleton', () => {
    it('plans containment ahead of membership: "take the coin in the box" is a membership take, not a containment move', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ])
        expect(attempts).toHaveLength(1)
        expect(attempts[0].actions()[0].desiredResult).toMatchObject({
            primitive: 'transferMembership',
            from: { referentType: 'currentHost' },
            to: { referentType: 'actingCharacter' },
        })
        expect(attempts[0].actions()[0].desiredResult).not.toHaveProperty('containment')
    })

    it('plans nothing for "tie the rope in the box": no template claims it, so the zero-attempt branch answers', () => {
        expect(attemptsOf(relationalSkeleton('tie', 'rope', 'in', 'box'))).toEqual([])
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

    it('authors one unit per membership attempt: take and get read "picks up", drop reads "drops", before, over the actor and the object', () => {
        const unitFor = (verb: string) => {
            const [attempt] = attemptsOf([
                { type: 'text', text: verb },
                { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            ])
            return { actionId: attempt.actions()[0].id, units: attempt.narrationUnits() }
        }
        for (const [verb, text] of [['take', ' picks up '], ['get', ' picks up '], ['drop', ' drops ']] as const) {
            const { actionId, units } = unitFor(verb)
            expect(units).toEqual([{
                covers: [actionId],
                variants: [{
                    audience: { refs: ['actor', 'broomRef'], phase: 'before' },
                    parts: [{ slot: 'actor' }, { text }, { ref: 'broomRef' }],
                }],
            }])
        }
    })

    it('authors nothing for a look: describe is not narrated here', () => {
        const [look] = attemptsOf([
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ])
        expect(look.narrationUnits()).toEqual([])
    })

    it('plans take X off Y as membership acquire of X: the tail is ignored, and no relational attempt exists', () => {
        const attempts = attemptsOf(relationalSkeleton('take', 'rope', 'off', 'crate'))
        expect(attempts).toHaveLength(1)
        expect(attempts[0].actions()[0].desiredResult).toMatchObject({
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' },
            from: { referentType: 'currentHost' },
            to: { referentType: 'actingCharacter' },
        })
    })

    it.each([
        ['tie the rope to the pole', relationalSkeleton('tie', 'rope', 'to', 'pole')],
        ['lean the lamp against the wall', relationalSkeleton('lean', 'lamp', 'against', 'wall')],
        ['put the lamp under the table', relationalSkeleton('put', 'lamp', 'under', 'table')],
    ])('plans nothing for peer relation "%s": the zero-attempt branch answers Unimplemented', (_command, skeleton) => {
        expect(attemptsOf(skeleton)).toEqual([])
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
