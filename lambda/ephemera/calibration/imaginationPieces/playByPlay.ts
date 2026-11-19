//
// The play-by-play, the imagination's more-detail ask (AGENT.imagination.planning.md; AGENT.playByPlayExpand.planning.md): a read piece,
// and a reducer on the action plan (calibration AGENT.md, "The action plan"). Given a fixture, a plan and the path of the one step to
// expand, it breaks that step into ordered sub-steps, each with an intent where it helps, or marks it atomic, as one motion, in the
// change language. Code supplies each change's `to`, and the merge expands the step in place. There is no answer set: code checks each
// reply's form (does the block merge?), and a reader reads the merged plans against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
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
     * The other things the scene shows, by handle, listed by hand: a scene of the plan's handles alone keeps only them and their
     * containers, so a relation to anything else (OC-20's chain to the wall) would drop out.
     */
    alsoShown: readonly SceneHandle[]
}

export type PlayByPlayOptions = ImaginationOptions

/** The explicit render by default: draft 16, the kept draft, runs explicit (batch 31), so the default flips (calibration AGENT.md, "Scene renders"). */
export const PLAY_BY_PLAY_OPTIONS: PlayByPlayOptions = { rules: 'none', scene: 'explicit' }

/** What the play-by-play's block may hold: an expansion or the atomic mark, and nothing else, so `concern` is out (PX-5). */
export const PLAY_BY_PLAY_MERGE: MergeOptions = { adds: ['steps'], marks: ['atomic'] }

export const renderPlayByPlay = async ({ inputs: { fixture, plan, target, alsoShown } }: ReadPieceCell<PlayByPlayInputs>, options: PlayByPlayOptions): Promise<string> => {
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
    const scene = await renderScene({ fixture, shown: [...alsoShown, ...planHandles(plan)] }, options)
    return [...scene, `The plan:\n${renderPlanForGenerator(plan)}`, `The step to expand: ${target}`].join('\n\n')
}

/**
 * The stage's contract: the reply's block, its bare handles bracketed, scoped to the target and merged into the plan (`mergeStepChanges`),
 * taking only an expansion or the atomic mark (`PLAY_BY_PLAY_MERGE`). An empty `changes` is refused: every reply expands the step or
 * marks it atomic (the user, 2026-11-18). A handle the scene doesn't hold is kept as written: a breakdown may improvise an object.
 */
export const playByPlayContract: StageContract<PlayByPlayInputs, ActionPlan> = {
    name: 'playByPlay',
    parse: (reply, { input: { plan, target, alsoShown }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { changes } = parsed.object
        if (Array.isArray(changes) && changes.length === 0) {
            return { problems: ['"changes" is empty: expand the step, or mark it atomic'] }
        }
        const shown = [...new Set([...alsoShown, ...planHandles(plan), ...namedHandles(rendered)])]
        const merged = mergeStepChanges(plan, target, bracketChanges(parsed.object, shown), shown, PLAY_BY_PLAY_MERGE)
        return 'problems' in merged ? merged : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkPlayByPlay = (reply: string, { inputs }: ReadPieceCell<PlayByPlayInputs>, rendered = ''): string[] =>
    parseProblems(playByPlayContract.parse(reply, { input: inputs, rendered }))

/** A one-step plan whose intent is the step's own text (the single-step rule, as `consequences`' OC-1). */
const oneStepPlan = (says: string): ActionPlan => planOf([{ step: { says, suppliedBy: 'system' }, items: [{ kind: 'intent', says }] }])

/** The cells' plans, built by hand (PX-7): one step each, the case's own. */
export const playByPlayPlans = {
    'OC-1': oneStepPlan(caseActions('OC-1')[0]),
    'OC-6': oneStepPlan(caseActions('OC-6')[0]),
    'OC-19': oneStepPlan(caseActions('OC-19')[0]),
    'OC-20': oneStepPlan('pick up [table1]'),
} satisfies Record<string, ActionPlan>

export const playByPlayCells: Record<string, ReadPieceCell<PlayByPlayInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-1'], target: 'pick-up-table1', alsoShown: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: 'an ordinary lift (grip the edges, lift), or the step marked atomic; a sub-step dealing with the glue is a defect (PB-P2)',
        source: caseSource('OC-1'),
    },
    'OC-6': {
        inputs: { fixture: 'teaTable', plan: playByPlayPlans['OC-6'], target: 'pour-tea2-teapot1', alsoShown: ['table1'] },
        lookFor: 'the teapot lifted or tilted over the cup, as pouring needs, not fitted to the glue (PR-1); an "unglue" sub-step (PB-P2), or tipping the table instead (an alternate method), is a defect',
        source: caseSource('OC-6'),
    },
    'OC-19': {
        inputs: { fixture: 'teaTableHammerHeld', plan: playByPlayPlans['OC-19'], target: 'pry-teapot1-table1', alsoShown: [] },
        lookFor: 'the claw set under the teapot, then the teapot levered up and off; no sub-step moves the table',
        source: caseSource('OC-19'),
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', plan: playByPlayPlans['OC-20'], target: 'pick-up-table1', alsoShown: ['wall1'] },
        lookFor: 'the table lifted and pulled from the wall; a sub-step detaching the chain first is a defect (PB-P2); no sub-step moves the wall',
        source: 'hand-written',
        note: "The oracle probe has no candidate, since the template refuses the move; the step is written by hand, as the rule cell's was.",
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
export const playByPlayPlansText = plansText('playByPlay', playByPlayCells, playByPlayContract)
