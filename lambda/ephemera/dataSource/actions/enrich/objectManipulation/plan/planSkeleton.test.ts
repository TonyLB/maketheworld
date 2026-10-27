import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { ParseSkeleton } from '../parse/parseToken'
import type { CommandAttempt } from '../../../commandAttempt'
import { tokenize } from '../../../deterministicTemplate/granuleTokens'
import { planFillOf } from './attemptTemplateFixture'
import { isBareExitFill } from './matchNavigationTemplate'
import { COMMAND_GRANULES, LIVE_TEMPLATE_SET, planTokens } from './planSkeleton'
import { planSkeleton } from './attemptTemplateFixture'
import { membershipTemplate } from './matchMembershipTemplate'
import { templateSetOf } from './templateSet'

const COMMAND = 'test command'

const relationalSkeleton = (verb: string, subjectSpan: string, prep: string, targetSpan: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: `${subjectSpan}Ref` },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: `${targetSpan}Ref` },
]

/** The attempts Plan reads from the skeleton's segmentation of its words: one fill. */
const attemptsOf = (skeleton: ParseSkeleton) => planFillOf(skeleton, COMMAND).attempts

/** Every attempt Plan reads from the skeleton's words, whatever the segmentation. */
const allAttemptsOf = (skeleton: ParseSkeleton) => planSkeleton(skeleton, COMMAND).fills.flatMap(({ attempts }) => attempts)

/** The kinds of every reading but the bare exit one, which fits every command (`isBareExitFill`). */
const templateKindsOf = (skeleton: ParseSkeleton) => planSkeleton(skeleton, COMMAND).fills
    .filter((fill) => !isBareExitFill(fill))
    .flatMap(({ attempts }) => attempts.map(({ kind }) => kind))

/** Plan's fills for a command, each as its segmentation on one line. */
const segmentationsOf = (command: string) => planTokens(tokenize(COMMAND_GRANULES, command), command)
    .map(({ skeleton }) => skeleton.map((token) => (token.type === 'objectSpan' ? `[${token.span}]` : token.text)).join(' '))

const actionKinds = (attempt: CommandAttempt) => attempt.actions().map((action) => action.desiredResult?.kind)

describe('planSkeleton', () => {
    it('gives each attempt its template\'s kind, qualifiers lowered or not', () => {
        const kindsOf = (command: string) => [...new Set(planTokens(tokenize(COMMAND_GRANULES, command), command).flatMap(({ attempts }) => attempts.map(({ kind }) => kind)))].sort()
        // Every command also reads as a bare exit name: a navigation.
        expect(kindsOf('take cup on table')).toEqual(['membership', 'navigation'])
        expect(kindsOf('drop cup in box')).toEqual(['containment', 'membership', 'navigation'])
        expect(kindsOf('spread cloth over table')).toEqual(['navigation', 'spread'])
        expect(kindsOf('look at cup on table')).toEqual(['look', 'navigation'])
        expect(kindsOf('go north')).toEqual(['navigation'])
    })

    it('plans "take the coin in the box" as membership takes, not a containment move: the qualified reading checks the coin, then takes it', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'coin', stableRefKey: 'coinRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ])
        // This segmentation's one reading is the qualified take; the plain take reads `coin in box` as one span, another segmentation.
        expect(attempts.map(actionKinds)).toEqual([['assertion', 'change']])
        const [check, take] = attempts[0].actions().map((action) => action.desiredResult)
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
        expect(attempts[0].narrationUnits().flatMap(({ covers }) => covers)).toEqual([attempts[0].actions()[1]!.id])
    })

    it('plans "drop the cup in the box" as a containment move and a qualified drop: the verb does not decide the reading', () => {
        const attempts = attemptsOf(relationalSkeleton('drop', 'cup', 'in', 'box'))
        expect(attempts.map(actionKinds)).toEqual([['change'], ['assertion', 'change']])
        expect(attempts[0].actions()[0].desiredResult).toMatchObject({ primitive: 'transferMembership', containment: 'In' })
        expect(attempts[1].actions()[0].desiredResult).toMatchObject({ kind: 'assertion', subject: { span: 'cup' }, object: { span: 'box' } })
        expect(attempts[1].actions()[1].desiredResult).not.toHaveProperty('containment')
    })

    it('plans "drop the cup in the box"\'s containment move from the actor, not wherever the cup is, narrated "drops"', () => {
        const [move] = attemptsOf(relationalSkeleton('drop', 'cup', 'in', 'box'))
        expect(move.actions()[0].desiredResult).toEqual({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            from: { referentType: 'actingCharacter' },
            to: { referentType: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
            containment: 'In',
        })
        expect(move.narrationUnits()[0].variants[0].parts).toEqual([
            { slot: 'actor' },
            { text: ' drops ' },
            { ref: 'cupRef' },
            { text: ' in ' },
            { ref: 'boxRef' },
        ])
    })

    it('plans "take cup on saucer on table" with every span its own as the take checking both qualifiers, right-nested', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ])
        expect(attempts.map(actionKinds)).toEqual([['assertion', 'assertion', 'change']])
        const [cupOnSaucer, saucerOnTable] = attempts[0].actions().map((action) => action.desiredResult)
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

    it('plans "put cup on table in box" with the phrase on either side: the cup on the table into the box, or the cup onto the table in the box', () => {
        const attempts = attemptsOf([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ])
        const spanOf = (referent: object) => ('span' in referent ? referent.span : '?')
        const readings = attempts.map((attempt) => attempt.actions().map(({ desiredResult }) => (
            desiredResult?.kind === 'assertion'
                ? `check ${spanOf(desiredResult.subject)} ${desiredResult.relation === 'In' ? 'in' : 'on'} ${spanOf(desiredResult.object)}`
                : desiredResult?.kind === 'change' && desiredResult.primitive === 'transferMembership'
                    ? `move ${spanOf(desiredResult.object)} to ${spanOf(desiredResult.to)}`
                    : 'other'
        )))
        expect(readings.sort()).toEqual([
            ['check cup on table', 'move cup to box'],
            ['check table in box', 'move cup to table'],
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

    it('plans only the bare exit reading for "tie the rope in the box": no other template claims it', () => {
        expect(templateKindsOf(relationalSkeleton('tie', 'rope', 'in', 'box'))).toEqual([])
        expect(allAttemptsOf(relationalSkeleton('tie', 'rope', 'in', 'box')).map(({ kind }) => kind)).toEqual(['navigation'])
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
        expect(attempts.map(actionKinds)).toEqual([['assertion', 'change']])
        expect(attempts[0].actions()[0].desiredResult).toMatchObject({ kind: 'assertion', relation: 'On', object: { span: 'crate' } })
        expect(attempts[0].actions()[1].desiredResult).toMatchObject({
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
    ])('plans only the bare exit reading for peer relation "%s": the LLM route answers Unimplemented', (_command, skeleton) => {
        expect(templateKindsOf(skeleton)).toEqual([])
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

    it('returns no attempts but the bare exit reading for a skeleton no other template claims', () => {
        expect(templateKindsOf([{ type: 'text', text: 'balance' }, { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' }])).toEqual([])
    })
})

describe('planTokens', () => {
    it('reads every segmentation of the command: each closed-set preposition is a link or inside a span', () => {
        expect(segmentationsOf('take cup on saucer on table').sort()).toEqual([
            '[take cup on saucer on table]',
            'take [cup on saucer on table]',
            'take [cup on saucer] on [table]',
            'take [cup] on [saucer on table]',
            'take [cup] on [saucer] on [table]',
        ])
    })

    it('reads a template\'s own fixed word inside a span: the plain look reads "at cup"', () => {
        const fills = planTokens(tokenize(COMMAND_GRANULES, 'look at cup'), 'look at cup')
        expect(fills.map(({ skeleton }) => skeleton.map((token) => (token.type === 'objectSpan' ? `[${token.span}]` : token.text)).join(' '))).toEqual([
            'look [at cup]',
            'look at [cup]',
            '[look at cup]',
        ])
    })

    it('gives one span occurrence the same key in every fill, and two occurrences of one text two keys', () => {
        const command = 'put bench on table on bench'
        const keysOf = (span: string) => [...new Set(planTokens(tokenize(COMMAND_GRANULES, command), command)
            .flatMap(({ skeleton }) => skeleton.flatMap((token) => (token.type === 'objectSpan' && token.span === span ? [token.stableRefKey] : []))))]
        expect(keysOf('bench').sort()).toEqual(['benchRef1', 'benchRef2'])
        expect(keysOf('table')).toEqual(['tableRef'])
        expect(keysOf('table on bench')).toEqual(['tableOnBenchRef'])
    })

    it('reads a command with more than six closed-set prepositions not at all (the guard cap)', () => {
        const atCap = 'take a on b on c on d on e on f on g'
        expect(planTokens(tokenize(COMMAND_GRANULES, atCap), atCap)).not.toEqual([])
        const overCap = `${atCap} on h`
        expect(planTokens(tokenize(COMMAND_GRANULES, overCap), overCap)).toEqual([])
    })
})

describe('a supplied template set', () => {
    const command = 'take pig in a blanket'
    const kindsOf = (templates = LIVE_TEMPLATE_SET) => planTokens(tokenize(templates.granules, command), command, templates)
        .flatMap(({ attempts }) => attempts.map(({ kind }) => kind))

    it('is the live set by default', () => {
        expect(planTokens(tokenize(COMMAND_GRANULES, command), command)).toHaveLength(planTokens(tokenize(LIVE_TEMPLATE_SET.granules, command), command, LIVE_TEMPLATE_SET).length)
    })

    it('replaces it: only its templates read the command, cut at only its fixed words', () => {
        const only = templateSetOf([membershipTemplate])
        expect(kindsOf(only)).toEqual(['membership', 'membership'])
        expect(kindsOf(only)).not.toContain('navigation')
        expect(kindsOf(templateSetOf([]))).toEqual([])
        expect(only.granules.granules.flat()).not.toContain('under')
    })
})
