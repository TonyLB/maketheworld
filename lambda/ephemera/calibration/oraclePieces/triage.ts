//
// Triage (AGENT.triage.planning.md): the first screen on a command. Given the player's raw command, as a plan's one unchecked step, and the
// whole scene, it says the step in full, and answers it: "No", with its reason, "Yes", or "Defer" to a more complicated judgment. The reply is
// the step record (calibration AGENT.md, "The action plan"), its improvised things with it, all of it merged, and beside it the verdict. An
// answered piece, its cells the corpus's rows (`triageCorpus.ts`). What code makes of its answer is `triageGuard.ts`'s, and the grade keeps
// the branch, the branch after the guard and the grounding apart.
//
import { ruleTagHandles } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract, type StageShown } from '../../llm/stageContract'
import { ambiguityProblems, bracketedReferences, fixtureScene, namedHandles, planHandles, planTexts } from '../imaginationPieces/imaginationScene'
import { plansText } from '../imaginationPieces/plansText'
import { expansionClosed, planOf, planSteps, renderPlanForGenerator, rewordingClosed, viewPlan, type ActionPlan, type MergeOptions } from '../oracleLoop/actionPlan'
import { mergeStepRecord } from '../oracleLoop/stepRecord'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import type { PieceGrade } from '../pieceProbe/pieceAnswer'
import { sceneRendererOf, taggedExplicitScene, type SceneWording } from '../pieceProbe/sceneRenders'
import { shownScene, withViewedScene } from '../pieceProbe/viewedRender'
import { triageCorpus, type CorpusRow } from './triageCorpus'
import { guarded } from './triageGuard'

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

/**
 * The things the reply's `match` says the act involves, each as a bracketed reference (`[cup1]`, `[cup1 | cup2]`): what it found in the scene,
 * then what it improvised. Beside the plan, never in it (the user, 2026-11-26), for the guard to read. Absent where the reply gave no `match`.
 */
type Involved = { involved?: readonly string[] }

/** Triage's answer: its kind, with what that kind needs, and on every kind the plan its reply merged into, and what its match found. */
export type TriageAnswer =
    | ({ kind: 'No'; reason: string; plan: ActionPlan } & Involved)
    | ({ kind: 'Yes'; plan: ActionPlan } & Involved)
    | ({ kind: 'Defer'; plan: ActionPlan } & Involved)

/** An answer without its plan. */
export type TriageVerdict = { kind: 'No'; reason: string } | { kind: 'Yes' | 'Defer' }

/** The authority for no kind, so everything it writes is unchecked. The rules a consequence may name are the ones the prompt shows, added per call. */
export const TRIAGE_MERGE: MergeOptions = { author: 'triage', adds: ['steps', 'consequence', 'improvise'], restates: true, handlesAre: 'in the scene or improvised' }

/**
 * Triage's wording: the explicit render, its securings tagged with their rule handles and stated as their conditions and carries, a first
 * setting picked for convenience (the user, 2026-11-24), an existing render with the parts triage needs: no precedent, and any draft may
 * change it.
 */
export const TRIAGE_WORDING = { default: 'explicit', arms: { explicit: taggedExplicitScene } } as const satisfies SceneWording<'explicit'>

/**
 * The step and its intent at `all`, which are all its plan holds, and what is improvised, which it may overwrite (the checker's mirror); and the
 * whole scene, its securing known, since grounding comes before there are handles to take a sub-scene of.
 */
export const TRIAGE_VIEW: PieceView = {
    plan: { reads: { step: 'all', intent: 'all', improvise: 'all' } },
    scene: { shows: 'whole', securing: 'known' },
    wording: TRIAGE_WORDING,
}

/** The player's command as a plan's one step, unchecked, its intent its own text. */
export const planFromCommand = (command: string): ActionPlan =>
    planOf([{ step: { says: command, suppliedBy: 'player' }, standing: 'unchecked', items: [{ kind: 'intent', says: command, standing: 'unchecked' }] }])

/** The whole scene, then the plan. Throws on a target that names no step, or one closed to triage, since no redraft could fix the refusal. */
const prepareTriage = ({ inputs: { plan, target } }: Pick<PieceCell<TriageInputs>, 'inputs'>): Record<string, never> => {
    const step = planSteps(plan).find(({ path }) => path === target)
    if (step === undefined) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const closed = rewordingClosed(step, TRIAGE_MERGE.author) ?? expansionClosed(step)
    if (closed !== undefined) {
        throw new Error(`The target "${target}" is closed to triage: ${closed}`)
    }
    return {}
}

/**
 * Triage's render on a wording: the scene its view shows, in the arm its options name (or the wording's default), then `The plan:`. Triage's
 * branch alone (`triageBranch.ts`) takes it on a wording of its own, and its grounding alone (`triageGrounding.ts`) on a view of its own.
 */
export const triageRenderOn = <Arm extends string>(wording: SceneWording<Arm>, view: Pick<PieceView, 'scene' | 'plan'> = TRIAGE_VIEW) => withViewedScene(view.scene, (
    { inputs: { plan } }: Pick<PieceCell<TriageInputs>, 'inputs'>, options: { scene?: Arm } | undefined, viewed,
): string => (
    [sceneRendererOf(wording, options?.scene)(shownScene(viewed)), `The plan:\n${renderPlanForGenerator(viewPlan(plan, view.plan))}`].join('\n\n')
), prepareTriage)

const renderViewedTriage = triageRenderOn(TRIAGE_WORDING)

export const renderTriage = (cell: Pick<PieceCell<TriageInputs>, 'inputs'>): Promise<string> => renderViewedTriage(cell, undefined)

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * The reply's verdict: its `kind`, trimmed and in any case, and on "No" its `reason`, kept as written. A `reason` on another kind is no part
 * of that answer, so it is dropped, whatever its form.
 */
export const readVerdict = ({ kind, reason }: { kind?: unknown; reason?: unknown }): TriageVerdict | { problems: string[] } => {
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

/** The scene's things, as the prompt shows them: every handle it names but its rules'. */
const shownThings = (rendered: string): SceneHandle[] => {
    const rules = ruleTagHandles(rendered)
    return [...new Set(namedHandles(rendered))].filter((handle) => !rules.includes(handle))
}

/** A handle as written, its brackets taken off, or undefined for what is no string. */
const bareHandle = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim().replace(/^\[(.*)\]$/, '$1').trim() : undefined)

/**
 * A reply's `match`, read: its `inScene` entries, each bracketed, its `improvised` list as written, for the merge to read as `improvise`, and
 * what it `assumes`, each trimmed (triage's grounding arm, G3; the user, 2026-11-27): what must hold, beyond what the scene says, for a thing
 * here to meet a need. Read and carried; nothing yet acts on it.
 */
type MatchRead = { inScene: string[]; improvised?: unknown; assumes: string[] }

/**
 * The block's `match`, `{"inScene": [...], "improvised": [...], "assumes": [...]}`, read apart from the record: an object with no other key,
 * `inScene` a list of strings, each a handle or an ambiguous reference, with or without its brackets, and `assumes` a list of non-empty
 * strings. All are optional.
 */
const readMatch = (match: unknown): MatchRead | { problems: string[] } => {
    if (typeof match !== 'object' || match === null || Array.isArray(match)) {
        return { problems: ['"match" is not an object'] }
    }
    const { inScene = [], improvised, assumes = [], ...rest } = match as Record<string, unknown>
    const problems = Object.keys(rest).map((key) => `"match" has "${key}", not one of inScene, improvised, assumes`)
    if (!Array.isArray(inScene)) {
        return { problems: [...problems, '"inScene" is not a list'] }
    }
    const entries = inScene.map((entry, index) => (typeof entry === 'string' && entry.trim() !== '' ? `[${bareHandle(entry)}]` : index))
    const notStrings = entries.filter((entry): entry is number => typeof entry === 'number').map((index) => `inScene entry ${index + 1} is not a non-empty string`)
    const assumed = Array.isArray(assumes) && assumes.every(nonEmptyString) ? assumes.map((each) => each.trim()) : undefined
    const assumesProblems = assumed === undefined ? ['"assumes" is not a list of non-empty strings'] : []
    const all = [...problems, ...notStrings, ...assumesProblems]
    return all.length > 0 ? { problems: all } : { inScene: entries as string[], improvised, assumes: assumed ?? [] }
}

/**
 * What is wrong with a match's `inScene` once the plan is merged: a side not among the scene's things, a side improvised, since `inScene` holds
 * what the scene has, and an ambiguous entry's own faults (`ambiguityProblems`).
 */
const inSceneProblems = (inScene: readonly string[], things: readonly SceneHandle[], improvised: readonly SceneHandle[]): string[] => inScene.flatMap((entry) => {
    const sides = bracketedReferences(entry)[0] ?? []
    return [
        ...sides.filter((side) => side !== '' && improvised.includes(side)).map((side) => `inScene: [${side}] is improvised, and "inScene" holds what the scene has`),
        ...sides.filter((side) => side !== '' && !improvised.includes(side) && !things.includes(side)).map((side) => `inScene: [${side}] is not in the scene`),
        ...ambiguityProblems(entry, []).map((problem) => `inScene: ${problem}`),
    ]
})

/**
 * The step record merged into the plan. A handle its texts name must be in the scene or improvised, and an ambiguous reference must be well
 * formed (`ambiguityProblems`). An improvised thing that no text names is no problem: it costs nothing until something reads it.
 */
const mergeRecord = (record: Record<string, unknown>, { input: { plan, target }, rendered }: StageShown<TriageInputs>): { plan: ActionPlan } | { problems: string[] } => {
    const rules = ruleTagHandles(rendered)
    const things = shownThings(rendered)
    const merged = mergeStepRecord({ plan, target, record, things, rules }, TRIAGE_MERGE)
    if ('problems' in merged) {
        return merged
    }
    const improvised = (merged.plan.improvised ?? []).map(({ handle }) => handle)
    const known = [...things, ...improvised]
    const problems = [
        ...planHandles(merged.plan).filter((handle) => !known.includes(handle)).map((handle) => `[${handle}] is not in the scene, and not improvised`),
        ...planTexts(merged.plan).flatMap((text) => ambiguityProblems(text, improvised)),
    ]
    return problems.length > 0 ? { problems } : merged
}

/**
 * The match and the record together: the match's `improvised` merged as the record's `improvise` (refused where both are given), and then its
 * `inScene` checked against the scene and the merged plan's improvised things. With no match, the record alone, and nothing involved.
 */
export const mergeWithMatch = (record: Record<string, unknown>, match: unknown, shown: StageShown<TriageInputs>): { plan: ActionPlan; involved?: string[]; assumes?: string[] } | { problems: string[] } => {
    if (match === undefined) {
        return mergeRecord(record, shown)
    }
    const read = readMatch(match)
    if ('problems' in read) {
        return read
    }
    if (read.improvised !== undefined && record.improvise !== undefined) {
        return { problems: ['"improvise" is given both in "match" and beside it'] }
    }
    const merged = mergeRecord(read.improvised === undefined ? record : { ...record, improvise: read.improvised }, shown)
    if ('problems' in merged) {
        return merged
    }
    const improvised = (merged.plan.improvised ?? []).map(({ handle }) => handle)
    const problems = inSceneProblems(read.inScene, shownThings(shown.rendered), improvised)
    if (problems.length > 0) {
        return { problems }
    }
    const own = Array.isArray(read.improvised) ? read.improvised.map((entry) => bareHandle((entry as { handle?: unknown } | null)?.handle)).filter((handle): handle is string => handle !== undefined) : []
    return {
        plan: merged.plan,
        involved: [...new Set([...read.inScene, ...own.map((handle) => `[${handle}]`)])],
        ...(read.assumes.length === 0 ? {} : { assumes: read.assumes }),
    }
}

/**
 * The reply's one object: the step record, merged into the plan (`mergeRecord`), the verdict beside it (`readVerdict`) and the match before
 * it (`readMatch`), both taken off first. A problem with any refuses the reply whole. The reason's handles aren't checked, and no kind has to
 * name any.
 */
export const triageContract: StageContract<TriageInputs, TriageAnswer> = {
    name: 'triage',
    parse: (reply, shown) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { kind, reason, match, ...record } = parsed.object
        const merged = mergeWithMatch(record, match, shown)
        const verdict = readVerdict({ kind, reason })
        return 'problems' in merged || 'problems' in verdict
            ? { problems: [merged, verdict].flatMap((part) => ('problems' in part ? part.problems : [])) }
            : { value: { ...verdict, plan: merged.plan, ...(merged.involved === undefined ? {} : { involved: merged.involved }) } }
    },
}

/**
 * The step's grounding, as the cells' `expectedAspects` have it: the references its `says` makes, each once, sorted, an ambiguous one as its
 * sides sorted and joined, `cup1|cup2`; then each improvised one as `improvised`, since its name is free; or `none`. It can't see a handle in
 * the wrong role, or a word left beside its handle.
 */
const groundingText = (texts: readonly string[], improvised: readonly SceneHandle[]): string => {
    const references = [...new Set(texts.flatMap(bracketedReferences).map((sides) => [...sides].sort().join('|')))]
    const found = [...references.filter((reference) => !improvised.includes(reference)).sort(), ...references.filter((reference) => improvised.includes(reference)).map(() => 'improvised')]
    return found.length === 0 ? 'none' : found.join(', ')
}

export const groundingOf = (plan: ActionPlan): string => groundingText(plan.steps.map(({ says }) => says), (plan.improvised ?? []).map(({ handle }) => handle))

/** What the match found, in the grounding's form, so the two can be read side by side; or `absent`, where the reply gave no match. */
export const matchedOf = ({ plan, involved }: { plan: ActionPlan; involved?: readonly string[] }): string => (involved === undefined ? 'absent' : groundingText(involved, (plan.improvised ?? []).map(({ handle }) => handle)))

/** The words that join a thing to a step, or lead into one: what a step may hold beside its handles and the player's own words. */
const JOINING_WORDS: ReadonlySet<string> = new Set([
    'a', 'an', 'the', 'and', 'at', 'by', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'across', 'to', 'using', 'with',
])

const wordsOf = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? []

/**
 * The words the plan's step adds to the player's, each once, in order: none of its handles, none of the command's words, and no joining word;
 * or `none`. What they are is thoughts of how the step is done, or of what stands in its way, that went into the step.
 */
export const addedWords = (plan: ActionPlan, command: string): string => {
    const given = new Set(wordsOf(command))
    const added = plan.steps.flatMap(({ says }) => wordsOf(says.replace(/\[[^\]]*\]/g, ' '))).filter((word) => !given.has(word) && !JOINING_WORDS.has(word))
    return added.length === 0 ? 'none' : [...new Set(added)].join(' ')
}

/** The player's command, as the input plan's one step has it. */
export const commandOf = ({ plan }: TriageInputs): string => plan.steps.map(({ says }) => says).join(' ')

/**
 * The probe's grade: the contract's answer, its kind as triage gave it, and beside it, tallied apart, the kind after the guard, the grounding,
 * what the match found and the words added to the player's (the last two no cell expects, so they are never graded); or the parse's
 * problems. The guard reads the fixture's full scene.
 */
export const gradeTriage = async (reply: string, { inputs }: PieceCell<TriageInputs>, rendered: string): Promise<PieceGrade> => {
    const parsed = triageContract.parse(reply, { input: inputs, rendered })
    if ('problems' in parsed) {
        return { malformed: parsed.problems.join('; ') }
    }
    const { kind, plan } = parsed.value
    const after = guarded(parsed.value, await fixtureScene(inputs.fixture))
    return { answer: kind, aspects: { afterGuard: after.kind, grounding: groundingOf(plan), matched: matchedOf(parsed.value), added: addedWords(plan, commandOf(inputs)) }, plan }
}

/** The groundings a row accepts, as the grade gives them. */
export const acceptedGroundings = ({ grounded }: CorpusRow): string[] =>
    grounded.map(({ says, improvise = [] }) => groundingText([says], improvise.map(({ handle }) => handle)))

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

/** An answer for reading: the verdict, the one after the guard where it differs, the grounding, the words added to the player's where there are any, then the plan. */
const renderAnswer = async (answer: TriageAnswer, inputs: TriageInputs): Promise<string> => {
    const after = guarded(answer, await fixtureScene(inputs.fixture))
    const added = addedWords(answer.plan, commandOf(inputs))
    return [
        answer.kind === 'No' ? `No: ${answer.reason}` : answer.kind,
        ...(after.kind === answer.kind ? [] : [`after the guard: ${after.kind}`]),
        `grounding: ${groundingOf(answer.plan)}`,
        ...(answer.involved === undefined ? [] : [`matched: ${matchedOf(answer)}`]),
        ...(added === 'none' ? [] : [`added: ${added}`]),
        renderPlanForGenerator(answer.plan),
    ].join('\n')
}

/** A batch's replies as their verdicts and merged plans, for reading (`read-plans`). */
export const triagePlansText = plansText(triage, triageContract, renderAnswer)
