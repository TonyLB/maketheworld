//
// Scene reading (AGENT.trialQuestion.planning.md, step 0; the explicit render is the user's idea, 2026-11-16): an answered piece that asks
// one yes-or-no question of a scene alone, with no request, no steps and nothing argued. It compares two renders of the same scene, the
// securing removed (`withoutSecuring`) in both, as the trial shows it:
// - `sections`, the judge render the trial uses today (`renderSceneJudge`), read with a Reading the scene guide in the draft;
// - `explicit`, the explicit render (`renderSceneExplicit`), with no guide.
// The two arms are two payloads with different drafts, so the option has no default. Each cell's scene is a trial case's, and its question
// is aimed at one of the trial's misses (QS-5). Code grades the reply's `answer` against the cell's expected one.
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { renderSceneJudge } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene, namedHandles } from '../imaginationPieces/imaginationScene'
import { registerPiece, type OraclePiece, type PieceCell, type PieceView } from '../pieceProbe/oraclePiece'
import { nonRuleCellCells } from './nonRuleCell'
import { NO_PLAN_VIEW } from '../oracleLoop/actionPlan'

export type SceneReadingInputs = { fixture: string; question: string }

export const SCENE_READING_RENDERS = ['sections', 'explicit'] as const
export type SceneReadingRender = typeof SCENE_READING_RENDERS[number]
export type SceneReadingOptions = { render: SceneReadingRender }

export const SCENE_READING_ANSWERS = ['yes', 'no'] as const

const QUESTION_LINE = 'The question: '

export const parseSceneReadingOptions = (value: unknown): SceneReadingOptions | string => {
    const shape = `sceneReading's options must be { render: ${SCENE_READING_RENDERS.map((render) => `'${render}'`).join(' | ')} }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { render, ...rest } = value as Record<string, unknown>
    return Object.keys(rest).length === 0 && (SCENE_READING_RENDERS as readonly unknown[]).includes(render)
        ? { render: render as SceneReadingRender }
        : shape
}

/**
 * The scene reading's view (AGENT.pieceViews.planning.md, step 3): no plan, and the whole scene with the securing omitted, as the trial
 * shows it. Which render it takes is the arm the piece compares (`render`), with no default.
 */
export const SCENE_READING_VIEW: PieceView = { plan: NO_PLAN_VIEW, scene: { shows: 'whole', securing: 'omitted', sceneRules: false } }

/** The scene in the named render, the securing as the view states it, then the question. Throws on a question naming a thing not in the scene. */
export const renderSceneReading = async ({ inputs: { fixture, question } }: PieceCell<SceneReadingInputs>, { render }: SceneReadingOptions): Promise<string> => {
    const full = await fixtureScene(fixture)
    const scene = SCENE_READING_VIEW.scene.securing === 'omitted' ? withoutSecuring(full) : full
    const unknown = namedHandles(question).filter((handle) => scene.things[handle] === undefined)
    if (unknown.length > 0) {
        throw new Error(`The question names ${unknown.join(', ')}, not in ${fixture}'s scene`)
    }
    const rendered = render === 'explicit' ? renderSceneExplicit(scene) : renderSceneJudge(scene)
    return `${rendered}\n\n${QUESTION_LINE}${question}`
}

/** A cell on a trial case's scene: its fixture read from the case, so the scene is the trial's by construction. */
const asked = (id: string, trialCase: string, question: string, expected: typeof SCENE_READING_ANSWERS[number], lookFor: string): [string, PieceCell<SceneReadingInputs>] => [id, {
    inputs: { fixture: nonRuleCellCells[trialCase].inputs.fixture, question },
    source: `the scene of the trial's ${trialCase}; a hand-written question (QS-5)`,
    expected,
    lookFor,
}]

/** The questions, their expected answers and what each aims at: mine, accepted by the user (QS-5, 2026-11-17). There is no R-2. */
export const sceneReadingCells: Record<string, PieceCell<SceneReadingInputs>> = Object.fromEntries([
    asked('R-1', 'OC-11', 'Could [table1] fit inside [cup1]?', 'no', 'the size: no ordinary table fits in a cup; "small round, so it fits" is TR-P16\'s miss'),
    asked('R-3', 'OC-1', 'Could one person pick up [table1]?', 'yes', 'the guard\'s size, the other way: a small round tea table is light enough for one person'),
    asked('R-4', 'OC-6', 'Is [tea2] in something tea can be poured from?', 'yes', 'the guard\'s container: [tea2] is in [teapot1], which is what tea is poured from'),
    asked('R-5', 'OC-30/h7', 'If [table1] is tipped steeply, does [cup1] stay where it is?', 'no', 'the slide (TR-P14): the saucer and cup slide or tip off a steeply tipped table'),
    asked('R-6', 'OC-30/h7', 'If [table1] is carried level across the room, do [saucer1] and [cup1] go with it?', 'yes', 'the carry: what is on the table goes with it when it is carried level'),
    asked('R-7', 'OC-30/h7', 'If [saucer1] is picked up, does [cup1] come with it?', 'yes', 'h10\'s hinge: the cup on the saucer comes with it'),
    asked('R-8', 'OC-30/h7', 'If [saucer1] is picked up, does [teapot1] come with it?', 'no', 'the carry spread too far: the teapot is on the table, not on the saucer (affordance\'s failure in SP-10)'),
    asked('R-9', 'OC-30/h7', 'If [cup1] is held under [teapot1]\'s spout and [teapot1] is tilted, does tea go into [cup1]?', 'yes', 'an unstated capacity, the default: an ordinary teapot pours; "the scene doesn\'t say it has a spout" read as no is TR-P20\'s failure'),
])

export const sceneReading: OraclePiece<SceneReadingInputs, SceneReadingOptions> = {
    name: 'sceneReading',
    view: SCENE_READING_VIEW,
    answers: SCENE_READING_ANSWERS,
    cells: sceneReadingCells,
    parseOptions: parseSceneReadingOptions,
    render: renderSceneReading,
    maxTokens: 400,
}

export const registeredSceneReading = registerPiece(sceneReading)
