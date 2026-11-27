//
// Triage's grounding alone (AGENT.triage.planning.md, step 5, the grounding arm; its three-way split): the split's grounding call, which says
// the player's command in full, each thing the act involves named by its handle, improvised where the scene has none, or joined where the
// player's words fit several, and gives no verdict. Its reply is the step record, with what the act involves beside `says`, flat: `matched`
// and `improvised` (and `assumes`, read for later), without `kind` or `reason`. Its
// answer is the grounding itself, graded on every row (the user, 2026-11-27: a grounding does its work whatever another arm makes of it); what
// the guard makes of it is the split's, in `triageCombine.ts`. It sees the scene without its securing, since nothing in grounding uses one and
// the guard reads them from the scene model (2026-11-27).
//
import type { StageContract } from '../../llm/stageContract'
import { replyJsonObject } from '../../llm/stageContract'
import type { ActionPlan } from '../oracleLoop/actionPlan'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import type { PieceGrade } from '../pieceProbe/pieceAnswer'
import { explicitScene, type SceneWording } from '../pieceProbe/sceneRenders'
import {
    acceptedGroundings, addedWords, commandOf, groundingOf, matchedOf, mergeWithMatch, TRIAGE_MAX_TOKENS, TRIAGE_MERGE, TRIAGE_VIEW, triageCells,
    triageRenderOn, type TriageInputs,
} from './triage'
import { triageCorpus } from './triageCorpus'

/** The grounding's reading: the plan its reply merged into, what its match found, where it gave one, and what it assumes, where anything. No verdict. */
export type TriageGrounding = { plan: ActionPlan; involved?: string[]; assumes?: string[] }

/**
 * The block's one shape (decided by the user, 2026-11-27, after G1 to G5): flat, what the act involves beside `says`. The things found in
 * the scene go in `matched`, which pairs with `improvised` and keeps the cue "match" carried when it wrapped the lists (G1 to G3; unwrapped
 * as `inScene` in G4, the list was read as the scene's things). A nested `match`, an `inScene`, or the record's own `improvise` is a second
 * shape or name for one thing, so it refuses the reply. G1 to G4's replies, in shapes now refused, aren't read again: their notes are their
 * record.
 */
const shapeProblems = (object: Record<string, unknown>): string[] => [
    ...('match' in object ? ['the block is flat: no "match"; "matched", "improvised" and "assumes" go beside "says"'] : []),
    ...('inScene' in object ? ['the things the act matches in the scene go in "matched"'] : []),
    ...('improvise' in object ? ['improvised things go in "improvised"'] : []),
]

/**
 * The reply's one object: what the act involves (`matched`, `improvised`, `assumes`) beside the step record, read and merged as triage's
 * match and record are (`mergeWithMatch`). A `kind` or a `reason` is no key of the record, so it refuses the reply, as any other would: a
 * verdict leaking back into the grounding call.
 */
export const triageGroundingContract: StageContract<TriageInputs, TriageGrounding> = {
    name: 'triageGrounding',
    parse: (reply, shown) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const problems = shapeProblems(parsed.object)
        if (problems.length > 0) {
            return { problems }
        }
        const { matched, improvised, assumes, ...record } = parsed.object
        const lists = Object.fromEntries(Object.entries({ inScene: matched, improvised, assumes }).filter(([, value]) => value !== undefined))
        const merged = mergeWithMatch(record, Object.keys(lists).length === 0 ? undefined : lists, shown)
        return 'problems' in merged ? merged : { value: merged }
    },
}

/**
 * The grade: the grounding, in the form the corpus's accepted groundings take (`groundingOf`); beside it, tallied, what the match found, the
 * words added, and what it assumes, joined, or `none` (G3, the minimal build: counted to see where the outlet is used; no row expects it).
 */
export const gradeTriageGrounding = (reply: string, { inputs }: PieceCell<TriageInputs, GroundingsAccepted>, rendered: string): PieceGrade => {
    const parsed = triageGroundingContract.parse(reply, { input: inputs, rendered })
    if ('problems' in parsed) {
        return { malformed: parsed.problems.join('; ') }
    }
    const { plan } = parsed.value
    const assumes = parsed.value.assumes === undefined ? 'none' : parsed.value.assumes.join('; ')
    return { answer: groundingOf(plan), aspects: { matched: matchedOf(parsed.value), added: addedWords(plan, commandOf(inputs)), assumes }, plan }
}

/** A grounding cell's expected answer: the row's accepted groundings, any of which is right. */
type GroundingsAccepted = readonly string[]

/** Triage's cells, each expecting the row's accepted groundings, on every row: a "No" or an open branch is no reason to leave a grounding ungraded. */
export const triageGroundingCells: Record<string, PieceCell<TriageInputs, GroundingsAccepted>> = Object.fromEntries(
    Object.entries(triageCells).map(([id, { expected: _, expectedAspects: __, ...cell }]) => [id, { ...cell, expected: acceptedGroundings(triageCorpus[id]) }]),
)

/** One arm, the explicit render: with the securing omitted, there is nothing for a securing wording to say. */
export const TRIAGE_GROUNDING_WORDING = { default: 'explicit', arms: { explicit: explicitScene } } as const satisfies SceneWording<'explicit'>

/** Triage's view, its scene without the securing. */
export const TRIAGE_GROUNDING_VIEW: PieceView = { ...TRIAGE_VIEW, scene: { ...TRIAGE_VIEW.scene, securing: 'omitted' }, wording: TRIAGE_GROUNDING_WORDING }

const renderViewedGrounding = triageRenderOn(TRIAGE_GROUNDING_WORDING, TRIAGE_GROUNDING_VIEW)

export const renderTriageGrounding = (cell: Pick<PieceCell<TriageInputs>, 'inputs'>): Promise<string> => renderViewedGrounding(cell, undefined)

/** It takes no options: the render and its settings are the view's, and the block has one shape. */
const parseTriageGroundingOptions = (value: unknown): undefined | string => (value === undefined ? undefined : 'triageGrounding takes no options')

export const triageGrounding: OraclePiece<TriageInputs, undefined, GroundingsAccepted> = {
    name: 'triageGrounding',
    view: TRIAGE_GROUNDING_VIEW,
    merges: TRIAGE_MERGE,
    // The answer is the grounding, whose set is open: the grade reads it, never `answers`.
    answers: [],
    maxTokens: TRIAGE_MAX_TOKENS,
    cells: triageGroundingCells,
    grade: gradeTriageGrounding,
    parseOptions: parseTriageGroundingOptions,
    render: renderTriageGrounding,
}

export const registeredTriageGrounding = registerPiece(triageGrounding)
