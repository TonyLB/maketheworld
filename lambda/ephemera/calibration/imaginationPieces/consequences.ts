//
// Consequences, the imagination's other-things ask (AGENT.imagination.planning.md, steps 1.5 and 3): a read piece, and a reducer on the
// action plan (calibration AGENT.md, "The action plan"). Given a fixture, a plan, the path of the one step to expand and the things to
// describe, it says how each of those things moves as that step is done, and flags the consequences that work against the step's intent,
// in the change language. Code supplies each change's `to`, and the merge gives the new plan. Collateral consequences are listed, not
// flagged: the oracle family judges them. There is no answer set: code checks each reply's form (does the block merge?), and a reader
// reads the replies against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import {
    bracketChanges, mergeStepChanges, planOf, planSteps, renderPlanForGenerator, viewPlan, WHOLE_PLAN_VIEW, type ActionPlan, type MergeOptions,
} from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type PieceView, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { piecePart, requested } from '../pieceProbe/piecePart'
import { caseSource, imaginationOptionsParser, listedTwice, namedHandles, planHandles, renderScene, thingsLine, type ImaginationOptions } from './imaginationScene'
import { plansText } from './plansText'

export type ConsequencesInputs = {
    fixture: string
    /** The plan so far, each step's intent in it (the user, 2026-11-18: a reducer, not a sweep). */
    plan: ActionPlan
    /** The path of the step to expand: the reply adds to it alone. */
    target: string
    /**
     * The things to describe, by handle, listed by hand: those whose motion the plan doesn't state, named or not (user, 2026-11-11:
     * OC-30/2's cup, which the intent names, ends up no longer under the spout). A change may name these and the target step's own handles (`replyHandles`).
     */
    things: readonly SceneHandle[]
}

export type ConsequencesOptions = ImaginationOptions

/** The explicit render by default (the kept draft runs explicit, so the default flips; calibration's AGENT.md, "Scene renders"). */
export const CONSEQUENCES_OPTIONS: ConsequencesOptions = { scene: 'explicit' }

export const parseConsequencesOptions = imaginationOptionsParser(CONSEQUENCES_OPTIONS)

/**
 * The plan as it reads today, every kind at `all` (calibration AGENT.md, "Piece views"; to revisit when its cells hold unchecked items, booked under the oracle loop plan's Piece views item): dormant, since its cells hold no
 * unchecked or rule items. Additive, it confirms nothing, so the checker's mirror doesn't bind it to `all`; revise mode, once built, is a
 * registration of its own with its own view. The scene: the sub-scene of the things to describe and the plan's handles, each securing in
 * the render's own wording (`actionRule`'s impossibility, or the hosted carry line), since it names no rule.
 */
export const CONSEQUENCES_VIEW: PieceView = { plan: WHOLE_PLAN_VIEW, scene: { shows: 'subScene', securing: 'shown', sceneRules: false } }

/** What its block may hold: the sub-item kinds, against the listed things and the step's own handles. */
export const CONSEQUENCES_MERGE: MergeOptions = { author: 'consequences', handlesAre: 'a listed thing or named by the step' }

/**
 * The handles a reply may name (the user, 2026-11-18): the listed things, plus every handle in the
 * target step's own text and its intent. The success branch has to name what the intent names. One rule for every change.
 */
export const replyHandles = ({ plan, target, things }: Pick<ConsequencesInputs, 'plan' | 'target' | 'things'>): SceneHandle[] => {
    const step = planSteps(plan).find(({ path }) => path === target)
    const own = step === undefined ? [] : [step.says, ...step.items.flatMap((item) => (item.kind === 'intent' ? [item.says] : []))]
    return [...new Set([...things, ...own.flatMap(namedHandles)])]
}

export const renderConsequences = async ({ inputs: { fixture, plan, target, things } }: ReadPieceCell<ConsequencesInputs>, options: ConsequencesOptions): Promise<string> => {
    if (things.length === 0) {
        throw new Error('No things to describe')
    }
    const twice = listedTwice(things)
    if (twice.length > 0) {
        throw new Error(`Things listed twice: ${twice.join(', ')}`)
    }
    if (!planSteps(plan).some(({ path }) => path === target)) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const viewed = viewPlan(plan, CONSEQUENCES_VIEW.plan)
    const scene = await renderScene({ fixture, shown: [...things, ...planHandles(viewed)] }, CONSEQUENCES_VIEW.scene, options)
    return [...scene, `The plan:\n${renderPlanForGenerator(viewed)}`, `The step to expand: ${target}`, thingsLine(things, options)].join('\n\n')
}

/**
 * The stage's contract: the reply's block, its bare handles bracketed, scoped to the target and merged into the plan (`mergeStepChanges`),
 * against the listed things and the target step's own handles (`replyHandles`).
 */
export const consequencesContract: StageContract<ConsequencesInputs, ActionPlan> = {
    name: 'consequences',
    parse: (reply, { input: { plan, target, things }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const shown = [...new Set([...things, ...planHandles(viewPlan(plan, CONSEQUENCES_VIEW.plan)), ...namedHandles(rendered)])]
        const merged = mergeStepChanges(plan, target, bracketChanges(parsed.object, shown), replyHandles({ plan, target, things }), CONSEQUENCES_MERGE)
        return 'problems' in merged ? merged : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkConsequences = (reply: string, { inputs }: ReadPieceCell<ConsequencesInputs>, rendered = ''): string[] =>
    parseProblems(consequencesContract.parse(reply, { input: inputs, rendered }))

/**
 * The cells' plans, built by hand: the corpus has no per-step intents. Each is one step holding its intent and no consequences, so the
 * reply establishes the outcome rather than being handed it (the user, 2026-11-18). OC-30/2's step is split as h5 is, without the
 * intended consequence the trial's builder adds; OC-1's intent is its own text (the single-step rule).
 */
export const consequencesPlans = {
    'OC-30/2': planOf([{ step: { says: 'tip [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: '[teapot1] pours [tea2] into [cup1]' }] }]),
    'OC-1': planOf([{ step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]' }] }]),
    cup: planOf([{ step: { says: 'pick up [cup1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [cup1]' }] }]),
} satisfies Record<string, ActionPlan>

export const consequencesCells: Record<string, ReadPieceCell<ConsequencesInputs>> = {
    'OC-30/2': {
        inputs: { fixture: oracleCases['OC-30/2'].scene.fixture, plan: consequencesPlans['OC-30/2'], target: 'tip-table1', things: ['saucer1', 'cup1'] },
        lookFor: 'the saucer and cup slide off the tipped table, and the cup no longer under the spout is a problem against the intent',
        source: `${caseSource('OC-30/2')}, split as the OC-30 chain's hop 5`,
    },
    'OC-1': {
        inputs: { fixture: oracleCases['OC-1'].scene.fixture, plan: consequencesPlans['OC-1'], target: 'pick-up-table1', things: ['teapot1', 'cup1', 'saucer1'] },
        lookFor: 'everything on the table rises with it, and nothing works against the intent',
        source: caseSource('OC-1'),
        note: 'The control (step 1.5): a carry with no problem.',
    },
    // The over-flagging cells: actions where a hedge is a defect, baselined on draft 4 (batch 5) and read again on draft 5 (batch 6).
    // `OC-1/teapot1`'s bar is 0 of 3; `cup` is recorded, not gated (the user, 2026-11-18).
    cup: {
        inputs: { fixture: 'teaTable', plan: consequencesPlans.cup, target: 'pick-up-cup1', things: ['saucer1', 'tea1'] },
        lookFor: '[tea1] rises with [cup1] and [saucer1] stays, with no hedge and no concern',
        source: 'constructed (not an oracle corpus case), after teaTable\'s judge request "I want to pick up [cup1]." (expect simple)',
        note: 'Over-flagging, a mundane action: an ordinary actor under no pressure picks up a cup of tea, so there is no spread (imagined charity).',
    },
    'OC-1/teapot1': {
        inputs: { fixture: oracleCases['OC-1'].scene.fixture, plan: consequencesPlans['OC-1'], target: 'pick-up-table1', things: ['teapot1'] },
        lookFor: 'the glued [teapot1] rises with [table1], with no hedge and no concern',
        source: `${caseSource('OC-1')}, its things narrowed to [teapot1] (constructed)`,
        note: 'Over-flagging, a hedge against the scene: the glue line settles that [teapot1] goes with [table1].',
    },
}

/** As the play-by-play's, while the drafts tune what is said (PB-P6, PB-L16: the cap is per piece). */
export const CONSEQUENCES_MAX_TOKENS = 1024

export const consequences: ReadPiece<ConsequencesInputs, ConsequencesOptions> = {
    kind: 'read',
    name: 'consequences',
    view: CONSEQUENCES_VIEW,
    merges: CONSEQUENCES_MERGE,
    part: piecePart({
        answers: ['consequences'],
        inputs: ({ fixture, plan, things }, request): ConsequencesInputs => ({ fixture, plan, target: requested('consequences', request).target, things }),
        contract: consequencesContract,
        result: (plan) => ({ plan }),
        unread: ['missing'],
    }),
    maxTokens: CONSEQUENCES_MAX_TOKENS,
    cells: consequencesCells,
    check: checkConsequences,
    parseOptions: parseConsequencesOptions,
    render: renderConsequences,
}

export const registeredConsequences = registerPiece(consequences)

/** A batch's replies for reading (`read-plans`), as merged plans (`plansText`). */
export const consequencesPlansText = plansText(consequences, consequencesContract)
