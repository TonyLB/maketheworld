//
// What the imagination's pieces render in common (AGENT.imagination.planning.md, step 1.5): the fixture's sub-scene, as the piece's view
// states its securing, the `scene` option, and the handles a plan names. Both pieces are reducers on the action plan, replying in its change language.
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { itemTexts, type ActionPlan } from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { isSceneRender, SCENE_RENDERS, type SceneRender, type SceneView } from '../pieceProbe/sceneRenders'

/**
 * The imagination's options: which render the sub-scene takes, an experiment arm (calibration AGENT.md, "Scene renders"), the judge
 * render's Fiction and Graph when absent. How the securing is stated is the piece's view (`SceneView`'s `securing`;
 * AGENT.pieceViews.planning.md, step 3), not an option. The `rules` option it replaces (retired there, the user, 2026-11-22) also took
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

/** The handles a text names in brackets, in order. */
export const namedHandles = (text: string): SceneHandle[] => [...text.matchAll(/\[([^\]]+)\]/g)].map(([, handle]) => handle)

/** The handles a plan's text names, its sub-steps' included, each once, in order. */
export const planHandles = ({ steps }: ActionPlan): SceneHandle[] =>
    [...new Set(steps.flatMap(({ says, items }) => [says, ...items.flatMap(itemTexts)]).flatMap(namedHandles))]

/** The handles listed more than once, each once. */
export const listedTwice = (handles: readonly SceneHandle[]): SceneHandle[] => [...new Set(handles.filter((handle, index) => handles.indexOf(handle) !== index))]

/**
 * The scene's parts, the sub-scene of the shown things heading to `End of scene.`: the judge render's Fiction and Graph, or with
 * `scene: 'explicit'` the explicit render (`renderSceneExplicit`), its securings stated as the view has them: in the render's own wording
 * (`shown`), or tagged with their full-scene rule handles and stated as their conditions and carries (`conditions`), which the judge
 * render doesn't take. With `omitted`, the securing is left out of either (`withoutSecuring`). A shown handle not in the fixture's scene
 * throws (`subScene`).
 */
export const renderScene = async (
    { fixture, shown }: { fixture: string; shown: readonly SceneHandle[] },
    { securing }: Pick<SceneView, 'securing'>,
    { scene = 'judge' }: ImaginationOptions,
): Promise<string[]> => {
    const fixtureFull = await fixtureScene(fixture)
    const full = securing === 'omitted' ? withoutSecuring(fixtureFull) : fixtureFull
    const sub = subScene(full, [...new Set(shown)])
    if (scene === 'explicit') {
        return [renderSceneExplicit(sub, { rules: securing === 'conditions' ? 'conditions' : 'none', full })]
    }
    const sections = judgeSceneSections(sub)
    return [`Scene: ${heading(full)}`, sections.fiction, sections.graph, 'End of scene.']
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
