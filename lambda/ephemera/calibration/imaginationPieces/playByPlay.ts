//
// The play-by-play, the imagination's more-detail ask (AGENT.imagination.planning.md; calibration AGENT.md, "A read piece"): a read piece,
// and a reducer on the action plan (calibration AGENT.md, "The action plan"). Given a fixture, a plan and the path of the one step to
// expand, it gives the detail asked for: the reply is the step record (calibration AGENT.md, The action plan), the step restated,
// `{"says", "intent", "steps"?, "consequences"?}`. Its `says` and `intent` revise the step where they differ; two or more `steps` break
// it into ordered sub-steps, each with an intent where it helps; with none, the step itself is the answer. The record and each sub-step
// may carry the `consequences` they bring about. Code reads it as changes in the change language, supplying the verbs, the list,
// `to` and the detail answered, which joins the step's `alreadyAnswers`. `playByPlay` is the method's authority, so its steps and
// intents merge confirmed, and its consequences and rules unchecked. There is no answer set: code checks each
// reply's form (does the block merge?), and a reader reads the merged plans against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { ruleTagHandles } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import {
    bracketChanges, isExpanded, mergeStepChanges, planOf, planSteps, renderPlanForGenerator, viewPlan, type ActionPlan, type MergeOptions, type Standing,
} from '../oracleLoop/actionPlan'
import { registerPiece, type PieceView, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { caseActions, caseSource, imaginationOptionsParser, listedTwice, namedHandles, planHandles, renderScene, type ImaginationOptions } from './imaginationScene'
import { plansText } from './plansText'

export { namedHandles } from './imaginationScene'

export type PlayByPlayInputs = {
    fixture: string
    /** The plan so far. */
    plan: ActionPlan
    /** The path of the step asked about, at any depth (the render names it by path, its reference into the plan): the reply restates it alone, and may expand it. */
    target: string
    /**
     * What the requester is looking for (the non-rule cell's request carries it): a detail of the method, not of how the method matches the
     * intent, so it makes sense to someone who doesn't know the step's intent ("how [table1] is held"). The step is broken down until it
     * is stated, or, when the step as written or revised states it, given with no sub-steps. Code adds it to the step's `alreadyAnswers`.
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
 * renders"). Its securings tagged with their rule handles, so a reply can name a rule, and each stated as its condition and carry
 * (`rules: 'conditions'`; the user's diagnosis, 2026-11-19), in place of `actionRule`'s
 * impossibility, which the concession cell's failures took as confirming "cannot be lifted".
 */
export const PLAY_BY_PLAY_OPTIONS: PlayByPlayOptions = { rules: 'conditions', scene: 'explicit' }

/**
 * What the play-by-play's block may hold: the step's restatement, an expansion, and the consequences it brings about, so `concern` is
 * out. The rules a consequence may name are the ones the prompt shows, added per call.
 */
export const PLAY_BY_PLAY_MERGE: MergeOptions = { author: 'playByPlay', adds: ['steps', 'consequence'], restates: true }

/**
 * What the play-by-play reads of the plan (AGENT.pieceViews.planning.md; confirmed by the user, 2026-11-21): the method at `all`, its own
 * kinds, so an unchecked intent divined from a command (`OC-6/command`) is there to be restated, which the checker's mirror requires of a
 * piece that restates; what happens only once confirmed, so no proposal, its own included, is read back as fact (§3); and confirmed rule
 * items whose stance is `causes` or `voids` (step 2's amendment), since they explain a confirmed consequence, a fact, where a `violation`
 * is a verdict on the method, which the request's `missing` carries when a step comes back for one. No concerns, which it has no use
 * for. The scene, which carries the rules themselves, is unfiltered.
 */
export const PLAY_BY_PLAY_VIEW: PieceView = {
    plan: { reads: { step: 'all', intent: 'all', consequence: 'authoritative', possibility: 'authoritative', rule: { reading: 'authoritative', stances: ['causes', 'voids'] } } },
}

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
    if (isExpanded(step)) {
        throw new Error(`The target "${target}" is already expanded; expand one of its sub-steps`)
    }
    if (missing.trim() === '') {
        throw new Error('No detail asked for')
    }
    // The view's plan, so a hidden proposal neither shows nor widens the scene by the handles it names.
    const viewed = viewPlan(plan, PLAY_BY_PLAY_VIEW.plan)
    const shown = [...new Set([...alsoShown, ...planHandles(viewed), ...namedHandles(missing)])]
    const scene = await renderScene({ fixture, shown }, options)
    return [...scene, `The plan:\n${renderPlanForGenerator(viewed)}`, `The step asked about: ${target}\nThe detail asked for: ${missing}`].join('\n\n')
}

/** The record's keys: the step restated, its sub-steps, and what the step as a whole brings about. */
const REPLY_KEYS = ['says', 'intent', 'steps', 'consequences'] as const

/**
 * The reply's one object as the changes it stands for, each with the label its problems take in the reply's terms, or why it stands for
 * none. The reply gives only what the model alone can provide (the user, 2026-11-19): the step record, `{"says", "intent"?, "steps"?,
 * "consequences"?}`. Code supplies the rest of the change language, as it supplies `to`: the restatement first, with `missing` as
 * the detail it answers, then the expansion when there are `steps`, then a consequence change for each of the record's consequences. A
 * sub-step's own `consequences` ride in its entry.
 */
export const replyChanges = (reply: Record<string, unknown>, missing: string): { changes: unknown[]; labels: string[] } | { problems: string[] } => {
    const other = Object.keys(reply).filter((key) => key !== 'atomic' && !(REPLY_KEYS as readonly string[]).includes(key))
    const { says, intent, steps, consequences } = reply
    const problems = [
        ...('atomic' in reply ? ['"atomic" is retired: give the step as "says" (and "intent"); with no "steps", the step itself is the answer'] : []),
        ...(other.length > 0 ? [`has ${other.map((key) => `"${key}"`).join(', ')}, not one of ${REPLY_KEYS.join(', ')}`] : []),
        ...('says' in reply ? [] : ['the record restates the step: it needs "says"']),
        ...(consequences !== undefined && !Array.isArray(consequences) ? ['"consequences" is not a list'] : []),
    ]
    if (problems.length > 0) {
        return { problems }
    }
    // An entry that isn't an object is passed on as it is, so the merge refuses it as a change that isn't one.
    const added = ((consequences ?? []) as unknown[]).map((entry) => (typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? { add: 'consequence', ...entry } : entry))
    // An empty `steps` is none: the step itself is the answer (the user, 2026-11-20; batch 44's OC-1b wrote `"steps": []` 3 of 3).
    const expansion = steps === undefined || (Array.isArray(steps) && steps.length === 0) ? [] : [{ add: 'steps', steps }]
    return {
        changes: [{ restate: 'step', says, ...(intent === undefined ? {} : { intent }), answered: missing }, ...expansion, ...added],
        labels: ['', ...expansion.map(() => ''), ...added.map((_, index) => `consequence ${index + 1}: `)],
    }
}

/**
 * A merge problem as the reply's: the restatement's and the expansion's prefixes go, since they are the record's own; a consequence
 * change's is the record's consequence. A consequence's own "add" is code's, so a problem naming it is the merge's wording for a key
 * the reply wrote.
 */
const replyProblem = (problem: string, labels: readonly string[]): string =>
    problem.replace(/^change (\d+): /, (prefix, index: string) => labels[Number(index) - 1] ?? prefix)

/** The rule handles a plan's items hold: they name rules, not things. */
const planRuleHandles = (plan: ActionPlan): string[] => planSteps(plan).flatMap(({ items }) => items.flatMap((item) => (item.kind === 'consequence' ? (item.rules ?? []).map(({ rule }) => rule) : [])))

/**
 * The stage's contract: the reply's one object, read as changes (`replyChanges`), its bare handles bracketed, scoped to the target and
 * merged into the plan (`mergeStepChanges`), taking only the restatement, an expansion and consequences (`PLAY_BY_PLAY_MERGE`). Every
 * reply restates the step. A handle the scene doesn't hold is kept as written: a breakdown may
 * improvise an object. A consequence's rule must be one the prompt shows (`ruleTagHandles`), and a rule handle is never a thing.
 */
export const playByPlayContract: StageContract<PlayByPlayInputs, ActionPlan> = {
    name: 'playByPlay',
    parse: (reply, { input: { plan, target, alsoShown, missing }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const read = replyChanges(parsed.object, missing)
        if ('problems' in read) {
            return read
        }
        const rules = ruleTagHandles(rendered)
        const notThings = new Set([...rules, ...planRuleHandles(plan)])
        const shown = [...new Set([...alsoShown, ...planHandles(viewPlan(plan, PLAY_BY_PLAY_VIEW.plan)), ...namedHandles(rendered)])].filter((handle) => !notThings.has(handle))
        const merged = mergeStepChanges(plan, target, bracketChanges({ changes: read.changes }, shown), shown, { ...PLAY_BY_PLAY_MERGE, rules })
        return 'problems' in merged ? { problems: merged.problems.map((problem) => replyProblem(problem, read.labels)) } : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkPlayByPlay = (reply: string, { inputs }: ReadPieceCell<PlayByPlayInputs>, rendered = ''): string[] =>
    parseProblems(playByPlayContract.parse(reply, { input: inputs, rendered }))

/**
 * A one-step plan whose intent is the step's own text (the single-step rule, as `consequences`' OC-1), confirmed unless given its
 * standing: an intent divined from a player's command is unchecked until `playByPlay` restates it (the user, 2026-11-20).
 */
const oneStepPlan = (says: string, intentStanding?: Standing): ActionPlan =>
    planOf([{ step: { says, suppliedBy: 'system' }, items: [{ kind: 'intent', says, ...(intentStanding === undefined ? {} : { standing: intentStanding }) }] }])

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
 * holding a wrong proposal on the target, its consequence worded as a verdict (bad upstream data); OC-20/proposed's is the same plan with the
 * proposal well formed, what happens with its violation; OC-6/command's is the player's command alone, its intent its own text and unchecked (divined, not yet
 * restated), so its handles are the reply's to deduce.
 */
export const playByPlayPlans = {
    'OC-1': oneStepPlan(caseActions('OC-1')[0]),
    'OC-1b': expandedPlan(oneStepPlan(caseActions('OC-1')[0]), 'pick-up-table1', [{ says: 'grip [table1] by its edges' }, { says: 'lift [table1] off the floor' }]),
    'OC-6': oneStepPlan(caseActions('OC-6')[0]),
    'OC-6/command': oneStepPlan('pour tea into cup', 'unchecked'),
    'OC-19': oneStepPlan(caseActions('OC-19')[0]),
    'OC-20': oneStepPlan('pick up [table1]'),
    'OC-20/concession': proposedOn(oneStepPlan('pick up [table1]'), 'pick-up-table1', '[table1] cannot be lifted', [{ rule: 'table-secured-to-wall', stance: 'violation' }]),
    'OC-20/proposed': proposedOn(oneStepPlan('pick up [table1]'), 'pick-up-table1', '[table1] pulls against its chain to [wall1]', [{ rule: 'table-secured-to-wall', stance: 'violation' }]),
} satisfies Record<string, ActionPlan>

/** The scope checks every cell carries: they bound the piece, and are not its bar. */
const BOUNDS = 'no outcome settled (PB-P5)'

export const playByPlayCells: Record<string, ReadPieceCell<PlayByPlayInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-1'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: `expanded: the grip (where, with what), then the lift (straight up, level). The control is the method: no sub-step dealing with the glue (PB-P2). Recorded, not graded (the stance is an outlet, an unchecked claim the rule cell rules on): a rule tag on the glue ([teapot-secured-to-table]), a \`causes\` on an ordinary carry (the teapot or saucer rising with the lifted table) or a \`violation\`. Bounds: ${BOUNDS}`,
        source: caseSource('OC-1'),
        note: 'Its `missing` is hand-written (the corpus has no requests), and is OC-20\'s too, so the two differ by the scene alone.',
    },
    'OC-1b': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-1b'], target: 'grip-table1-by', missing: 'how [table1] is held', alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: `the step as the answer, as written or revised, with no "steps": the step already says how [table1] is held. A split into reaching and closing the hands is over-expansion. Bounds: ${BOUNDS}`,
        source: caseSource('OC-1'),
        note: "OC-1's plan expanded once by hand; the target is its grip sub-step, which states the detail asked for. The answered cell.",
    },
    'OC-6': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-6'], target: 'pour-tea2-teapot1', missing: 'how [teapot1] is held and moved', alsoShown: ['table1'] },
        lookFor: `expanded: [teapot1] taken by its handle, raised or tilted over [cup1]. Bounds: no "unglue" sub-step (PB-P2), no sub-step moving or tipping [table1], no invented part (a lid); ${BOUNDS}`,
        source: caseSource('OC-6'),
    },
    'OC-6/command': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-6/command'], target: 'pour-tea-cup', missing: 'how the tea is poured', alsoShown: ['table1', 'tea2', 'teapot1', 'cup1'] },
        lookFor: `the step revised to its handles, with or without "steps", graded in three parts: (a) the revision in the record's "says", not a one-entry "steps"; (b) "says" naming [teapot1] and [cup1], and [tea2] for "tea" (graded apart); (c) the unchecked intent revised to name them. Bounds: no "unglue" sub-step (PB-P2), no sub-step moving or tipping [table1], no invented part (a lid); ${BOUNDS}`,
        source: caseSource('OC-6'),
        note: "The plan as built from the player's command alone, its says and intent both the command's text (the user). Its scene is OC-6's (mine: the things OC-6's plan names, shown by hand), so the two differ by the plan; its `missing` names no handle (mine).",
    },
    'OC-19': {
        inputs: { fixture: 'teaTableHammerHeld', plan: playByPlayPlans['OC-19'], target: 'pry-teapot1-table1', missing: 'which part of [hammer1] goes where, and how it is worked', alsoShown: [] },
        lookFor: `expanded: the claw of [hammer1] set under the edge of [teapot1], then the handle worked to lever it. Graded on the method and the pry's consequence ([teapot1] comes loose from [table1]); its rule tag (\`voids\` or \`violation\` on [teapot-secured-to-table]) recorded, not graded. Bounds: no sub-step moves [table1]; ${BOUNDS}`,
        source: caseSource('OC-19'),
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['wall1'] },
        lookFor: `expanded: the grip (where), then the lift. Graded (the user): the chain out of the grip's placement, in the proposals (unchecked consequences and rules) only; the lift's consequence (it pulls against the chain) graded, its rule tag recorded. Bounds: no sub-step detaching the chain (PB-P2), no sub-step moving [wall1]; ${BOUNDS}`,
        source: 'hand-written',
        note: "The oracle probe has no candidate, since the template refuses the move; the step is written by hand, as the rule cell's was. Its `missing` is OC-1's, so the reason to expand comes from the request, not the chain (batches 32 and 33's diagnosis).",
    },
    'OC-20/concession': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20/concession'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['wall1'] },
        lookFor: `as OC-20's: its inputs are OC-20's, the proposal ("[table1] cannot be lifted") hidden by the view (AGENT.pieceViews.planning.md), so it tests the merge, not the prompt, and is left out of the payloads. The merge keeps the proposal on the target: as it was when the record keeps the step's says and intent, stale when it revises them (VW-2). Bounds: no sub-step detaching the chain (PB-P2), no sub-step moving [wall1]; ${BOUNDS}`,
        source: 'hand-written',
        note: "OC-20's plan, arriving with an unchecked consequence and its Rule (Violation) on the target, as if from an earlier proposer (the user's watch item 3: conceding without judgment where the piece has authority).",
    },
    'OC-20/proposed': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20/proposed'], target: 'pick-up-table1', missing: 'how [table1] is held and lifted', alsoShown: ['wall1'] },
        lookFor: `as OC-20's: its inputs are OC-20's, the proposal ("[table1] pulls against its chain to [wall1]") hidden by the view (AGENT.pieceViews.planning.md), so it tests the merge, not the prompt, and is left out of the payloads. The merge keeps the proposal on the target: as it was when the record keeps the step's says and intent, stale when it revises them (VW-2). Bounds: no sub-step detaching the chain (PB-P2), no sub-step moving [wall1]; ${BOUNDS}`,
        source: 'hand-written',
        note: "The concession cell's plan with its proposal well formed: what happens ([table1] pulls against its chain), with the Rule (Violation). It is the standing work's bar on a proposal; the concession cell's verdict-worded proposal reaches forward to the resilience pass (the user, 2026-11-20).",
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
    view: PLAY_BY_PLAY_VIEW,
    merges: PLAY_BY_PLAY_MERGE,
    maxTokens: PLAY_BY_PLAY_MAX_TOKENS,
    cells: playByPlayCells,
    check: checkPlayByPlay,
    parseOptions: imaginationOptionsParser(PLAY_BY_PLAY_OPTIONS),
    render: renderPlayByPlay,
}

export const registeredPlayByPlay = registerPiece(playByPlay)

/** A batch's replies for reading (`read-plans`), as merged plans (`plansText`). */
export const playByPlayPlansText = plansText(playByPlay, playByPlayContract)
