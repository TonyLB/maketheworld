//
// The checks over the registry that a piece's view keeps (AGENT.pieceViews.planning.md, step 1): each view names only known kinds and
// readings; the checker's mirror (a piece whose merge can confirm an unchecked item of a kind reads that kind at `all`); and the
// hidden-refusal invariant (a piece's merge never refuses a block on account of anything its view hides). Each check is a function, run
// over the registry and over a piece built to break it, so a check that can't fail is caught too.
//
import {
    mergeStepChanges, planSteps, REPLACEABLE, STEP_ITEM_KINDS, viewPlan, type ActionPlan, type AuthoredKind, type MergeOptions, type PlanView,
} from '../oracleLoop/actionPlan'
import type { RegisteredPiece } from './oraclePiece'
import { pieces } from './pieces'

const registered: [string, RegisteredPiece][] = Object.entries(pieces).flatMap(([name, entry]): [string, RegisteredPiece][] => (
    entry.kind === 'family' ? Object.entries(entry.stages).map(([stage, piece]): [string, RegisteredPiece] => [`${name}/${stage}`, piece]) : [[name, entry]]
))

const KINDS: readonly AuthoredKind[] = [...STEP_ITEM_KINDS, 'rule']

/** A view's problems as declared: a kind that isn't one, or a reading that isn't `all` or `authoritative`. */
const declarationProblems = ({ reads }: PlanView): string[] => Object.entries(reads).flatMap(([kind, reading]) => [
    ...((KINDS as readonly string[]).includes(kind) ? [] : [`reads "${kind}", not a plan kind`]),
    ...(reading === 'all' || reading === 'authoritative' ? [] : [`reads ${kind} at "${String(reading)}"`]),
])

/**
 * The kinds a merge can confirm an unchecked item of, read from its options: those `replace` takes (`replaces`), and the intent, which
 * a restatement as written confirms (`restates`).
 */
const confirmable = ({ replaces = false, restates = false }: MergeOptions): AuthoredKind[] => [...(replaces ? REPLACEABLE : []), ...(restates ? ['intent' as const] : [])]

/** The mirror's problems: each kind the merge can confirm, read at less than `all`. */
const mirrorProblems = ({ reads }: PlanView, merges: MergeOptions): string[] =>
    confirmable(merges).flatMap((kind) => (reads[kind] === 'all' ? [] : [`can confirm a ${kind} but reads it ${reads[kind] === undefined ? 'not at all' : `at ${reads[kind]}`}`]))

const merged = (plan: ActionPlan, target: string, changes: unknown[], options: MergeOptions): ActionPlan => {
    const result = mergeStepChanges(plan, target, { changes }, [], options)
    if ('problems' in result) {
        throw new Error(result.problems.join('; '))
    }
    return result.plan
}

const HIDDEN_RULE = 'hidden-secured-to-thing'

/** A plan with one unchecked item of every kind added to its target: a consequence with its rule, a possibility and a concern, as a proposer's. */
const withEveryKind = (plan: ActionPlan, target: string): ActionPlan => merged(plan, target, [
    { add: 'consequence', says: '[hidden1] slides', rules: [{ rule: HIDDEN_RULE, stance: 'violation' }] },
    { add: 'possibility', kind: 'execution', says: 'the hidden grip holds', branches: [[], [{ says: '[hidden1] drops' }]] },
    { add: 'concern', says: 'the hidden thing may fall' },
], { author: 'playByPlay', adds: ['consequence', 'possibility', 'concern'], rules: [HIDDEN_RULE] })

/** The blocks a merge's options admit, one change each, aimed at a step it would see: those whose refusal could read what the plan holds. */
const blocksFor = (step: { says: string; items: readonly { kind: string }[] }, { adds = ['consequence', 'concern', 'possibility'], restates = false }: MergeOptions): [string, unknown][] => [
    ...(restates ? [
        ['a restatement as written', { restate: 'step', says: step.says, answered: 'a detail' }],
        ['a revision', { restate: 'step', says: step.says, intent: 'a new intent', answered: 'a detail' }],
    ] as [string, unknown][] : []),
    ...(adds.includes('steps') && !step.items.some(({ kind }) => kind === 'step') ? [['an expansion', { add: 'steps', steps: [{ says: 'a first motion' }, { says: 'a second motion' }] }]] as [string, unknown][] : []),
    ...(adds.includes('consequence') ? [
        ['a consequence', { add: 'consequence', says: 'something moves' }],
        ['a repeat of the hidden consequence', { add: 'consequence', says: '[hidden1] slides' }],
    ] as [string, unknown][] : []),
    ...(adds.includes('possibility') ? [['a possibility', { add: 'possibility', kind: 'execution', says: 'it holds', branches: [[], []] }]] as [string, unknown][] : []),
    ...(adds.includes('concern') ? [['a concern', { add: 'concern', says: 'it may fall' }]] as [string, unknown][] : []),
]

/** A cell's plan and target, where its inputs carry them. */
const planCell = (inputs: unknown): { plan: ActionPlan; target: string }[] => {
    const { plan, target } = (typeof inputs === 'object' && inputs !== null ? inputs : {}) as { plan?: ActionPlan; target?: string }
    return plan !== undefined && typeof target === 'string' ? [{ plan, target }] : []
}

/**
 * The invariant's breaches for a view and merge over the cells' plans: each block that merges into the plan as the view reads it but is
 * refused on the full plan (or the other way round), with a hidden item of every kind on the target.
 */
const hiddenRefusals = (view: PlanView, merges: MergeOptions, cells: readonly unknown[]): string[] =>
    cells.flatMap(planCell).flatMap(({ plan, target }) => {
        const full = withEveryKind(plan, target)
        const seen = viewPlan(full, view)
        const step = planSteps(full).find(({ path }) => path === target)
        return step === undefined ? [`${target}: no such step`] : blocksFor(step, merges).flatMap(([label, change]) => {
            const onFull = 'problems' in mergeStepChanges(full, target, { changes: [change] }, [], merges)
            const onSeen = 'problems' in mergeStepChanges(seen, target, { changes: [change] }, [], merges)
            return onFull === onSeen ? [] : [`${target}, ${label}: ${onFull ? 'refused on the full plan only' : 'refused on the viewed plan only'}`]
        })
    })

describe('piece views over the registry (AGENT.pieceViews.planning.md)', () => {
    it.each(registered)('%s declares a view of known kinds and readings', (_, piece) => {
        expect(declarationProblems(piece.view.plan)).toEqual([])
    })

    it('catches a view that is declared wrong', () => {
        expect(declarationProblems({ reads: { consequences: 'all', intent: 'some' } as unknown as PlanView['reads'] })).toEqual(['reads "consequences", not a plan kind', 'reads intent at "some"'])
    })

    const merging = registered.flatMap(([id, piece]): [string, PlanView, MergeOptions, unknown[]][] => (
        piece.kind === 'read' && piece.merges !== undefined ? [[id, piece.view.plan, piece.merges, Object.values(piece.cells).map(({ inputs }) => inputs)]] : []
    ))

    it('has pieces that merge, so the checks below run', () => {
        expect(merging.map(([id]) => id)).toEqual(expect.arrayContaining(['playByPlay', 'consequences']))
    })

    describe('the checker\'s mirror: a piece whose merge can confirm an unchecked kind reads it at all, stale items included', () => {
        it.each(merging)('%s', (_, view, merges) => {
            expect(mirrorProblems(view, merges)).toEqual([])
        })

        it('binds playByPlay today: it restates, so it reads the intent at all', () => {
            expect(confirmable(pieces.playByPlay.kind === 'read' ? pieces.playByPlay.merges ?? { author: 'playByPlay' } : { author: 'playByPlay' })).toEqual(['intent'])
        })

        it('catches a checker that can\'t see what it confirms', () => {
            expect(mirrorProblems({ reads: { consequence: 'authoritative', intent: 'all' } }, { author: 'consequences', replaces: true, restates: true })).toEqual([
                'can confirm a consequence but reads it at authoritative', 'can confirm a rule but reads it not at all',
            ])
        })
    })

    describe('a piece\'s merge never refuses a block on account of anything its view hides', () => {
        it.each(merging)('%s', (_, view, merges, cells) => {
            expect(hiddenRefusals(view, merges, cells)).toEqual([])
        })

        it('catches a merge that would: a possibility it can add, beside one it can\'t see', () => {
            const [, view, merges, cells] = merging.find(([id]) => id === 'playByPlay') ?? []
            if (view === undefined || merges === undefined || cells === undefined) {
                throw new Error('playByPlay merges')
            }
            expect(hiddenRefusals(view, { ...merges, adds: [...(merges.adds ?? []), 'possibility'] }, cells.slice(0, 1))).toEqual(['pick-up-table1, a possibility: refused on the full plan only'])
        })
    })
})
