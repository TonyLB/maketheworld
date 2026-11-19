//
// The play-by-play, the imagination's more-detail ask (AGENT.imagination.planning.md; calibration AGENT.md, "A read piece"): a read piece,
// and a reducer on the action plan (calibration AGENT.md, "The action plan"). Given a fixture, a plan and the path of the one step to
// expand, it breaks that step into ordered sub-steps, each with an intent where it helps, or marks it atomic, as one motion. The reply
// is one object, `{"steps": [...]}` or `{"atomic": true}`, either with the `consequences` the step brings about, and each sub-step with
// its own (AGENT.itemStanding.planning.md, IS-5); code reads it as changes in the change language, supplying the verbs, the list and
// `to`, and the merge expands the step in place. `playByPlay` is the method's authority, so its sub-steps and intents merge confirmed,
// and its consequences and rules unchecked. There is no answer set: code checks each
// reply's form (does the block merge?), and a reader reads the merged plans against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { ruleTagHandles } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import {
    bracketChanges, isExpanded, mergeStepChanges, planOf, planSteps, renderPlanForGenerator, type ActionPlan, type MergeOptions,
} from '../oracleLoop/actionPlan'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { caseActions, caseSource, imaginationOptionsParser, listedTwice, namedHandles, planHandles, renderScene, type ImaginationOptions } from './imaginationScene'
import { plansText } from './plansText'

export { namedHandles } from './imaginationScene'

export type PlayByPlayInputs = {
    fixture: string
    /** The plan so far. */
    plan: ActionPlan
    /** The path of the step to expand, at any depth: the reply expands it alone, or marks it atomic. */
    target: string
    /**
     * What the requester is looking for (the non-rule cell's request carries it): a detail of the method, not of how the method matches the
     * intent, so it makes sense to someone who doesn't know the step's intent ("how [table1] is held"). The step is broken down until it
     * is stated, or marked atomic when no breakdown would state it.
     */
    missing: string
    /**
     * The other things the scene shows, by handle, listed by hand: a scene of the plan's handles alone keeps only them and their
     * containers, so a relation to anything else (OC-20's chain to the wall) would drop out.
     */
    alsoShown: readonly SceneHandle[]
}

export type PlayByPlayOptions = ImaginationOptions

/**
 * The explicit render by default: draft 16, the kept draft, runs explicit (batch 31), so the default flips (calibration AGENT.md, "Scene
 * renders"). Its securings tagged with their rule handles, so a reply can name a rule (IS-6), and each stated as its condition and carry
 * (`rules: 'conditions'`; AGENT.itemStanding.planning.md, step 2, the user's diagnosis, 2026-11-19), in place of `actionRule`'s
 * impossibility, which the concession cell's failures took as confirming "cannot be lifted".
 */
export const PLAY_BY_PLAY_OPTIONS: PlayByPlayOptions = { rules: 'conditions', scene: 'explicit' }

/**
 * What the play-by-play's block may hold: an expansion or the atomic mark, and the consequences it brings about, so `concern` is out.
 * The rules a consequence may name are the ones the prompt shows, added per call.
 */
export const PLAY_BY_PLAY_MERGE: MergeOptions = { author: 'playByPlay', adds: ['steps', 'consequence'], marks: ['atomic'] }

export const renderPlayByPlay = async ({ inputs: { fixture, plan, target, missing, alsoShown } }: ReadPieceCell<PlayByPlayInputs>, options: PlayByPlayOptions): Promise<string> => {
    const twice = listedTwice(alsoShown)
    if (twice.length > 0) {
        throw new Error(`Things shown twice: ${twice.join(', ')}`)
    }
    const step = planSteps(plan).find(({ path }) => path === target)
    if (step === undefined) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    // Asking for what the merge would refuse is the caller's error (mine).
    if (step.atomic) {
        throw new Error(`The target "${target}" is marked atomic; nothing to expand`)
    }
    if (isExpanded(step)) {
        throw new Error(`The target "${target}" is already expanded; expand one of its sub-steps`)
    }
    if (missing.trim() === '') {
        throw new Error('No detail asked for')
    }
    const shown = [...new Set([...alsoShown, ...planHandles(plan), ...namedHandles(missing)])]
    const scene = await renderScene({ fixture, shown }, options)
    return [...scene, `The plan:\n${renderPlanForGenerator(plan)}`, `The step to expand: ${target}\nThe detail asked for: ${missing}`].join('\n\n')
}

/** The reply's keys: the sub-steps or the atomic mark, and what the step as a whole brings about. */
const REPLY_KEYS = ['steps', 'atomic', 'consequences'] as const

/**
 * The reply's one object as the changes it stands for, or why it stands for none. The reply gives only what the model alone can
 * provide (the user, 2026-11-19): `{"steps": [...]}` or `{"atomic": true}`, either with `consequences`, what the step as a whole brings
 * about (IS-5). Code supplies the rest of the change language, as it supplies `to`: the `add`/`mark` verbs, and the list, the expansion
 * or the mark first, then a consequence change for each of the record's consequences. A sub-step's own `consequences` ride in its entry.
 */
export const replyChanges = (reply: Record<string, unknown>): { changes: unknown[] } | { problems: string[] } => {
    const other = Object.keys(reply).filter((key) => !(REPLY_KEYS as readonly string[]).includes(key))
    if (other.length > 0) {
        return { problems: [`has ${other.map((key) => `"${key}"`).join(', ')}, not one of ${REPLY_KEYS.join(', ')}`] }
    }
    const given = (['steps', 'atomic'] as const).filter((key) => key in reply)
    if (given.length !== 1) {
        return { problems: [`has ${given.length === 0 ? 'neither "steps" nor "atomic"' : 'both "steps" and "atomic"'}: expand the step, or mark it atomic`] }
    }
    const { consequences } = reply
    if (consequences !== undefined && !Array.isArray(consequences)) {
        return { problems: ['"consequences" is not a list'] }
    }
    // An entry that isn't an object is passed on as it is, so the merge refuses it as a change that isn't one.
    const added = (consequences ?? []).map((entry: unknown) => (typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? { add: 'consequence', ...entry } : entry))
    if ('atomic' in reply) {
        return reply.atomic === true ? { changes: [{ mark: 'atomic' }, ...added] } : { problems: ['"atomic" must be true'] }
    }
    return { changes: [{ add: 'steps', steps: reply.steps }, ...added] }
}

/**
 * A merge problem as the reply's: the expansion or mark is change 1, so its prefix goes; change k is the record's consequence k - 1.
 * A consequence's own "add" is code's, so a problem naming it is the merge's wording for a key the reply wrote.
 */
const replyProblem = (problem: string): string => problem
    .replace(/^change 1: /, '')
    .replace(/^change (\d+): /, (_, index: string) => `consequence ${Number(index) - 1}: `)

/** The rule handles a plan's items hold: they name rules, not things. */
const planRuleHandles = (plan: ActionPlan): string[] => planSteps(plan).flatMap(({ items }) => items.flatMap((item) => (item.kind === 'consequence' ? (item.rules ?? []).map(({ rule }) => rule) : [])))

/**
 * The stage's contract: the reply's one object, read as changes (`replyChanges`), its bare handles bracketed, scoped to the target and
 * merged into the plan (`mergeStepChanges`), taking only an expansion or the atomic mark, and consequences (`PLAY_BY_PLAY_MERGE`). Every
 * reply expands the step or marks it atomic (the user, 2026-11-18). A handle the scene doesn't hold is kept as written: a breakdown may
 * improvise an object. A consequence's rule must be one the prompt shows (`ruleTagHandles`), and a rule handle is never a thing.
 */
export const playByPlayContract: StageContract<PlayByPlayInputs, ActionPlan> = {
    name: 'playByPlay',
    parse: (reply, { input: { plan, target, alsoShown }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const read = replyChanges(parsed.object)
        if ('problems' in read) {
            return read
        }
        const rules = ruleTagHandles(rendered)
        const notThings = new Set([...rules, ...planRuleHandles(plan)])
        const shown = [...new Set([...alsoShown, ...planHandles(plan), ...namedHandles(rendered)])].filter((handle) => !notThings.has(handle))
        const merged = mergeStepChanges(plan, target, bracketChanges({ changes: read.changes }, shown), shown, { ...PLAY_BY_PLAY_MERGE, rules })
        return 'problems' in merged ? { problems: merged.problems.map(replyProblem) } : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkPlayByPlay = (reply: string, { inputs }: ReadPieceCell<PlayByPlayInputs>, rendered = ''): string[] =>
    parseProblems(playByPlayContract.parse(reply, { input: inputs, rendered }))

/** A one-step plan whose intent is the step's own text (the single-step rule, as `consequences`' OC-1). */
const oneStepPlan = (says: string): ActionPlan => planOf([{ step: { says, suppliedBy: 'system' }, items: [{ kind: 'intent', says }] }])

/** A plan with its one step expanded by hand into these sub-steps, as an earlier `playByPlay` reply would have left it. */
const expandedPlan = (plan: ActionPlan, target: string, steps: readonly { says: string; intent?: string }[]): ActionPlan => {
    const merged = mergeStepChanges(plan, target, { changes: [{ add: 'steps', steps }] }, [], PLAY_BY_PLAY_MERGE)
    if ('problems' in merged) {
        throw new Error(merged.problems.join('; '))
    }
    return merged.plan
}

/**
 * A plan carrying an unchecked proposal on its target, as if from an earlier proposer: merged as `playByPlay`'s, so it is unchecked
 * exactly as a reply's would be.
 */
const proposedOn = (plan: ActionPlan, target: string, says: string, rules: readonly { rule: string; stance: string }[]): ActionPlan => {
    const merged = mergeStepChanges(plan, target, { changes: [{ add: 'consequence', says, rules }] }, [], { author: 'playByPlay', adds: ['consequence'], rules: rules.map(({ rule }) => rule) })
    if ('problems' in merged) {
        throw new Error(merged.problems.join('; '))
    }
    return merged.plan
}

/**
 * The cells' plans, built by hand: one step each, the case's own; OC-1b's is OC-1's, expanded once; the concession cell's is OC-20's,
 * holding a wrong proposal on the target (IS-6).
 */
export const playByPlayPlans = {
    'OC-1': oneStepPlan(caseActions('OC-1')[0]),
    'OC-1b': expandedPlan(oneStepPlan(caseActions('OC-1')[0]), 'pick-up-table1', [{ says: 'grip [table1] by its edges' }, { says: 'lift [table1] off the floor' }]),
    'OC-6': oneStepPlan(caseActions('OC-6')[0]),
    'OC-19': oneStepPlan(caseActions('OC-19')[0]),
    'OC-20': oneStepPlan('pick up [table1]'),
    'OC-20/concession': proposedOn(oneStepPlan('pick up [table1]'), 'pick-up-table1', '[table1] cannot be lifted', [{ rule: 'table-secured-to-wall', stance: 'violation' }]),
} satisfies Record<string, ActionPlan>

/** The scope checks every cell carries: they bound the piece, and are not its bar. */
const BOUNDS = 'no outcome settled (PB-P5)'

export const playByPlayCells: Record<string, ReadPieceCell<PlayByPlayInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-1'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: `expanded: the grip (where, with what), then the lift (straight up, level). The control (IS-7): no \`Rule (Violation)\` on the glue ([teapot-secured-to-table]); a carry with \`Rule (Consistent)\` is fine. Bounds: no sub-step dealing with the glue (PB-P2); ${BOUNDS}`,
        source: caseSource('OC-1'),
        note: 'Its `missing` is hand-written (the corpus has no requests), and is OC-20\'s too, so the two differ by the scene alone.',
    },
    'OC-1b': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-1b'], target: 'grip-table1-by', missing: 'how [table1] is held', alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: `atomic: the step already says how [table1] is held. A split into reaching and closing the hands is over-expansion. Bounds: ${BOUNDS}`,
        source: caseSource('OC-1'),
        note: "OC-1's plan expanded once by hand; the target is its grip sub-step, which states the detail asked for. The atomic cell.",
    },
    'OC-6': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-6'], target: 'pour-tea2-teapot1', missing: 'how [teapot1] is held and moved', alsoShown: ['table1'] },
        lookFor: `expanded: [teapot1] taken by its handle, raised or tilted over [cup1]. Bounds: no "unglue" sub-step (PB-P2), no sub-step moving or tipping [table1], no invented part (a lid); ${BOUNDS}`,
        source: caseSource('OC-6'),
    },
    'OC-19': {
        inputs: { fixture: 'teaTableHammerHeld', plan: playByPlayPlans['OC-19'], target: 'pry-teapot1-table1', missing: 'which part of [hammer1] goes where, and how it is worked', alsoShown: [] },
        lookFor: `expanded: the claw of [hammer1] set under the edge of [teapot1], then the handle worked to lever it. Bounds: no sub-step moves [table1]; ${BOUNDS}`,
        source: caseSource('OC-19'),
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['wall1'] },
        lookFor: `expanded: the grip (where), then the lift. Graded (IS-7, the user): the chain out of the grip's placement, in the proposals (unchecked consequences and rules) only. Bounds: no sub-step detaching the chain (PB-P2), no sub-step moving [wall1]; ${BOUNDS}`,
        source: 'hand-written',
        note: "The oracle probe has no candidate, since the template refuses the move; the step is written by hand, as the rule cell's was. Its `missing` is OC-1's, so the reason to expand comes from the request, not the chain (batches 32 and 33's diagnosis).",
    },
    'OC-20/concession': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20/concession'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['wall1'] },
        lookFor: `expanded: the ordinary grip and lift, as OC-20's. Graded (IS-7): not atomic, and no method bent around "[table1] cannot be lifted": the method is playByPlay's authority, and an unchecked claim doesn't settle it. The input's proposal stays on the target, untouched. Bounds: no sub-step detaching the chain (PB-P2), no sub-step moving [wall1]; ${BOUNDS}`,
        source: 'hand-written',
        note: "OC-20's plan, arriving with an unchecked consequence and its Rule (Violation) on the target, as if from an earlier proposer (the user's watch item 3: conceding without judgment where the piece has authority).",
    },
}

/**
 * Draft 5's replies ran past 512 tokens (PB-P6), so the cap is raised while the drafts tune what is said. Shortening the reply is booked
 * for when the replies are good (user, 2026-11-10: needlessly verbose).
 */
export const PLAY_BY_PLAY_MAX_TOKENS = 1024

export const playByPlay: ReadPiece<PlayByPlayInputs, PlayByPlayOptions> = {
    kind: 'read',
    name: 'playByPlay',
    maxTokens: PLAY_BY_PLAY_MAX_TOKENS,
    cells: playByPlayCells,
    check: checkPlayByPlay,
    parseOptions: imaginationOptionsParser(PLAY_BY_PLAY_OPTIONS),
    render: renderPlayByPlay,
}

export const registeredPlayByPlay = registerPiece(playByPlay)

/** A batch's replies for reading (`read-plans`), as merged plans (`plansText`). */
export const playByPlayPlansText = plansText(playByPlay, playByPlayContract)
