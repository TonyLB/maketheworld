//
// Triage (AGENT.triage.planning.md): the first screen on a command. Given the player's raw command, as a plan's one unchecked step, and the
// whole scene, it says the step in full. For now it is the expansion probe alone, a read piece: it asks what the step becomes and what Micro
// improvises for what the scene lacks, with no verdict. The reply is the step record (calibration AGENT.md, "The action plan"), its
// improvised things with it, all of it merged.
//
import { renderSceneExplicit, ruleTagHandles } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import { fixtureScene, namedHandles, planHandles } from '../imaginationPieces/imaginationScene'
import { plansText } from '../imaginationPieces/plansText'
import { expansionClosed, planOf, planSteps, renderPlanForGenerator, rewordingClosed, viewPlan, type ActionPlan, type MergeOptions } from '../oracleLoop/actionPlan'
import { mergeStepRecord } from '../oracleLoop/stepRecord'
import { registerPiece, type PieceView, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'

export type TriageInputs = {
    fixture: string
    /** The command as a plan, built by code (`planFromCommand`). */
    plan: ActionPlan
    /** The path of the plan's one step. */
    target: string
}

/** The authority for no kind, so everything it writes is unchecked. The rules a consequence may name are the ones the prompt shows, added per call. */
export const TRIAGE_MERGE: MergeOptions = { author: 'triage', adds: ['steps', 'consequence', 'improvise'], restates: true, handlesAre: 'in the scene or improvised' }

/**
 * The step and its intent at `all`, which are all its plan holds, and what is improvised, which it may overwrite (the checker's mirror); and the
 * whole scene, since grounding comes before there are handles to take a sub-scene of. `conditions` is a first setting picked for convenience (the user, 2026-11-24), an existing value with the parts
 * triage needs: no precedent, and any draft may change it.
 */
export const TRIAGE_VIEW: PieceView = {
    plan: { reads: { step: 'all', intent: 'all', improvise: 'all' } },
    scene: { shows: 'whole', securing: 'conditions', sceneRules: false },
}

/** The player's command as a plan's one step, unchecked, its intent its own text. */
export const planFromCommand = (command: string): ActionPlan =>
    planOf([{ step: { says: command, suppliedBy: 'player' }, standing: 'unchecked', items: [{ kind: 'intent', says: command, standing: 'unchecked' }] }])

/** The whole scene, then the plan. Throws on a target that names no step, or one closed to triage, since no redraft could fix the refusal. */
export const renderTriage = async ({ inputs: { fixture, plan, target } }: ReadPieceCell<TriageInputs>): Promise<string> => {
    const step = planSteps(plan).find(({ path }) => path === target)
    if (step === undefined) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const closed = rewordingClosed(step, TRIAGE_MERGE.author) ?? expansionClosed(step)
    if (closed !== undefined) {
        throw new Error(`The target "${target}" is closed to triage: ${closed}`)
    }
    const scene = await fixtureScene(fixture)
    return [renderSceneExplicit(scene, { rules: 'conditions', full: scene }), `The plan:\n${renderPlanForGenerator(viewPlan(plan, TRIAGE_VIEW.plan))}`].join('\n\n')
}

/**
 * The reply's one object, the step record, merged into the plan. A handle its texts name must be in the scene or improvised. An improvised thing
 * that no text names is no problem: it costs nothing until something reads it.
 */
export const triageContract: StageContract<TriageInputs, ActionPlan> = {
    name: 'triage',
    parse: (reply, { input: { plan, target }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const rules = ruleTagHandles(rendered)
        const things = [...new Set(namedHandles(rendered))].filter((handle) => !rules.includes(handle))
        const merged = mergeStepRecord({ plan, target, record: parsed.object, things, rules }, TRIAGE_MERGE)
        if ('problems' in merged) {
            return merged
        }
        const known = [...things, ...(merged.plan.improvised ?? []).map(({ handle }) => handle)]
        const unknown = planHandles(merged.plan).filter((handle) => !known.includes(handle))
        return unknown.length > 0 ? { problems: unknown.map((handle) => `[${handle}] is not in the scene, and not improvised`) } : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkTriage = (reply: string, { inputs }: ReadPieceCell<TriageInputs>, rendered = ''): string[] =>
    parseProblems(triageContract.parse(reply, { input: inputs, rendered }))

/** A cell: the command in a scene. The plan and its target are code's. */
const commandCell = (fixture: string, command: string, lookFor: string, note?: string): ReadPieceCell<TriageInputs> => {
    const plan = planFromCommand(command)
    const [{ path: target }] = planSteps(plan)
    return { inputs: { fixture, plan, target }, lookFor, source: 'hand-written', ...(note === undefined ? {} : { note }) }
}

/** The expansion probe's commands, by what has to be supplied. What each looks for is mine until the user has read it. */
export const triageCells: Record<string, ReadPieceCell<TriageInputs>> = {
    'pour': commandCell('teaTable', 'pour tea',
        'says names [teapot1]; [tea2] apart, and a destination ([cup1], or none) recorded, not graded. Nothing improvised',
        'What is supplied is in the scene. Two things are called Tea, and [cup1] already holds one.'),
    'pour/cup': commandCell('teaTable', 'pour tea into the cup',
        'says names [teapot1] and [cup1]; [tea2] apart. Nothing improvised',
        'What is supplied is in the scene. playByPlay\'s cell for nearly this command named [teapot1] and left "tea", 29 of its 29 revisions.'),
    'light/hearth': commandCell('tavern', 'light the candle',
        'says names [candle1], and the hearth as the flame\'s source, in words or under an improvised handle glossed as the hearth. Another flame, a match or a taper improvised, is recorded: whether the hearth is used before it is the question',
        'The room\'s gloss establishes a hearth, which is no thing with a handle, so naming it at all may take an improvised one.'),
    'wipe/cloth': commandCell('teaTable', 'wipe the table with a cloth',
        'says names [table1] and one improvised cloth, its gloss a cloth'),
    'trim/sharp': commandCell('tavern', 'trim the wick of the candle with something sharp',
        'says names [candle1] and one improvised thing, its gloss something sharp. Not [hammer1]'),
    'cut': commandCell('tavernRope', 'cut the rope',
        'says names [rope1] and one improvised thing for cutting; or [rope1] alone, recorded. Not [hammer1]',
        'The user\'s example: the command implies a tool.'),
    'trim': commandCell('tavern', 'trim the wick of the candle',
        'as cut: [candle1], and one improvised thing for cutting; or [candle1] alone, recorded. Not [hammer1]'),
    'light/chapel': commandCell('feature', 'light the candle',
        'says names [candle1] and one improvised flame; or [candle1] alone, recorded',
        'No hearth: the pair of light/hearth.'),
    'wipe': commandCell('teaTable', 'wipe the table',
        'says names [table1], with a cloth improvised or not: recorded, not graded. Not the hand'),
    'take': commandCell('tavern', 'pick up the cup',
        'says names [cup1]. Nothing improvised, a hand included'),
    'slide': commandCell('teaTable', 'slide the saucer across the table',
        'says names [saucer1] and [table1]. Nothing improvised'),
    'take/twoCups': commandCell('twoCups', 'pick up the cup',
        'the cup left in the player\'s words: neither [cup1] nor [cup2] chosen, and no third improvised'),
}

/** It takes no options: the render and its settings are the view's. */
const parseTriageOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'triage takes no options')

export const triage: ReadPiece<TriageInputs, undefined> = {
    kind: 'read',
    name: 'triage',
    view: TRIAGE_VIEW,
    merges: TRIAGE_MERGE,
    cells: triageCells,
    check: checkTriage,
    parseOptions: parseTriageOptions,
    render: renderTriage,
}

export const registeredTriage = registerPiece(triage)

/** A batch's replies as their merged plans, for reading (`read-plans`). */
export const triagePlansText = plansText(triage, triageContract, renderPlanForGenerator)
