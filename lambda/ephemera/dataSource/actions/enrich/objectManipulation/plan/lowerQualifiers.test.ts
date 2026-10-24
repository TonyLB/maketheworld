import { CommandAttempt } from '../../../commandAttempt'
import type { ObjectSpanToken, ParseSkeleton, QualifierPreposition } from '../parse/parseToken'
import { lowerQualifiers } from './lowerQualifiers'
import { matchTemplate } from './attemptTemplateFixture'
import { containmentTemplate } from './matchContainmentTemplate'
import { membershipTemplate } from './matchMembershipTemplate'

const matchContainmentTemplate = matchTemplate(containmentTemplate)
const matchMembershipTemplate = matchTemplate(membershipTemplate)

const span = (text: string, qualifier?: ObjectSpanToken['qualifier']): ObjectSpanToken => ({
    type: 'objectSpan',
    span: text,
    stableRefKey: `${text}Ref`,
    ...(qualifier !== undefined ? { qualifier } : {}),
})

const groupedTake = (preposition: QualifierPreposition): ParseSkeleton => [
    { type: 'text', text: 'get' },
    span('cup', { preposition, span: span('table') }),
]

const membershipAttempt = (reading: ParseSkeleton): CommandAttempt => {
    const match = matchMembershipTemplate(reading, 'test command')
    if (match.type !== 'matched') {
        throw new Error('membership template did not match')
    }
    return match.attempt
}

describe('lowerQualifiers', () => {
    it.each<[QualifierPreposition, 'On' | 'In' | undefined]>([
        ['on', 'On'],
        ['off', 'On'],
        ['out of', 'In'],
        ['from', undefined],
    ])('puts containedBy(cup, table) ahead of a take qualified by "%s", recording relation %s', (preposition, relation) => {
        const reading = groupedTake(preposition)
        const take = membershipAttempt(reading)

        const lowered = lowerQualifiers(take, reading)

        const [check, primary] = lowered.actions()
        expect(lowered.actions()).toHaveLength(2)
        expect(check!.desiredResult).toEqual({
            kind: 'assertion',
            predicate: 'containedBy',
            subject: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            object: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            negate: false,
            ...(relation !== undefined ? { relation } : {}),
        })
        expect(primary).toBe(take.actions()[0])
        expect(lowered.narrationUnits()).toEqual(take.narrationUnits())
        expect(lowered.words).toBe(take.words)
    })

    it('lowers for any verb: a qualified subject of a containment move gets the same check ahead of the move', () => {
        // Grouping never qualifies a put today; the lowering does not ask which template built the attempt.
        const reading: ParseSkeleton = [
            { type: 'text', text: 'put' },
            span('cup', { preposition: 'from', span: span('shelf') }),
            { type: 'text', text: 'on' },
            span('tray'),
        ]
        const match = matchContainmentTemplate(reading, 'put the cup from the shelf on the tray')
        if (match.type !== 'matched') {
            throw new Error('containment template did not match')
        }

        const lowered = lowerQualifiers(match.attempt, reading)

        expect(lowered.actions().map((action) => action.desiredResult)).toEqual([
            expect.objectContaining({ kind: 'assertion', subject: expect.objectContaining({ span: 'cup' }), object: expect.objectContaining({ span: 'shelf' }) }),
            expect.objectContaining({ primitive: 'transferMembership', containment: 'On' }),
        ])
    })

    it('returns the attempt as it is when no span it names is qualified', () => {
        const reading: ParseSkeleton = [{ type: 'text', text: 'get' }, span('cup')]
        const take = membershipAttempt(reading)

        expect(lowerQualifiers(take, reading)).toBe(take)
    })

    it('lowers a qualified qualifier to a second check, on the host', () => {
        const reading: ParseSkeleton = [
            { type: 'text', text: 'take' },
            span('cup', { preposition: 'on', span: span('saucer', { preposition: 'on', span: span('table') }) }),
        ]

        const lowered = lowerQualifiers(membershipAttempt(reading), reading)

        expect(lowered.actions().map((action) => action.desiredResult)).toEqual([
            expect.objectContaining({ kind: 'assertion', subject: expect.objectContaining({ span: 'cup' }), object: expect.objectContaining({ span: 'saucer' }) }),
            expect.objectContaining({ kind: 'assertion', subject: expect.objectContaining({ span: 'saucer' }), object: expect.objectContaining({ span: 'table' }) }),
            expect.objectContaining({ primitive: 'transferMembership' }),
        ])
    })

    it('survives the JSON round trip a Consult root stores', () => {
        const reading = groupedTake('on')
        const lowered = lowerQualifiers(membershipAttempt(reading), reading)

        expect(CommandAttempt.fromJSON(lowered.toJSON()).toJSON()).toEqual(lowered.toJSON())
    })
})
