//
// The rule cell (a Prototype of the oracle loop plan's Slice 4.5): the user's rules-blocking piece. One rule, the sub-scene of the things it names, and
// what the play-by-play says each of those things does in each action of the rule's window; one judgment, `blocks` or `allows`. Code
// computes the window, the actions before the one that voids the rule, and answers an empty window `allows` without a call. So every
// action the cell sees is one the rule is in force for, and the rule is shown as its fact and its enforcing rubric only (user, 2026-11-10).
//
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { judgeRules } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { registerPiece, type OraclePiece, type PieceCell } from './oraclePiece'

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
    /** The rule's things' sub-scene (user), or no scene, for comparison. */
    show: 'subScene' | 'none'
    /** The sub-scene's own Rules section, in the built judge's `v45` wording; off by default (user: the cell doesn't judge rules that interact). */
    sceneRules: boolean
}

export const RULE_CELL_OPTIONS: RuleCellOptions = { show: 'subScene', sceneRules: false }

const SHOWS: readonly RuleCellOptions['show'][] = ['subScene', 'none']

/** The actions the rule is in force for: those before the voiding one, or all of them. */
export const ruleCellWindow = ({ actions, voidedAt }: RuleCellInputs): readonly RuleCellAction[] => (
    voidedAt === undefined ? actions : actions.slice(0, voidedAt - 1)
)

const parseRuleCellOptions = (value: unknown): RuleCellOptions | string => {
    if (value === undefined) {
        return RULE_CELL_OPTIONS
    }
    const shape = `options must be { show?: ${SHOWS.join(' | ')}; sceneRules?: boolean }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { show = RULE_CELL_OPTIONS.show, sceneRules = RULE_CELL_OPTIONS.sceneRules, ...rest } = value as Record<string, unknown>
    if (Object.keys(rest).length > 0 || !(SHOWS as readonly unknown[]).includes(show) || typeof sceneRules !== 'boolean') {
        return shape
    }
    return { show: show as RuleCellOptions['show'], sceneRules }
}

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

const sameHandles = (one: readonly string[], other: readonly string[]): boolean => (
    one.length === other.length && one.every((handle) => other.includes(handle))
)

export const renderRuleCell = async ({ inputs }: PieceCell<RuleCellInputs>, { show, sceneRules }: RuleCellOptions): Promise<string> => {
    const full = await fixtureScene(inputs.fixture)
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
    const scene = (): string => {
        const sections = judgeSceneSections(subScene(full, rule.ends))
        return [
            `Scene: ${heading(full)}`,
            sections.fiction,
            sections.graph,
            ...(sceneRules && sections.rules !== undefined ? [sections.rules] : []),
            'End of scene.',
        ].join('\n\n')
    }
    const cell = [
        ['Rule:', `- ${rule.handle}: ${rule.parts.fact} ${rule.parts.enforcing}`].join('\n'),
        `The rule's things: ${rule.ends.map((handle) => `[${handle}]`).join(', ')}`,
        ...ruleCellWindow(inputs).map(({ says, motions }, index) => [
            `Action ${index + 1}: ${says}`,
            ...rule.ends.map((handle) => `- [${handle}]: ${motions[handle]}`),
        ].join('\n')),
    ]
    return [...(show === 'none' ? [] : [scene()]), ...cell].join('\n\n')
}

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
    answers: ['blocks', 'allows'],
    cells: ruleCellCells,
    parseOptions: parseRuleCellOptions,
    render: renderRuleCell,
    byCode: ({ inputs }) => (ruleCellWindow(inputs).length === 0 ? 'allows' : undefined),
}

export const registeredRuleCell = registerPiece(ruleCell)
