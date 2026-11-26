//
// What the imagination's pieces render in common (AGENT.imagination.planning.md, step 1.5): the fixture's sub-scene, as the piece's view
// states its securing, the `scene` option, and the handles a plan names. Both pieces are reducers on the action plan, replying in its change language.
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { filterViewedModel, viewedSceneModel } from '../../dataSource/actions/sceneProse/viewedSceneModel'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { itemTexts, type ActionPlan } from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { isSceneRender, SCENE_RENDERS, type SceneRender, type SceneView } from '../pieceProbe/sceneRenders'

/**
 * The imagination's options: which render the sub-scene takes, an experiment arm (calibration AGENT.md, "Scene renders"), the judge
 * render's Fiction and Graph when absent. How the securing is stated is the piece's view (`SceneView`'s `securing`;
 * calibration AGENT.md, "Piece views"), not an option. The `rules` option it replaces (retired 2026-11-22, the user) also took
 * `consequence` (each rule's fact and what it does, after the judge's Graph) and `handles` (batches 35 to 40), which no live arm used.
 */
export type ImaginationOptions = { scene?: SceneRender }

/** `{ scene?: 'judge' | 'explicit' }`, over a piece's default: with no options, or no `scene`, the default's. */
export const imaginationOptionsParser = (defaults: ImaginationOptions) => (value: unknown): ImaginationOptions | string => {
    if (value === undefined) {
        return defaults
    }
    const shape = `options must be { scene?: ${SCENE_RENDERS.map((render) => `'${render}'`).join(' | ')} }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { scene = defaults.scene, ...rest } = value as Record<string, unknown>
    if (Object.keys(rest).length > 0 || (scene !== undefined && !isSceneRender(scene))) {
        return shape
    }
    return scene === undefined ? {} : { scene }
}

export const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

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
 * The scene's parts, the sub-scene of the shown things heading to `End of scene.`: the judge render's Fiction and Graph, or with
 * `scene: 'explicit'` the explicit render (`renderSceneExplicit`), its securings stated as the view has them: in the render's own wording
 * (`shown`), or tagged with their rule handles, minted on the full model (`viewedSceneModel`), and stated as their conditions and carries (`conditions`), which the judge
 * render doesn't take. With `omitted`, the securing is left out of either (`withoutSecuring`). A shown handle not in the fixture's scene
 * throws (`subScene`).
 */
export const renderScene = async (
    { fixture, shown }: { fixture: string; shown: readonly SceneHandle[] },
    { securing }: Pick<SceneView, 'securing'>,
    { scene = 'judge' }: ImaginationOptions,
): Promise<string[]> => {
    const viewed = viewedSceneModel(await fixtureScene(fixture))
    const known = securing === 'omitted' ? filterViewedModel(viewed, withoutSecuring) : viewed
    const { model: sub, rules } = filterViewedModel(known, (model) => subScene(model, [...new Set(shown)]))
    if (scene === 'explicit') {
        return [renderSceneExplicit(sub, securing === 'conditions' ? { rules: 'conditions', ruleHandles: rules } : {})]
    }
    const sections = judgeSceneSections(sub)
    return [`Scene: ${heading(sub)}`, sections.fiction, sections.graph, 'End of scene.']
}

/**
 * The things to describe. Under the explicit render the line is `The things to describe:`, since the render's own per-thing section is
 * headed `The things:` (mine).
 */
export const thingsLine = (things: readonly SceneHandle[], { scene = 'judge' }: Pick<ImaginationOptions, 'scene'> = {}): string =>
    `${scene === 'explicit' ? 'The things to describe' : 'The things'}: ${things.map((handle) => `[${handle}]`).join(', ')}`

/** A case's first candidate's actions, as the oracle probe has them. */
export const caseActions = (id: string): readonly string[] => oracleCases[id].candidates[0].steps.map(({ says }) => says)
export const caseSource = (id: string): string => `oracleCases ${id}, candidate ${oracleCases[id].candidates[0].id}`
