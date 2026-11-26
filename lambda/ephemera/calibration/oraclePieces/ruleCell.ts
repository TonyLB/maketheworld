//
// The rule cell (a Prototype of the oracle loop plan's Slice 4.5): the user's rules-blocking piece. One rule, the sub-scene of the things it names, and
// what the play-by-play says each of those things does in each action of the rule's window; one judgment, `blocks` or `allows`. Code
// computes the window, the actions before the one that voids the rule, and answers an empty window `allows` without a call. So every
// action the cell sees is one the rule is in force for, and the rule is shown as its fact and its enforcing rubric only (user, 2026-11-10).
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { judgeRules, type JudgeRuleLine } from '../../dataSource/actions/sceneProse/sceneRules'
import { viewedRules } from '../../dataSource/actions/sceneProse/viewedSceneModel'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import type { SceneView } from '../pieceProbe/sceneRenders'
import { shownScene, withViewedScene } from '../pieceProbe/viewedRender'
import { NO_PLAN_VIEW } from '../oracleLoop/actionPlan'

/** An action of the plan, and what the play-by-play says each of the rule's things does in it, keyed by the rule's ends exactly. */
export type RuleCellAction = { says: string; motions: Readonly<Record<SceneHandle, string>> }

export type RuleCellInputs = {
    fixture: string
    /** A rule handle of the fixture's scene, as `judgeRules` names it. */
    rule: string
    actions: readonly RuleCellAction[]
    /** The action that voids the rule, counted from 1; absent when none does. */
    voidedAt?: number
}

export type RuleCellOptions = {
    /** The sub-scene's own Rules section, in the built judge's `v45` wording; off by default (user: the cell doesn't judge rules that interact). */
    sceneRules: boolean
}

/**
 * The rule cell's scene (calibration AGENT.md, "Piece views"): the sub-scene of the rule's two things, its securing in the judge's own
 * wording, no Rules section (the user: the cell doesn't judge rules that interact), and its own Rule section showing the rule's fact and
 * enforcing rubric only ("each piece shows only the part it uses", the user, 2026-11-10).
 */
const RULE_CELL_SCENE = { shows: 'subScene', securing: 'shown', sceneRules: false, ruleParts: ['fact', 'enforcing'] } as const satisfies SceneView

/** The rule cell's view: no plan (the bridge state), and its scene. */
export const RULE_CELL_VIEW: PieceView = { plan: NO_PLAN_VIEW, scene: RULE_CELL_SCENE }

/** The view's settings, each an arm a payload may override for comparison. */
export const RULE_CELL_OPTIONS: RuleCellOptions = { sceneRules: RULE_CELL_SCENE.sceneRules }

/** The actions the rule is in force for: those before the voiding one, or all of them. */
export const ruleCellWindow = ({ actions, voidedAt }: RuleCellInputs): readonly RuleCellAction[] => (
    voidedAt === undefined ? actions : actions.slice(0, voidedAt - 1)
)

const parseRuleCellOptions = (value: unknown): RuleCellOptions | string => {
    if (value === undefined) {
        return RULE_CELL_OPTIONS
    }
    const shape = 'options must be { sceneRules?: boolean }'
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { sceneRules = RULE_CELL_OPTIONS.sceneRules, ...rest } = value as Record<string, unknown>
    if (Object.keys(rest).length > 0 || typeof sceneRules !== 'boolean') {
        return shape
    }
    return { sceneRules }
}


const sameHandles = (one: readonly string[], other: readonly string[]): boolean => (
    one.length === other.length && one.every((handle) => other.includes(handle))
)

/**
 * The checks that the cell fits its fixture (its rule is one of the scene's, as `judgeRules` names it, and each action's motions name
 * its two things), and the sub-scene's handles, the rule's ends: so the sub-scene holds both ends and the securing between them.
 */
const prepareRuleCell = ({ inputs }: PieceCell<RuleCellInputs>, _options: RuleCellOptions, full: SceneModel): { handles: readonly SceneHandle[] } => {
    const rules = judgeRules(full)
    const rule = rules.find(({ handle }) => handle === inputs.rule)
    if (rule === undefined) {
        throw new Error(`Unknown rule ${inputs.rule}; expected one of: ${rules.map(({ handle }) => handle).join(', ') || '(no rules)'}`)
    }
    const { voidedAt, actions } = inputs
    if (voidedAt !== undefined && !(Number.isInteger(voidedAt) && voidedAt >= 1 && voidedAt <= actions.length)) {
        throw new Error(`voidedAt ${voidedAt} is not an action: expected 1 to ${actions.length}`)
    }
    const offEnds = actions.findIndex(({ motions }) => !sameHandles(Object.keys(motions), rule.ends))
    if (offEnds !== -1) {
        throw new Error(`Action ${offEnds + 1}'s motions name ${Object.keys(actions[offEnds].motions).join(', ')}; expected the rule's things: ${rule.ends.join(', ')}`)
    }
    return { handles: rule.ends }
}

/** The cell's rule, read off the scene it may know, with its handle as the full model mints it; the prep has checked that it is there. */
const cellRule = (rules: readonly JudgeRuleLine[], handle: string): JudgeRuleLine => {
    const rule = rules.find((line) => line.handle === handle)
    if (rule === undefined) {
        throw new Error(`Rule ${handle} is not in the viewed scene`)
    }
    return rule
}

export const renderRuleCell = withViewedScene(RULE_CELL_SCENE, ({ inputs }: PieceCell<RuleCellInputs>, { sceneRules }: RuleCellOptions, viewed): string => {
    const shown = shownScene(viewed)
    const { model } = shown
    const rule = cellRule(viewedRules(shown), inputs.rule)
    const sections = judgeSceneSections(model)
    const scene = [
        `Scene: ${heading(model)}`,
        sections.fiction,
        sections.graph,
        ...(sceneRules && sections.rules !== undefined ? [sections.rules] : []),
        'End of scene.',
    ].join('\n\n')
    const cell = [
        ['Rule:', `- ${rule.handle}: ${(RULE_CELL_VIEW.scene.ruleParts ?? []).map((part) => rule.parts[part]).join(' ')}`].join('\n'),
        `The rule's things: ${rule.ends.map((handle) => `[${handle}]`).join(', ')}`,
        ...ruleCellWindow(inputs).map(({ says, motions }, index) => [
            `Action ${index + 1}: ${says}`,
            ...rule.ends.map((handle) => `- [${handle}]: ${motions[handle]}`),
        ].join('\n')),
    ]
    return [scene, ...cell].join('\n\n')
}, prepareRuleCell)

const stays = 'stays where it is'
const pickUpTable = 'pick up [table1]'
const pour = 'pour [tea2] from [teapot1] into [cup1]'
const tipToPour = 'tip [table1] so that [teapot1] pours [tea2] into [cup1]'
const pry = 'pry [teapot1] off [table1] with [hammer1]'
const glue = 'teapot-secured-to-table'
const paraphrased = "The motions are mine, paraphrased from the batch's summary in oracleLoopDrafts/12.notes.md; the replies aren't kept."

export const ruleCellCells: Record<string, PieceCell<RuleCellInputs>> = {
    'OC-1': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: pickUpTable, motions: { teapot1: 'rises with [table1], still on it', table1: 'is lifted off the floor' } }] },
        expected: 'allows',
        source: 'hand-written',
        note: 'The two move together: the risk is reading the glue as blocking the table.',
    },
    'OC-6/tilted': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: pour, motions: { teapot1: 'is lifted off [table1] and tilted to pour', table1: stays } }] },
        expected: 'blocks',
        source: 'batch 16, OC-6/2',
        note: paraphrased,
    },
    'OC-6/stays': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: pour, motions: { teapot1: 'stays where it is on [table1]', table1: stays } }] },
        expected: 'allows',
        source: 'batch 16, OC-6/1',
        note: `The play-by-play is wrong about the case (the tea can't pour), and the cell is graded given it. ${paraphrased}`,
    },
    'OC-30/2/tipped': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: tipToPour, motions: { teapot1: 'tips with [table1], not moving on it', table1: 'tips up at one edge' } }] },
        expected: 'allows',
        source: 'batch 16, OC-30/2/2',
        note: paraphrased,
    },
    'OC-30/2/together': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: tipToPour, motions: { teapot1: 'tilts', table1: 'tilts' } }] },
        expected: 'allows',
        source: 'hand-written',
        note: "PR-11's shape: each thing's motion stated, and not whether they move relative to each other.",
    },
    'OC-30/2/slides': {
        inputs: { fixture: 'teaTable', rule: glue, actions: [{ says: tipToPour, motions: { teapot1: 'slides across [table1] as [table1] tips', table1: 'tips up at one edge' } }] },
        expected: 'blocks',
        source: 'hand-written',
        note: 'PR-6\'s slide, put to the cell: an action that reads as moving the two together, and lines that say they move apart. Does the reply read the lines, or reason "tipped, but glued, so together" from the rule? (Draft 1, OC-30/2/tipped, in oracleLoopDrafts/ruleCell/1.notes.md.) "as [table1] tips" names the table, where "as it tips" could be read as the teapot (RC-L9 in oracleLoopDrafts/ruleCell/iterations.md, after draft 3).',
    },
    'OC-19/voided': {
        inputs: { fixture: 'teaTableHammerHeld', rule: glue, voidedAt: 1, actions: [{ says: pry, motions: { teapot1: 'is levered off [table1]', table1: stays } }] },
        expected: 'allows',
        source: 'hand-written',
        note: 'Voided at action 1, so the window is empty: answered by code.',
    },
    'OC-19/glued': {
        inputs: { fixture: 'teaTableHammerHeld', rule: glue, actions: [{ says: pry, motions: { teapot1: 'is levered up off [table1]', table1: stays } }] },
        expected: 'blocks',
        source: 'hand-written',
        note: 'The pry fails to void the rule, and the teapot is levered up while glued.',
    },
    'OC-20': {
        inputs: { fixture: 'teaTableChained', rule: 'table-secured-to-wall', actions: [{ says: pickUpTable, motions: { table1: 'is lifted and pulled away from [wall1]', wall1: stays } }] },
        expected: 'blocks',
        source: 'hand-written',
        note: 'The chain to the wall; the glued teapot plays no part.',
    },
}

export const ruleCell: OraclePiece<RuleCellInputs, RuleCellOptions> = {
    name: 'ruleCell',
    view: RULE_CELL_VIEW,
    answers: ['blocks', 'allows'],
    cells: ruleCellCells,
    parseOptions: parseRuleCellOptions,
    render: renderRuleCell,
    byCode: ({ inputs }) => (ruleCellWindow(inputs).length === 0 ? 'allows' : undefined),
}

export const registeredRuleCell = registerPiece(ruleCell)
