//
// Triage (AGENT.triage.planning.md): the first screen on a command. Given the player's raw command, as a plan's one unchecked step, and the
// whole scene, it says the step in full, and answers it: "No", with its reason, "Yes", or "Defer" to a more complicated judgment. The reply is
// the step record (calibration AGENT.md, "The action plan"), its improvised things with it, all of it merged, and beside it the verdict. An
// answered piece, its cells the corpus's rows (`triageCorpus.ts`). What code makes of its answer is `triageGuard.ts`'s, and the grade keeps
// the branch, the branch after the guard and the grounding apart.
//
import { renderSceneExplicit, ruleTagHandles } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract, type StageShown } from '../../llm/stageContract'
import { fixtureScene, namedHandles, planHandles } from '../imaginationPieces/imaginationScene'
import { plansText } from '../imaginationPieces/plansText'
import { expansionClosed, planOf, planSteps, renderPlanForGenerator, rewordingClosed, viewPlan, type ActionPlan, type MergeOptions } from '../oracleLoop/actionPlan'
import { mergeStepRecord } from '../oracleLoop/stepRecord'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import type { PieceGrade } from '../pieceProbe/pieceAnswer'
import { triageCorpus, type CorpusRow } from './triageCorpus'
import { guarded, saysHandles } from './triageGuard'

export type TriageInputs = {
    fixture: string
    /** The command as a plan, built by code (`planFromCommand`). */
    plan: ActionPlan
    /** The path of the plan's one step. */
    target: string
}

/** The kinds of answer: it can't be done, it is done as the plan says, or it is for a more complicated judgment. */
export const TRIAGE_KINDS = ['No', 'Yes', 'Defer'] as const
export type TriageKind = typeof TRIAGE_KINDS[number]

/** Triage's answer: its kind, with what that kind needs, and on every kind the plan its reply merged into. */
export type TriageAnswer =
    | { kind: 'No'; reason: string; plan: ActionPlan }
    | { kind: 'Yes'; plan: ActionPlan }
    | { kind: 'Defer'; plan: ActionPlan }

/** An answer without its plan. */
type TriageVerdict = { kind: 'No'; reason: string } | { kind: 'Yes' | 'Defer' }

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
export const renderTriage = async ({ inputs: { fixture, plan, target } }: Pick<PieceCell<TriageInputs>, 'inputs'>): Promise<string> => {
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

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * The reply's verdict: its `kind`, trimmed and in any case, and on "No" its `reason`, kept as written. A `reason` on another kind is no part
 * of that answer, so it is dropped, whatever its form.
 */
const readVerdict = ({ kind, reason }: { kind?: unknown; reason?: unknown }): TriageVerdict | { problems: string[] } => {
    if (typeof kind !== 'string') {
        return { problems: ['has no string "kind"'] }
    }
    const known = TRIAGE_KINDS.find((each) => each.toLowerCase() === kind.trim().toLowerCase())
    if (known === undefined) {
        return { problems: [`kind "${kind}" is not one of ${TRIAGE_KINDS.join(', ')}`] }
    }
    if (known !== 'No') {
        return { kind: known }
    }
    return nonEmptyString(reason) ? { kind: known, reason: reason.trim() } : { problems: ['"No" has no non-empty string "reason"'] }
}

/**
 * The step record merged into the plan. A handle its texts name must be in the scene or improvised. An improvised thing that no text names is
 * no problem: it costs nothing until something reads it.
 */
const mergeRecord = (record: Record<string, unknown>, { input: { plan, target }, rendered }: StageShown<TriageInputs>): { plan: ActionPlan } | { problems: string[] } => {
    const rules = ruleTagHandles(rendered)
    const things = [...new Set(namedHandles(rendered))].filter((handle) => !rules.includes(handle))
    const merged = mergeStepRecord({ plan, target, record, things, rules }, TRIAGE_MERGE)
    if ('problems' in merged) {
        return merged
    }
    const known = [...things, ...(merged.plan.improvised ?? []).map(({ handle }) => handle)]
    const unknown = planHandles(merged.plan).filter((handle) => !known.includes(handle))
    return unknown.length > 0 ? { problems: unknown.map((handle) => `[${handle}] is not in the scene, and not improvised`) } : merged
}

/**
 * The reply's one object: the step record, merged into the plan (`mergeRecord`), and the verdict beside it (`readVerdict`), taken off first.
 * A problem with either refuses the reply whole. The reason's handles aren't checked, and no kind has to name any.
 */
export const triageContract: StageContract<TriageInputs, TriageAnswer> = {
    name: 'triage',
    parse: (reply, shown) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { kind, reason, ...record } = parsed.object
        const merged = mergeRecord(record, shown)
        const verdict = readVerdict({ kind, reason })
        return 'problems' in merged || 'problems' in verdict
            ? { problems: [merged, verdict].flatMap((part) => ('problems' in part ? part.problems : [])) }
            : { value: { ...verdict, plan: merged.plan } }
    },
}

/**
 * The step's grounding, as the cells' `expectedAspects` have it: the handles its `says` names, sorted, then each improvised one as
 * `improvised`, since its name is free; or `none`. It can't see a handle in the wrong role, or a word left beside its handle.
 */
const groundingText = (named: readonly SceneHandle[], improvised: readonly SceneHandle[]): string => {
    const found = [...named.filter((handle) => !improvised.includes(handle)).sort(), ...named.filter((handle) => improvised.includes(handle)).map(() => 'improvised')]
    return found.length === 0 ? 'none' : found.join(', ')
}

export const groundingOf = (plan: ActionPlan): string => groundingText(saysHandles(plan), (plan.improvised ?? []).map(({ handle }) => handle))

/**
 * The probe's grade: the contract's answer, its kind as triage gave it, and beside it, tallied apart, the kind after the guard and the
 * grounding; or the parse's problems. The guard reads the fixture's full scene.
 */
export const gradeTriage = async (reply: string, { inputs }: PieceCell<TriageInputs>, rendered: string): Promise<PieceGrade> => {
    const parsed = triageContract.parse(reply, { input: inputs, rendered })
    if ('problems' in parsed) {
        return { malformed: parsed.problems.join('; ') }
    }
    const { kind, plan } = parsed.value
    const after = guarded(parsed.value, await fixtureScene(inputs.fixture))
    return { answer: kind, aspects: { afterGuard: after.kind, grounding: groundingOf(plan) }, plan }
}

/** The groundings a row accepts, as the grade gives them. */
const acceptedGroundings = ({ grounded }: CorpusRow): string[] =>
    grounded.map(({ says, improvise = [] }) => groundingText([...new Set(namedHandles(says))], improvise.map(({ handle }) => handle)))

/**
 * A row as a cell: the command as a plan, and what its branch settles. The grounding is graded on a "Yes" or a "Defer" alone (the bar, as
 * the user agreed it), and tallied on a "No" and on an open row.
 */
const corpusCell = (row: CorpusRow): PieceCell<TriageInputs> => {
    const { fixture, command, branch, from, lookFor } = row
    const plan = planFromCommand(command)
    const [{ path: target }] = planSteps(plan)
    return {
        inputs: { fixture, plan, target },
        ...(branch === undefined ? {} : {
            expected: branch.shown,
            expectedAspects: { afterGuard: [branch.after], ...(branch.shown === 'No' ? {} : { grounding: acceptedGroundings(row) }) },
        }),
        lookFor,
        source: `hand-written, from ${from}`,
    }
}

/** The corpus's rows, by their ids there. */
export const triageCells: Record<string, PieceCell<TriageInputs>> = Object.fromEntries(Object.entries(triageCorpus).map(([id, row]) => [id, corpusCell(row)]))

/** It takes no options: the render and its settings are the view's. */
const parseTriageOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'triage takes no options')

/** As `playByPlay`'s, whose record its reply is with a verdict beside it. */
export const TRIAGE_MAX_TOKENS = 1024

export const triage: OraclePiece<TriageInputs, undefined> = {
    name: 'triage',
    view: TRIAGE_VIEW,
    merges: TRIAGE_MERGE,
    answers: TRIAGE_KINDS,
    maxTokens: TRIAGE_MAX_TOKENS,
    cells: triageCells,
    grade: gradeTriage,
    parseOptions: parseTriageOptions,
    render: renderTriage,
}

export const registeredTriage = registerPiece(triage)

/** An answer for reading: the verdict, the one after the guard where it differs, the grounding, then the plan. */
const renderAnswer = async (answer: TriageAnswer, { fixture }: TriageInputs): Promise<string> => {
    const after = guarded(answer, await fixtureScene(fixture))
    return [
        answer.kind === 'No' ? `No: ${answer.reason}` : answer.kind,
        ...(after.kind === answer.kind ? [] : [`after the guard: ${after.kind}`]),
        `grounding: ${groundingOf(answer.plan)}`,
        renderPlanForGenerator(answer.plan),
    ].join('\n')
}

/** A batch's replies as their verdicts and merged plans, for reading (`read-plans`). */
export const triagePlansText = plansText(triage, triageContract, renderAnswer)
