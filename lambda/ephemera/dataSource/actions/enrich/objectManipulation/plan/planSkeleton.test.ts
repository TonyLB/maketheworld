import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
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

const actionKinds = (attempt: CommandAttempt) => attempt.actions().map((action) => action.desiredResult?.kind)

describe('planSkeleton', () => {
    it('plans "take the coin in the box" as membership takes, not a containment move: the qualified reading checks the coin, then takes it', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ])
        // Two readings: the plain take leaves the box unread (the producer's gate drops it), and the qualified take.
        expect(attempts.map(actionKinds)).toEqual([['change'], ['assertion', 'change']])
        const [check, take] = attempts[1].actions().map((action) => action.desiredResult)
        expect(check).toEqual({
            kind: 'assertion',
            predicate: 'containedBy',
            subject: { referentType: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            object: { referentType: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
            negate: false,
            relation: 'In',
        })
        expect(take).toMatchObject({
            primitive: 'transferMembership',
            from: { referentType: 'currentHost' },
            to: { referentType: 'actingCharacter' },
        })
        expect(take).not.toHaveProperty('containment')
        // The check is judged, not narrated: only the take is covered.
        expect(attempts[1].narrationUnits().flatMap(({ covers }) => covers)).toEqual([attempts[1].actions()[1]!.id])
    })

    it('plans "drop the cup in the box" as a plain drop and a qualified one: the verb does not decide the reading', () => {
        const attempts = attemptsOf(relationalSkeleton('drop', 'cup', 'in', 'box'))
        expect(attempts.map(actionKinds)).toEqual([['change'], ['assertion', 'change']])
        expect(attempts[1].actions()[0].desiredResult).toMatchObject({ kind: 'assertion', subject: { span: 'cup' }, object: { span: 'box' } })
    })

    it('plans "take cup on saucer on table" as one take per reading, and the reading of every span checks both qualifiers, right-nested', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ])
        expect(attempts.map(actionKinds)).toEqual([['change'], ['assertion', 'change'], ['assertion', 'assertion', 'change']])
        const [cupOnSaucer, saucerOnTable] = attempts[2].actions().map((action) => action.desiredResult)
        expect(cupOnSaucer).toMatchObject({ subject: { span: 'cup' }, object: { span: 'saucer' }, relation: 'On' })
        expect(saucerOnTable).toMatchObject({ subject: { span: 'saucer' }, object: { span: 'table' }, relation: 'On' })
    })

    it('plans "put cup on saucer on table" as one containment move per reading: onto the saucer on the table, or the cup on the saucer onto the table', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ])
        const spanOf = (referent: object) => ('span' in referent ? referent.span : '?')
        const readings = attempts.map((attempt) => attempt.actions().map(({ desiredResult }) => (
            desiredResult?.kind === 'assertion'
                ? `check ${spanOf(desiredResult.subject)} on ${spanOf(desiredResult.object)}`
                : desiredResult?.kind === 'change' && desiredResult.primitive === 'transferMembership'
                    ? `move ${spanOf(desiredResult.object)} to ${spanOf(desiredResult.to)}`
                    : 'other'
        )))
        expect(readings.sort()).toEqual([
            ['check cup on saucer', 'move cup to table'],
            ['check saucer on table', 'move cup to saucer'],
        ])
    })

    it('plans "spread the rug over the table" as one spread: an extend, then a containment move of the new binding', () => {
        const attempts = attemptsOf(relationalSkeleton('spread', 'rug', 'over', 'table'))
        expect(attempts).toHaveLength(1)
        const [extend, move] = attempts[0].actions().map((action) => action.desiredResult)
        expect(extend).toMatchObject({ primitive: 'extend', object: { span: 'rug' } })
        expect(move).toMatchObject({
            primitive: 'transferMembership',
            object: { span: 'rug', view: [PresenceKey((extend as { presenceUuid: string }).presenceUuid)] },
            from: { referentType: 'currentHost' },
            to: { referentType: 'objectSpan', span: 'table' },
            containment: 'On',
        })
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

    it('plans take X off Y as membership acquire of X, checked to be on Y, and no relational attempt exists', () => {
        const attempts = attemptsOf(relationalSkeleton('take', 'rope', 'off', 'crate'))
        expect(attempts.map(actionKinds)).toEqual([['change'], ['assertion', 'change']])
        expect(attempts[1].actions()[0].desiredResult).toMatchObject({ kind: 'assertion', relation: 'On', object: { span: 'crate' } })
        expect(attempts[1].actions()[1].desiredResult).toMatchObject({
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
