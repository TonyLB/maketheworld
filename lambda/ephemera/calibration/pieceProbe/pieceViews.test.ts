//
// The checks over the registry that a piece's view keeps (calibration AGENT.md, "Piece views"): each view names only known kinds and
// readings, and known scene settings, which its render keeps and its default options agree with; the checker's mirror (a piece whose merge
// can alter an unchecked item of a kind reads that kind at `all`); the hidden-refusal invariant (a piece's merge never refuses a block on
// account of anything its view hides); and the merge's own (an unchecked item never refuses a change, and only its authority alters a
// confirmed one). Each check is a function, run over the registry and over a piece or a merge built to break it, so a check that can't fail
// is caught too.
//
import {
    AUTHORITY, expansionClosed, mergeStepChanges, planOf, planSteps, REPLACEABLE, rewordingClosed, RULE_STANCES, STEP_ITEM_KINDS, viewPlan,
    type ActionPlan, type AuthoredKind, type MergeOptions, type PlanAuthor, type PlanView, type StepItem, type StepNode,
} from '../oracleLoop/actionPlan'
import { securingWords } from '../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import { registerPiece, type RegisteredPiece } from './oraclePiece'
import { pieces } from './pieces'
import { RULE_PARTS, SCENE_SHOWS, SECURINGS, type SceneView } from './sceneRenders'

const registered: [string, RegisteredPiece][] = Object.entries(pieces).flatMap(([name, entry]): [string, RegisteredPiece][] => (
    entry.kind === 'family' ? Object.entries(entry.stages).map(([stage, piece]): [string, RegisteredPiece] => [`${name}/${stage}`, piece]) : [[name, entry]]
))

const KINDS: readonly AuthoredKind[] = [...STEP_ITEM_KINDS, 'rule', 'improvise']

const isReading = (reading: unknown): boolean => reading === 'all' || reading === 'authoritative'

/** How a reading prints: its word, or its word and the stances it narrows to. */
const readingWords = (reading: unknown): string => {
    if (typeof reading === 'object' && reading !== null) {
        const { reading: word, stances } = reading as { reading?: unknown; stances?: unknown }
        return `${String(word)} (${Array.isArray(stances) ? stances.join(', ') : String(stances)})`
    }
    return String(reading)
}

/** A stance-narrowed reading's problems: on the rule kind, a reading, and at least one known stance. */
const stanceReadingProblems = (kind: string, { reading, stances }: { reading?: unknown; stances?: unknown }): string[] => [
    ...(kind === 'rule' ? [] : [`narrows ${kind} by stance, which only the rule kind takes`]),
    ...(isReading(reading) ? [] : [`reads ${kind} at "${String(reading)}"`]),
    ...(Array.isArray(stances) && stances.length > 0 ? [] : [`narrows ${kind} to no stance`]),
    ...(Array.isArray(stances) ? stances.filter((stance) => !(RULE_STANCES as readonly unknown[]).includes(stance)).map((stance) => `narrows ${kind} to "${String(stance)}", not a stance`) : []),
]

/**
 * A view's problems as declared: a kind that isn't one, a reading that isn't `all` or `authoritative`, or a stance filter off the rule
 * kind, empty, or naming a stance that isn't one.
 */
const declarationProblems = ({ reads }: PlanView): string[] => Object.entries(reads).flatMap(([kind, reading]: [string, unknown]) => [
    ...((KINDS as readonly string[]).includes(kind) ? [] : [`reads "${kind}", not a plan kind`]),
    ...(typeof reading === 'object' && reading !== null ? stanceReadingProblems(kind, reading) : isReading(reading) ? [] : [`reads ${kind} at "${String(reading)}"`]),
])

/**
 * The kinds whose unchecked items a merge can alter, read from its options: those `replace` takes (`replaces`); and each slot it may
 * overwrite, or confirm as written: a step's words and its intent (`restates`), its sub-steps, its possibility, an improvised thing's gloss.
 */
const alterable = ({ replaces = false, restates = false, adds = ['consequence', 'concern', 'possibility'] }: MergeOptions): AuthoredKind[] => [...new Set<AuthoredKind>([
    ...(replaces ? REPLACEABLE : []),
    ...(restates ? ['step' as const, 'intent' as const] : []),
    ...(adds.includes('steps') ? ['step' as const] : []),
    ...(adds.includes('possibility') ? ['possibility' as const] : []),
    ...(adds.includes('improvise') ? ['improvise' as const] : []),
])]

/** The mirror's problems: each kind the merge can alter, read at less than `all`, a stance filter included (a checker sees every stance). */
const mirrorProblems = ({ reads }: PlanView, merges: MergeOptions): string[] =>
    alterable(merges).flatMap((kind) => (reads[kind] === 'all' ? [] : [`can alter a ${kind} but reads it ${reads[kind] === undefined ? 'not at all' : `at ${readingWords(reads[kind])}`}`]))

const merged = (plan: ActionPlan, target: string, changes: unknown[], options: MergeOptions): ActionPlan => {
    const result = mergeStepChanges(plan, target, { changes }, [], options)
    if ('problems' in result) {
        throw new Error(result.problems.join('; '))
    }
    return result.plan
}

const HIDDEN_RULE = 'hidden-secured-to-thing'

const hiddenItems = [
    { add: 'consequence', says: '[hidden1] slides', rules: [{ rule: HIDDEN_RULE, stance: 'violation' }] },
    { add: 'possibility', kind: 'execution', says: 'the hidden grip holds', branches: [[], [{ says: '[hidden1] drops' }]] },
    { add: 'concern', says: 'the hidden thing may fall' },
]

const HIDDEN_THING = { add: 'improvise', handle: 'hidden-tool1', gloss: 'a hidden tool' }

/** A plan with one item of every kind added, to its target or (a thing improvised) beside its steps, each at one standing: a proposer's (`unchecked`), or each kind's authority's. */
const withEveryKind = (plan: ActionPlan, target: string, standing: 'unchecked' | 'confirmed'): ActionPlan => {
    if (standing === 'unchecked') {
        return merged(plan, target, [...hiddenItems, HIDDEN_THING], { author: 'triage', adds: ['consequence', 'possibility', 'concern', 'improvise'], rules: [HIDDEN_RULE] })
    }
    const improvised = merged(plan, target, [HIDDEN_THING], { author: 'improvisation', adds: ['improvise'] })
    const confirmed = merged(improvised, target, hiddenItems.map(({ rules: _, ...rest }) => rest), { author: 'consequences' })
    return merged(confirmed, target, [hiddenItems[0]], { author: 'ruleCell', adds: ['consequence'], rules: [HIDDEN_RULE] })
}

/**
 * A plan's target with unchecked sub-steps, where it has none: a proposer's expansion, one of them holding a consequence, at a standing. An
 * unchecked sub-step holding something confirmed is guarded as confirmed.
 */
const withProposedSteps = (plan: ActionPlan, target: string, holding: 'unchecked' | 'confirmed'): ActionPlan => {
    const steps = merged(plan, target, [{ add: 'steps', steps: [{ says: 'hidden first' }, { says: 'hidden second' }] }], { author: 'triage', adds: ['steps'] })
    return merged(steps, 'hidden-first', [{ add: 'concern', says: 'the hidden thing may fall' }], { author: holding === 'confirmed' ? 'consequences' : 'triage' })
}

const holdsSteps = ({ items }: StepNode): boolean => items.some(({ kind }) => kind === 'step')

/** The variants of a cell's plan that the checks run over: every kind unchecked, every kind confirmed, and the target proposed sub-steps. */
const variants = (plan: ActionPlan, target: string): [string, ActionPlan][] => {
    const step = planSteps(plan).find(({ path }) => path === target)
    return [
        ['every kind unchecked', withEveryKind(plan, target, 'unchecked')],
        ['every kind confirmed', withEveryKind(plan, target, 'confirmed')],
        ...(step === undefined || holdsSteps(step) ? [] : [
            ['proposed sub-steps', withProposedSteps(plan, target, 'unchecked')],
            ['proposed sub-steps holding something confirmed', withProposedSteps(plan, target, 'confirmed')],
        ] as [string, ActionPlan][]),
    ]
}

/**
 * The blocks a merge's options admit, one change each, aimed at a step it would see: those whose refusal could read what the plan holds.
 * `called`: without a change that is closed to the piece, whose render refuses before any call.
 */
const blocksFor = (step: StepNode, { author, adds = ['consequence', 'concern', 'possibility'], restates = false }: MergeOptions, { called }: { called: boolean }): [string, unknown][] => [
    ...(restates ? [['a restatement as written', { restate: 'step', says: step.says, answered: 'a detail' }]] as [string, unknown][] : []),
    ...(restates && !(called && rewordingClosed(step, author) !== undefined) ? [
        ['a revision', { restate: 'step', says: step.says, intent: 'a new intent', answered: 'a detail' }],
        ['a rewording', { restate: 'step', says: 'other words', answered: 'a detail' }],
    ] as [string, unknown][] : []),
    ...(adds.includes('steps') && !(called && expansionClosed(step) !== undefined) ? [['an expansion', { add: 'steps', steps: [{ says: 'a first motion' }, { says: 'a second motion' }] }]] as [string, unknown][] : []),
    ...(adds.includes('consequence') ? [
        ['a consequence', { add: 'consequence', says: 'something moves' }],
        ['a repeat of the hidden consequence', { add: 'consequence', says: '[hidden1] slides' }],
        ['a thing for the hidden consequence', { add: 'consequence', says: '[hidden1] slides', thing: 'hidden1' }],
    ] as [string, unknown][] : []),
    ...(adds.includes('possibility') ? [['a possibility', { add: 'possibility', kind: 'execution', says: 'it holds', branches: [[], []] }]] as [string, unknown][] : []),
    ...(adds.includes('improvise') ? [
        ['a thing improvised', { add: 'improvise', handle: 'new-tool1', gloss: 'a new tool' }],
        ['the hidden thing as written', HIDDEN_THING],
        ['another gloss for the hidden thing', { ...HIDDEN_THING, gloss: 'another tool' }],
    ] as [string, unknown][] : []),
    ...(adds.includes('concern') ? [['a concern', { add: 'concern', says: 'it may fall' }]] as [string, unknown][] : []),
]

/** A cell's plan and target, where its inputs carry them. */
const planCell = (inputs: unknown): { plan: ActionPlan; target: string }[] => {
    const { plan, target } = (typeof inputs === 'object' && inputs !== null ? inputs : {}) as { plan?: ActionPlan; target?: string }
    return plan !== undefined && typeof target === 'string' ? [{ plan, target }] : []
}

/**
 * The hidden-refusal invariant's breaches for a view and merge over the cells' plans: each block that merges into the plan as the view reads
 * it but is refused on the full plan (or the other way round), over every variant of the plan.
 */
const hiddenRefusals = (view: PlanView, merges: MergeOptions, cells: readonly unknown[]): string[] =>
    cells.flatMap(planCell).flatMap(({ plan, target }) => variants(plan, target).flatMap(([variant, full]) => {
        const seen = viewPlan(full, view)
        const step = planSteps(full).find(({ path }) => path === target)
        return step === undefined ? [`${target}: no such step`] : blocksFor(step, merges, { called: true }).flatMap(([label, change]) => {
            const onFull = 'problems' in mergeStepChanges(full, target, { changes: [change] }, ['hidden1'], merges)
            const onSeen = 'problems' in mergeStepChanges(seen, target, { changes: [change] }, ['hidden1'], merges)
            return onFull === onSeen ? [] : [`${target}, ${variant}, ${label}: ${onFull ? 'refused on the full plan only' : 'refused on the viewed plan only'}`]
        })
    }))

/** The pieces that merge, read or answered: each one's id, plan view, merge and its cells' inputs. */
const mergingOf = (all: readonly [string, RegisteredPiece][]): [string, PlanView, MergeOptions, unknown[]][] => all.flatMap(([id, piece]): [string, PlanView, MergeOptions, unknown[]][] => (
    piece.merges === undefined ? [] : [[id, piece.view.plan, piece.merges, Object.values<{ inputs: unknown }>(piece.cells).map(({ inputs }) => inputs)]]
))

type Merge = typeof mergeStepChanges

/** Each confirmed item a plan holds, in its authority's keeping and without its own details, which may be added to; the plan's steps and its improvised things too. */
const confirmedItems = (plan: ActionPlan): { path: string; kind: AuthoredKind; text: string }[] => [
    ...(plan.improvised ?? []).filter(({ standing }) => standing === 'confirmed').map((item) => ({ path: item.handle, kind: 'improvise' as const, text: JSON.stringify(item) })),
    ...planSteps(plan).flatMap(({ path, says, standing, items }) => [
        ...(standing === 'confirmed' ? [{ path, kind: 'step' as const, text: says }] : []),
        ...items.flatMap((item: StepItem) => (item.kind === 'step' ? [] : [
            ...(item.standing === 'confirmed' ? [{ path: item.path, kind: item.kind, text: JSON.stringify({ ...item, ...(item.kind === 'consequence' ? { rules: undefined } : {}) }) }] : []),
            ...(item.kind === 'consequence' ? (item.rules ?? []).filter((rule) => rule.standing === 'confirmed').map((rule) => ({ path: rule.path, kind: 'rule' as const, text: JSON.stringify(rule) })) : []),
        ])),
    ]),
]

/**
 * The merge's own invariant's breaches, for a piece's options over the cells' plans: a block refused where everything on the target that isn't
 * the cell's is unchecked; and a confirmed item, of a kind the author isn't the authority for, that a merged block changed, lowered or took
 * out. The one exception is the revision rule's: the step's authority, revising it, calls its children into question.
 */
const standingBreaches = (merges: MergeOptions, cells: readonly unknown[], merge: Merge = mergeStepChanges): string[] =>
    cells.flatMap(planCell).flatMap(({ plan, target }) => variants(plan, target).flatMap(([variant, full]) => {
        const step = planSteps(full).find(({ path }) => path === target)
        const unchecked = variant === 'every kind unchecked' || variant === 'proposed sub-steps'
        return step === undefined ? [] : blocksFor(step, merges, { called: false }).flatMap(([label, change]) => {
            const result = merge(full, target, { changes: [change] }, ['hidden1'], merges)
            if ('problems' in result) {
                return unchecked && !refusedBare(plan, target, change, merges, merge) ? [`${target}, ${variant}, ${label}: refused`] : []
            }
            const revised = AUTHORITY.step === merges.author && (label === 'a revision' || label === 'a rewording')
            const after = confirmedItems(result.plan)
            return revised ? [] : confirmedItems(full)
                .filter(({ kind }) => AUTHORITY[kind] !== merges.author)
                .filter(({ path, text }) => !after.some((item) => item.path === path && item.text === text))
                .map(({ path }) => `${target}, ${variant}, ${label}: ${path} altered`)
        })
    }))

/** Whether a block is refused on the cell's plan as it is, on account of what the cell itself holds confirmed. */
const refusedBare = (plan: ActionPlan, target: string, change: unknown, merges: MergeOptions, merge: Merge): boolean =>
    'problems' in merge(plan, target, { changes: [change] }, ['hidden1'], merges)

/** A scene view's problems as declared: an axis off its known values, or a Rule section of no part or an unknown one. */
const sceneDeclarationProblems = ({ shows, securing, sceneRules, ruleParts }: SceneView): string[] => [
    ...((SCENE_SHOWS as readonly unknown[]).includes(shows) ? [] : [`shows "${String(shows)}"`]),
    ...((SECURINGS as readonly unknown[]).includes(securing) ? [] : [`states the securing "${String(securing)}"`]),
    ...(typeof sceneRules === 'boolean' ? [] : [`sceneRules "${String(sceneRules)}"`]),
    ...(ruleParts === undefined ? [] : ruleParts.length === 0 ? ['a Rule section of no part'] : ruleParts.filter((part) => !(RULE_PARTS as readonly unknown[]).includes(part)).map((part) => `a rule part "${String(part)}"`)),
]

/** One cell as rendered: the scene block (the text to the first `End of scene.`, or none), and the words of its fixture's securings. */
type RenderedScene = { cell: string; block?: string; securings: string[] }

/** Options for the pieces whose payloads must name some: a source every cell has, and the render `sceneReading` compares. */
const NAMED_OPTIONS: Record<string, unknown> = {
    'trial/rebuttal': { upstream: 'lifted' }, 'trial/verdict': { upstream: 'lifted' }, 'trial/ruling': { upstream: 'lifted' }, sceneReading: { render: 'explicit' },
}

/** Each cell of a piece rendered under its default options (or the minimum a payload names). */
const renderedScenes = async (id: string, piece: RegisteredPiece): Promise<RenderedScene[]> => {
    const options = piece.parseOptions(NAMED_OPTIONS[id])
    if (typeof options === 'string') {
        throw new Error(options)
    }
    const render = piece.render as (cell: unknown, options: unknown) => Promise<string>
    return Promise.all(Object.entries(piece.cells).map(async ([cell, value]) => {
        const text = await render(value, options)
        const { fixture } = value.inputs as { fixture: string }
        const scene = await fixtureScene(fixture)
        const securings = [...new Set(Object.values(scene.things).flatMap(({ relations }) => relations.flatMap((relation) => securingWords(relation) ?? [])))]
        const end = text.indexOf('End of scene.')
        return { cell, ...(end === -1 ? {} : { block: text.slice(0, end) }), securings }
    }))
}

/**
 * Whether the render keeps the scene view: a scene block exactly when the view shows one; no securing's words in it when the view
 * omits the securing, and some cell's naming one when it doesn't; the scene's Rules section exactly as the view has it.
 */
const renderedSceneProblems = ({ shows, securing, sceneRules }: SceneView, scenes: readonly RenderedScene[]): string[] => {
    const blocks = scenes.flatMap(({ cell, block, securings }) => (block === undefined ? [] : [{ cell, block, securings }]))
    const named = blocks.flatMap(({ cell, block, securings }) => securings.filter((words) => block.includes(words)).map((words) => ({ cell, words })))
    const secured = blocks.some(({ securings }) => securings.length > 0)
    const withRules = blocks.filter(({ block }) => /(^|\n)Rules:\n/.test(block)).map(({ cell }) => cell)
    return [
        ...scenes.filter(({ block }) => (block === undefined) !== (shows === 'none')).map(({ cell }) => `${cell}: ${shows === 'none' ? 'shows a scene with none declared' : 'shows no scene'}`),
        ...(securing === 'omitted' ? named.map(({ cell, words }) => `${cell}: states "${words}" with the securing omitted`) : []),
        ...(securing !== 'omitted' && secured && named.length === 0 ? [`no cell states a securing, declared ${securing}`] : []),
        ...(sceneRules ? (blocks.length > 0 && withRules.length === 0 ? ['no cell shows the Rules section it declares'] : []) : withRules.map((cell) => `${cell}: shows a Rules section with none declared`)),
    ]
}

/** The options that are arms over a scene axis, parsed as a payload gets them by default, against the view's value on that axis. */
const optionDrift = ({ shows, securing, sceneRules }: SceneView, options: unknown): string[] => {
    const named = (typeof options === 'object' && options !== null ? options : {}) as Record<string, unknown>
    return [
        ...('show' in named && named.show !== shows ? [`defaults show to "${String(named.show)}", the view ${shows}`] : []),
        ...('securing' in named && named.securing !== securing ? [`defaults securing to "${String(named.securing)}", the view ${securing}`] : []),
        ...('sceneRules' in named && named.sceneRules !== sceneRules ? [`defaults sceneRules to ${String(named.sceneRules)}, the view ${String(sceneRules)}`] : []),
    ]
}

describe('piece views over the registry (calibration AGENT.md, "Piece views")', () => {
    it.each(registered)('%s declares a view of known kinds and readings', (_, piece) => {
        expect(declarationProblems(piece.view.plan)).toEqual([])
    })

    it('catches a view that is declared wrong', () => {
        expect(declarationProblems({ reads: { consequences: 'all', intent: 'some' } as unknown as PlanView['reads'] })).toEqual(['reads "consequences", not a plan kind', 'reads intent at "some"'])
    })

    it('catches a stance filter declared wrong: off the rule kind, empty, or naming no stance', () => {
        expect(declarationProblems({ reads: {
            consequence: { reading: 'authoritative', stances: ['causes'] },
            rule: { reading: 'authoritative', stances: [] },
        } as unknown as PlanView['reads'] })).toEqual(['narrows consequence by stance, which only the rule kind takes', 'narrows rule to no stance'])
        expect(declarationProblems({ reads: { rule: { reading: 'some', stances: ['effect'] } } as unknown as PlanView['reads'] })).toEqual(['reads rule at "some"', 'narrows rule to "effect", not a stance'])
    })

    const merging = mergingOf(registered)

    it('has pieces that merge, so the checks below run', () => {
        expect(merging.map(([id]) => id)).toEqual(expect.arrayContaining(['playByPlay', 'consequences', 'triage']))
    })

    it.each(merging)('%s has cells with a plan and a target, so the checks run over something', (_, __, ___, cells) => {
        expect(cells.flatMap(planCell)).not.toEqual([])
    })

    // A proposer of every kind it can, the authority for none: wider than triage, which proposes no possibility or concern.
    const proposer = (author: PlanAuthor = 'triage'): MergeOptions => ({ author, adds: ['steps', 'consequence', 'possibility', 'concern', 'improvise'], restates: true, rules: [HIDDEN_RULE] })
    // The cells' plans, whose own steps are confirmed, and a player's raw command, built unchecked.
    const command = { target: 'pick-up-table', plan: planOf([{ step: { says: 'pick up the table', suppliedBy: 'player' }, standing: 'unchecked', items: [{ kind: 'intent', says: 'pick up the table', standing: 'unchecked' }] }]) }
    const everyCell = [...merging.flatMap(([, , , cells]) => cells), command]

    describe('an answered piece that merges is checked as a read piece is', () => {
        const answered = registerPiece({
            name: 'toyAnswered',
            // It restates, but reads the intent confirmed only, and adds possibilities it can't see.
            view: { plan: { reads: { step: 'all', intent: 'authoritative' } }, scene: { shows: 'none', securing: 'shown', sceneRules: false } },
            merges: { author: 'triage', adds: ['possibility'], restates: true },
            answers: ['yes', 'no'],
            cells: { command: { inputs: command, source: 'hand-written' } },
            parseOptions: () => undefined,
            render: async () => '',
        })
        const [checked] = mergingOf([['toyAnswered', answered]])

        it('by the mirror, the merge\'s standing, and the hidden-refusal invariant', () => {
            expect(checked).toBeDefined()
            const [, view, merges, cells] = checked
            expect(mirrorProblems(view, merges)).toEqual(['can alter a intent but reads it at authoritative', 'can alter a possibility but reads it not at all'])
            expect(standingBreaches(merges, cells)).toEqual([])
            expect(hiddenRefusals(view, merges, cells)).toEqual(['pick-up-table, every kind confirmed, a possibility: refused on the full plan only'])
        })
    })

    describe('the checker\'s mirror: a piece whose merge can alter an unchecked item of a kind reads that kind at all, stale items included', () => {
        it.each(merging)('%s', (_, view, merges) => {
            expect(mirrorProblems(view, merges)).toEqual([])
        })

        it('binds the pieces that merge today: playByPlay and triage overwrite steps and intents, triage improvised things, consequences possibilities', () => {
            expect(Object.fromEntries(merging.map(([id, , merges]) => [id, alterable(merges)]))).toMatchObject({ playByPlay: ['step', 'intent'], consequences: ['possibility'], triage: ['step', 'intent', 'improvise'] })
        })

        it('catches a checker that can\'t see what it confirms', () => {
            expect(mirrorProblems({ reads: { consequence: 'authoritative', step: 'all', intent: 'all' } }, { author: 'consequences', replaces: true, restates: true, adds: [] })).toEqual([
                'can alter a consequence but reads it at authoritative', 'can alter a rule but reads it not at all',
            ])
        })

        it('catches a checker that sees only some stances of what it confirms', () => {
            expect(mirrorProblems({ reads: { consequence: 'all', rule: { reading: 'all', stances: ['causes', 'voids'] } } }, { author: 'consequences', replaces: true, adds: [] })).toEqual([
                'can alter a rule but reads it at all (causes, voids)',
            ])
        })

        it('catches a piece that can\'t see a slot it overwrites', () => {
            expect(mirrorProblems({ reads: { intent: 'all', possibility: 'authoritative' } }, proposer())).toEqual(['can alter a step but reads it not at all', 'can alter a possibility but reads it at authoritative', 'can alter a improvise but reads it not at all'])
        })
    })

    describe('an unchecked item never refuses a change, and only its authority alters a confirmed one', () => {
        it.each(merging)('%s', (_, __, merges, cells) => {
            expect(standingBreaches(merges, cells)).toEqual([])
        })

        it.each<PlanAuthor>(['triage', 'ruleCell', 'consequences', 'playByPlay', 'improvisation'])('a piece that writes every kind, as %s', (author) => {
            expect(standingBreaches(proposer(author), everyCell)).toEqual([])
        })

        it('catches a merge that refuses on account of a proposal', () => {
            const lockedByAny: Merge = (plan, target, block, handles, options) => (
                planSteps(plan).some((step) => step.path === target && step.items.some(({ kind }) => kind === 'possibility')) ? { problems: ['already open'] } : mergeStepChanges(plan, target, block, handles, options)
            )
            expect(standingBreaches(proposer(), everyCell.slice(0, 1), lockedByAny)).toContain('pick-up-table1, every kind unchecked, a consequence: refused')
        })

        it('catches a merge that lowers what another confirmed', () => {
            const lowers: Merge = (plan, target, block, handles, options) => {
                const result = mergeStepChanges(plan, target, block, handles, options)
                return 'problems' in result ? result : { plan: { ...result.plan, steps: result.plan.steps.map((step) => ({ ...step, items: step.items.map((item) => ({ ...item, standing: 'unchecked' as const })) })) } }
            }
            expect(standingBreaches(proposer(), everyCell.slice(0, 1), lowers)).toContain('pick-up-table1, every kind confirmed, a consequence: pick-up-table1.hidden1-slides altered')
        })

        it('catches a merge that drops what another improvised', () => {
            const drops: Merge = (plan, target, block, handles, options) => {
                const result = mergeStepChanges(plan, target, block, handles, options)
                return 'problems' in result ? result : { plan: { steps: result.plan.steps } }
            }
            expect(standingBreaches(proposer(), everyCell.slice(0, 1), drops)).toContain('pick-up-table1, every kind confirmed, a consequence: hidden-tool1 altered')
        })

        it('catches a merge that overwrites what another confirmed', () => {
            const overwrites: Merge = (plan, target, block, handles, options) => mergeStepChanges({ ...plan, improvised: plan.improvised?.map((item) => ({ ...item, standing: 'unchecked' as const })) }, target, block, handles, options)
            expect(standingBreaches(proposer(), everyCell.slice(0, 1), overwrites)).toContain('pick-up-table1, every kind confirmed, another gloss for the hidden thing: hidden-tool1 altered')
        })
    })

    describe('a piece\'s merge never refuses a block on account of anything its view hides', () => {
        it.each(merging)('%s', (_, view, merges, cells) => {
            expect(hiddenRefusals(view, merges, cells)).toEqual([])
        })

        it('catches a merge that would: another gloss for a confirmed thing it can\'t see improvised', () => {
            const [, view, merges, cells] = merging.find(([id]) => id === 'triage') ?? []
            if (view === undefined || merges === undefined || cells === undefined) {
                throw new Error('triage merges')
            }
            const { improvise: _, ...reads } = view.reads
            expect(hiddenRefusals({ reads }, merges, cells.slice(0, 1))).toEqual(['pour-tea, every kind confirmed, another gloss for the hidden thing: refused on the full plan only'])
        })

        it('catches a merge that would: a possibility it can add, beside a confirmed one it can\'t see', () => {
            const [, view, merges, cells] = merging.find(([id]) => id === 'playByPlay') ?? []
            if (view === undefined || merges === undefined || cells === undefined) {
                throw new Error('playByPlay merges')
            }
            const { possibility: _, ...reads } = view.reads
            expect(hiddenRefusals({ reads }, { ...merges, adds: [...(merges.adds ?? []), 'possibility'] }, cells.slice(0, 1))).toEqual([
                'pick-up-table1, every kind confirmed, a possibility: refused on the full plan only',
            ])
        })
    })

    describe('the scene side: a view of known settings, which the render keeps and the default options agree with', () => {
        beforeEach(() => {
            jest.spyOn(console, 'log').mockImplementation(() => {})
            jest.spyOn(console, 'info').mockImplementation(() => {})
        })
        afterEach(() => jest.restoreAllMocks())

        const piece = (id: string): RegisteredPiece => {
            const found = registered.find(([named]) => named === id)
            if (found === undefined) {
                throw new Error(`no ${id}`)
            }
            return found[1]
        }

        it.each(registered)('%s declares a scene view of known settings', (_, registeredPiece) => {
            expect(sceneDeclarationProblems(registeredPiece.view.scene)).toEqual([])
        })

        it('catches a scene view declared wrong', () => {
            expect(sceneDeclarationProblems({ shows: 'some', securing: 'hinted', sceneRules: 'yes', ruleParts: ['fact', 'gist'] } as unknown as SceneView))
                .toEqual(['shows "some"', 'states the securing "hinted"', 'sceneRules "yes"', 'a rule part "gist"'])
            expect(sceneDeclarationProblems({ shows: 'whole', securing: 'shown', sceneRules: false, ruleParts: [] })).toEqual(['a Rule section of no part'])
        })

        it.each(registered)('%s renders as its scene view declares', async (id, registeredPiece) => {
            expect(renderedSceneProblems(registeredPiece.view.scene, await renderedScenes(id, registeredPiece))).toEqual([])
        })

        it('has pieces on each side of the securing, so the render check bites both ways', () => {
            expect(registered.map(([, { view }]) => view.scene.securing)).toEqual(expect.arrayContaining(['shown', 'omitted', 'conditions']))
        })

        it('catches a render that doesn\'t keep its view: a securing stated where it is omitted, or one never stated where it is shown', async () => {
            const against = await renderedScenes('trial/against', piece('trial/against'))
            expect(renderedSceneProblems({ ...piece('trial/against').view.scene, securing: 'omitted' }, against)).toEqual(expect.arrayContaining(['OC-1: states "glued to" with the securing omitted']))
            const rebuttal = await renderedScenes('trial/rebuttal', piece('trial/rebuttal'))
            expect(renderedSceneProblems({ ...piece('trial/rebuttal').view.scene, securing: 'shown' }, rebuttal)).toEqual(['no cell states a securing, declared shown'])
        })

        it('catches a Rules section or a scene the view doesn\'t declare', async () => {
            const ruleCell = piece('ruleCell')
            const withRules = await Promise.all(Object.entries(ruleCell.cells).map(async ([cell, value]): Promise<RenderedScene> => {
                const options = ruleCell.parseOptions({ sceneRules: true })
                const text = await (ruleCell.render as (cell: unknown, options: unknown) => Promise<string>)(value, options)
                return { cell, block: text.slice(0, text.indexOf('End of scene.')), securings: [] }
            }))
            expect(renderedSceneProblems(ruleCell.view.scene, withRules)).toEqual(expect.arrayContaining(['OC-1: shows a Rules section with none declared']))
            expect(renderedSceneProblems({ ...ruleCell.view.scene, shows: 'none' }, withRules.slice(0, 1))).toEqual(['OC-1: shows a scene with none declared', 'OC-1: shows a Rules section with none declared'])
        })

        it.each(registered)('%s takes its default options from its view', (id, registeredPiece) => {
            expect(optionDrift(registeredPiece.view.scene, registeredPiece.parseOptions(NAMED_OPTIONS[id]))).toEqual([])
        })

        it('catches a default option off its view', () => {
            expect(optionDrift(piece('ruleCell').view.scene, { show: 'none', sceneRules: true })).toEqual(['defaults show to "none", the view subScene', 'defaults sceneRules to true, the view false'])
            expect(optionDrift(piece('trial/against').view.scene, { securing: 'omitted' })).toEqual(['defaults securing to "omitted", the view shown'])
        })
    })
})
