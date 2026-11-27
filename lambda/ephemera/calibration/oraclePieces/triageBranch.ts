//
// Triage's branch alone (AGENT.triage.planning.md, step 5, the branch-only arm): the split's branch call, asked only "No", "Yes" or "Defer",
// with the reason on "No", kind first, under a small output cap, so the call is quick. Its inputs and view are triage's, and on its default
// wording so is its render, so their inputs hashes match. It merges nothing, since its reply is no step record, so it is a registration of
// its own. The grounding a split would join it with is another call's, and the guard runs on the two together (`triageCombine.ts`). The
// branch judges the act alone: what the scene lacks, which thing is meant, and what a securing forbids are the guard's (the user, 2026-11-26).
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { replyJsonObject, type StageContract } from '../../llm/stageContract'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import type { PieceGrade } from '../pieceProbe/pieceAnswer'
import { isArmOf, sceneOptionShape, taggedExplicitScene, type SceneRenderer, type SceneWording } from '../pieceProbe/sceneRenders'
import { readVerdict, TRIAGE_KINDS, TRIAGE_VIEW, triageCells, triageRenderOn, type TriageInputs, type TriageVerdict } from './triage'
import { triageCorpus } from './triageCorpus'

/**
 * The reply's one object: `kind`, and `reason`, read as triage reads its verdict (`readVerdict`): required on "No", where the player reads
 * it, and dropped on another kind, where a draft may ask for it as room to think before the verdict (B4). Any other key refuses the reply,
 * since a branch call that writes more than its verdict has spent the time the split is for.
 */
export const triageBranchContract: StageContract<TriageInputs, TriageVerdict> = {
    name: 'triageBranch',
    parse: (reply) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const { kind, reason, ...rest } = parsed.object
        const extra = Object.keys(rest).map((key) => `has "${key}", beside "kind" and "reason"`)
        const verdict = readVerdict({ kind, reason })
        const problems = [...extra, ...('problems' in verdict ? verdict.problems : [])]
        return problems.length > 0 ? { problems } : { value: verdict as TriageVerdict }
    },
}

/** The grade: the kind as given, against the row's branch alone; or the parse's problems. What the guard makes of it needs a grounding. */
export const gradeTriageBranch = (reply: string, { inputs }: PieceCell<TriageInputs>, rendered: string): PieceGrade => {
    const parsed = triageBranchContract.parse(reply, { input: inputs, rendered })
    return 'problems' in parsed ? { malformed: parsed.problems.join('; ') } : { answer: parsed.value.kind }
}

/**
 * Triage's cells, each expecting the row's branch alone (`alone`, where it differs from the branch as shown: a "Defer" that is the guard's on
 * the grounding), and no aspect: the kind after the guard and the grounding are the combination's.
 */
export const triageBranchCells: Record<string, PieceCell<TriageInputs>> = Object.fromEntries(
    Object.entries(triageCells).map(([id, { expectedAspects: _, ...cell }]) => {
        const alone = triageCorpus[id]?.branch?.alone
        return [id, alone === undefined ? cell : { ...cell, expected: alone }]
    }),
)

/** Room for a short reason in its fenced block, and little else: a reply that writes more is cut off, and shows as malformed. */
export const TRIAGE_BRANCH_MAX_TOKENS = 128

/**
 * Each securing as what it lets things do, and nothing it forbids (`rules: 'carry'`): its fact and its carry line, with no rule handle and no
 * condition, since what a securing forbids is the guard's (the user, 2026-11-26).
 */
export const carryExplicitScene: SceneRenderer = ({ model }) => renderSceneExplicit(model, { rules: 'carry' })

/**
 * Each securing on the line of the thing that takes the other along, as what moving that thing does, with no fact word anywhere
 * (`rules: 'hostTakes'`): the branch reads a securing only for what it lets acts on the taker do (the user, 2026-11-26).
 */
export const hostTakesExplicitScene: SceneRenderer = ({ model }) => renderSceneExplicit(model, { rules: 'hostTakes' })

/**
 * The branch's wording: triage's, each securing tagged and stated as its condition and carry (`conditions`, B1's and B2's), by default; or
 * `carry`, each securing as what it lets things do alone; or `hostTakes`, each securing as what moving its taker does.
 */
export const TRIAGE_BRANCH_WORDING = { default: 'conditions', arms: { conditions: taggedExplicitScene, carry: carryExplicitScene, hostTakes: hostTakesExplicitScene } } as const satisfies SceneWording<'conditions' | 'carry' | 'hostTakes'>
type TriageBranchScene = keyof typeof TRIAGE_BRANCH_WORDING.arms

export type TriageBranchOptions = { scene: TriageBranchScene }

/** Triage's view, on the branch's own wording. */
export const TRIAGE_BRANCH_VIEW: PieceView = { ...TRIAGE_VIEW, wording: TRIAGE_BRANCH_WORDING }

const TRIAGE_BRANCH_OPTIONS: TriageBranchOptions = { scene: TRIAGE_BRANCH_WORDING.default }

/** No options, or `{ scene: 'conditions' | 'carry' | 'hostTakes' }`. */
const parseTriageBranchOptions = (value: unknown): TriageBranchOptions | string => {
    if (value === undefined) {
        return TRIAGE_BRANCH_OPTIONS
    }
    const shape = `triageBranch's options must be { scene?: ${sceneOptionShape(TRIAGE_BRANCH_WORDING)} }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { scene = TRIAGE_BRANCH_OPTIONS.scene, ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length > 0 || !isArmOf(TRIAGE_BRANCH_WORDING, scene) ? shape : { scene }
}

export const renderTriageBranch = triageRenderOn<TriageBranchScene>(TRIAGE_BRANCH_WORDING)

export const triageBranch: OraclePiece<TriageInputs, TriageBranchOptions> = {
    name: 'triageBranch',
    view: TRIAGE_BRANCH_VIEW,
    answers: TRIAGE_KINDS,
    maxTokens: TRIAGE_BRANCH_MAX_TOKENS,
    cells: triageBranchCells,
    grade: gradeTriageBranch,
    parseOptions: parseTriageBranchOptions,
    render: renderTriageBranch,
}

export const registeredTriageBranch = registerPiece(triageBranch)
