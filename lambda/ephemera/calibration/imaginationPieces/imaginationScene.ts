//
// What the imagination's pieces render in common (AGENT.imagination.planning.md, step 1.5): the `scene` option, over the judge and
// explicit arms, and the handles a plan names. Both pieces are reducers on the action plan, replying in its change language.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { itemTexts, type ActionPlan } from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { isArmOf, JUDGE_OR_EXPLICIT, sceneOptionShape, type JudgeOrExplicit } from '../pieceProbe/sceneRenders'

/**
 * The imagination's options: which of the piece's named renderers the sub-scene takes, an experiment arm (calibration AGENT.md, "Scene
 * renders"), its wording's default when absent. How each arm words a securing is the arm's own (calibration AGENT.md, "Piece views"). The `rules` option it replaces (retired 2026-11-22, the user) also took
 * `consequence` (each rule's fact and what it does, after the judge's Graph) and `handles` (batches 35 to 40), which no live arm used.
 */
export type ImaginationOptions = { scene?: JudgeOrExplicit }

/** `{ scene?: 'judge' | 'explicit' }`, over a piece's default: with no options, or no `scene`, the default's. */
export const imaginationOptionsParser = (defaults: ImaginationOptions) => (value: unknown): ImaginationOptions | string => {
    if (value === undefined) {
        return defaults
    }
    const shape = `options must be { scene?: ${sceneOptionShape({ arms: JUDGE_OR_EXPLICIT })} }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { scene = defaults.scene, ...rest } = value as Record<string, unknown>
    if (Object.keys(rest).length > 0 || (scene !== undefined && !isArmOf({ arms: JUDGE_OR_EXPLICIT }, scene))) {
        return shape
    }
    return scene === undefined ? {} : { scene }
}

export { fixtureScene } from '../pieceProbe/viewedRender'

/**
 * The references a text makes in brackets, in order, each as the handles it may be: one, or for an ambiguous reference, `[tea1 | tea2]`, each
 * thing the player's words fit equally well, trimmed, in the order written. A side left empty is kept, for `ambiguityProblems` to name.
 */
export const bracketedReferences = (text: string): SceneHandle[][] =>
    [...text.matchAll(/\[([^\]]+)\]/g)].map(([, inner]) => (inner.includes('|') ? inner.split('|').map((side) => side.trim()) : [inner]))

/** The ambiguous references a text makes, each as its sides. */
export const ambiguousReferences = (text: string): SceneHandle[][] => bracketedReferences(text).filter((sides) => sides.length > 1)

/** The handles a text names in brackets, in order: every side of an ambiguous reference, so every reader sees each candidate. */
export const namedHandles = (text: string): SceneHandle[] => bracketedReferences(text).flat().filter((handle) => handle !== '')

/**
 * What is wrong with a text's ambiguous references, each in the reply's terms: a side left empty, one named twice, or one improvised, since an
 * ambiguous reference holds only things in the scene (the user, 2026-11-25). Whether its sides are in the scene is the caller's check.
 */
export const ambiguityProblems = (text: string, improvised: readonly SceneHandle[]): string[] => ambiguousReferences(text).flatMap((sides) => {
    const written = `[${sides.join(' | ')}]`
    return [
        ...(sides.includes('') ? [`${written} has an empty side`] : []),
        ...[...new Set(sides.filter((side, index) => side !== '' && sides.indexOf(side) !== index))].map((side) => `${written} names [${side}] twice`),
        ...[...new Set(sides.filter((side) => improvised.includes(side)))].map((side) => `${written}: [${side}] is improvised, and an ambiguous reference holds only things in the scene`),
    ]
})

/** A plan's texts, its sub-steps' included, in order. */
export const planTexts = ({ steps }: ActionPlan): string[] => steps.flatMap(({ says, items }) => [says, ...items.flatMap(itemTexts)])

/** The handles a plan's text names, its sub-steps' included, each once, in order. */
export const planHandles = (plan: ActionPlan): SceneHandle[] => [...new Set(planTexts(plan).flatMap(namedHandles))]

/**
 * The handles a viewed plan's text names that are the scene's to show: all but those the view shows as improvised, which the plan describes
 * itself. One improvised and hidden by the view stays, so the scene's render throws on it: a prompt that named it would say nothing of what it is.
 */
export const planSceneHandles = (viewed: ActionPlan): SceneHandle[] => {
    const improvised = new Set((viewed.improvised ?? []).map(({ handle }) => handle))
    return planHandles(viewed).filter((handle) => !improvised.has(handle))
}

/** The handles listed more than once, each once. */
export const listedTwice = (handles: readonly SceneHandle[]): SceneHandle[] => [...new Set(handles.filter((handle, index) => handles.indexOf(handle) !== index))]

/**
 * The things to describe. Under the explicit render the line is `The things to describe:`, since the render's own per-thing section is
 * headed `The things:` (mine).
 */
export const thingsLine = (things: readonly SceneHandle[], { scene = 'judge' }: Pick<ImaginationOptions, 'scene'> = {}): string =>
    `${scene === 'explicit' ? 'The things to describe' : 'The things'}: ${things.map((handle) => `[${handle}]`).join(', ')}`

/** A case's first candidate's actions, as the oracle probe has them. */
export const caseActions = (id: string): readonly string[] => oracleCases[id].candidates[0].steps.map(({ says }) => says)
export const caseSource = (id: string): string => `oracleCases ${id}, candidate ${oracleCases[id].candidates[0].id}`
