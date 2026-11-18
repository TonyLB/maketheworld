//
// Consequences, the imagination's other-things ask (AGENT.imagination.planning.md, steps 1.5 and 3): a read piece, and a reducer on the
// action plan (AGENT.actionPlan.planning.md, step 4b). Given a fixture, a plan, the path of the one step to expand and the things to
// describe, it says how each of those things moves as that step is done, and flags the consequences that work against the step's intent,
// in the change language. Code supplies each change's `to`, and the merge gives the new plan. Collateral consequences are listed, not
// flagged: the oracle family judges them. There is no answer set: code checks each reply's form (does the block merge?), and a reader
// reads the replies against each cell's `lookFor`.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { parseProblems, replyJsonObject, type StageContract } from '../../llm/stageContract'
import { bracketHandles, mergeStepChanges, planOf, renderPlanForGenerator, type ActionPlan } from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { registerPiece, type ReadPiece, type ReadPieceCell } from '../pieceProbe/oraclePiece'
import { caseSource, listedTwice, namedHandles, parseImaginationOptions, renderScene, thingsLine, type ImaginationOptions } from './imaginationScene'
import { plansText } from './plansText'

export type ConsequencesInputs = {
    fixture: string
    /** The plan so far, each step's intent in it (the user, 2026-11-18: a reducer, not a sweep). */
    plan: ActionPlan
    /** The path of the step to expand: the reply adds to it alone. */
    target: string
    /**
     * The things to describe, by handle, listed by hand: those whose motion the plan doesn't state, named or not (user, 2026-11-11:
     * OC-30/2's cup, which the intent names, ends up no longer under the spout). A change may name only these (mine, step 4b).
     */
    things: readonly SceneHandle[]
}

export type ConsequencesOptions = ImaginationOptions

/** The explicit render by default (step 4b: the kept draft runs explicit, so the default flips; calibration's AGENT.md, "Scene renders"). */
export const CONSEQUENCES_OPTIONS: ConsequencesOptions = { rules: 'none', scene: 'explicit' }

/** The imagination's options, with the scene filled in before the check, so the default too refuses `rules: 'consequence'`. */
export const parseConsequencesOptions = (value: unknown): ConsequencesOptions | string =>
    parseImaginationOptions(value === undefined ? CONSEQUENCES_OPTIONS : typeof value === 'object' && value !== null && !Array.isArray(value) && !('scene' in value)
        ? { ...value, scene: CONSEQUENCES_OPTIONS.scene }
        : value)

/** The handles a plan's text names, each once, in order. */
const planHandles = ({ steps }: ActionPlan): SceneHandle[] =>
    [...new Set(steps.flatMap(({ says, items }) => [says, ...items.map((item) => item.says)]).flatMap(namedHandles))]

export const renderConsequences = async ({ inputs: { fixture, plan, target, things } }: ReadPieceCell<ConsequencesInputs>, options: ConsequencesOptions): Promise<string> => {
    if (things.length === 0) {
        throw new Error('No things to describe')
    }
    const twice = listedTwice(things)
    if (twice.length > 0) {
        throw new Error(`Things listed twice: ${twice.join(', ')}`)
    }
    if (!plan.steps.some(({ path }) => path === target)) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const scene = await renderScene({ fixture, shown: [...things, ...planHandles(plan)] }, options)
    return [...scene, `The plan:\n${renderPlanForGenerator(plan)}`, `The step to expand: ${target}`, thingsLine(things, options)].join('\n\n')
}

/**
 * A block with each change's `says` repaired: bare handles bracketed (`bracketHandles`, CQ-P5), against every handle the prompt names
 * (the listed things, the plan's, and the rendered text's, when it is given). Anything else is left for the merge to check.
 */
export const bracketChanges = (block: Record<string, unknown>, handles: readonly SceneHandle[]): Record<string, unknown> => {
    const { changes } = block
    if (!Array.isArray(changes)) {
        return block
    }
    return {
        ...block,
        changes: changes.map((entry) => (
            typeof entry === 'object' && entry !== null && !Array.isArray(entry) && typeof (entry as Record<string, unknown>).says === 'string'
                ? { ...entry, says: bracketHandles((entry as Record<string, unknown>).says as string, handles) }
                : entry
        )),
    }
}

/**
 * The stage's contract: the reply's block, its bare handles bracketed, scoped to the target and merged into the plan (`mergeStepChanges`),
 * against the listed things.
 */
export const consequencesContract: StageContract<ConsequencesInputs, ActionPlan> = {
    name: 'consequences',
    parse: (reply, { input: { plan, target, things }, rendered }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const shown = [...new Set([...things, ...planHandles(plan), ...namedHandles(rendered)])]
        const merged = mergeStepChanges(plan, target, bracketChanges(parsed.object, shown), things, { handlesAre: 'a listed thing' })
        return 'problems' in merged ? merged : { value: merged.plan }
    },
}

/** The probe's form check: the contract's parse problems. */
export const checkConsequences = (reply: string, { inputs }: ReadPieceCell<ConsequencesInputs>, rendered = ''): string[] =>
    parseProblems(consequencesContract.parse(reply, { input: inputs, rendered }))

/**
 * The cells' plans, built by hand: the corpus has no per-step intents. Each is one step holding its intent and no consequences, so the
 * reply establishes the outcome rather than being handed it (the user, 2026-11-18). OC-30/2's step is split as h5 is, without AP-7's
 * intended consequence; OC-1's intent is its own text (the single-step rule).
 */
export const consequencesPlans = {
    'OC-30/2': planOf([{ step: { says: 'tip [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: '[teapot1] pours [tea2] into [cup1]' }] }]),
    'OC-1': planOf([{ step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]' }] }]),
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
}

/** As the play-by-play's, while the drafts tune what is said (PB-P6, PB-L16: the cap is per piece). */
export const CONSEQUENCES_MAX_TOKENS = 1024

export const consequences: ReadPiece<ConsequencesInputs, ConsequencesOptions> = {
    kind: 'read',
    name: 'consequences',
    maxTokens: CONSEQUENCES_MAX_TOKENS,
    cells: consequencesCells,
    check: checkConsequences,
    parseOptions: parseConsequencesOptions,
    render: renderConsequences,
}

export const registeredConsequences = registerPiece(consequences)

/** A batch's replies for reading (`read-plans`), as merged plans (`plansText`). */
export const consequencesPlansText = plansText('consequences', consequencesCells, consequencesContract)
