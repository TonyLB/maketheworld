//
// What the imagination's pieces render in common (AGENT.imagination.planning.md, step 1.5): the fixture's sub-scene, the `rules` and
// `scene` options, and the handles a plan names. Both pieces are reducers on the action plan, replying in its change language.
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { judgeRules } from '../../dataSource/actions/sceneProse/sceneRules'
import { subScene } from '../../dataSource/actions/sceneProse/subScene'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandle, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { itemTexts, type ActionPlan } from '../oracleLoop/actionPlan'
import { oracleCases } from '../oracleLoop/oracleCases'
import { isSceneRender, SCENE_RENDERS, type SceneRender } from '../pieceProbe/sceneRenders'

export type ImaginationOptions = {
    /**
     * How the sub-scene's rules are shown: `none` (the default), or `consequence`, each rule's fact and what it does when the thing its
     * subject is secured to is moved (user, 2026-11-10). Whether a rule blocks is the rule cell's, so an ask is shown only what a rule
     * causes (PB-2, PR-1). Replaces a `sceneRules` boolean that showed v45's sentences. Or `handles`, the explicit render's securings each
     * tagged with its rule's handle, minted on the full scene (AGENT.itemStanding.planning.md, IS-3), so a reply can name a rule. Or
     * `conditions`, the handles with each securing's condition and carry (AGENT.itemStanding.planning.md, step 2, the user's diagnosis).
     */
    rules: 'none' | 'consequence' | 'handles' | 'conditions'
    /**
     * Which render the sub-scene takes: the judge render's Fiction and Graph when absent, or the explicit render
     * (calibration AGENT.md, "Scene renders"). The explicit render states each securing as a carry line itself, so it takes no `rules: 'consequence'` (mine).
     */
    scene?: SceneRender
}

export const IMAGINATION_OPTIONS: ImaginationOptions = { rules: 'none' }

export const parseImaginationOptions = (value: unknown): ImaginationOptions | string => {
    if (value === undefined) {
        return IMAGINATION_OPTIONS
    }
    const shape = `options must be { rules?: 'none' | 'consequence' | 'handles' | 'conditions', scene?: ${SCENE_RENDERS.map((render) => `'${render}'`).join(' | ')} }`
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return shape
    }
    const { rules = IMAGINATION_OPTIONS.rules, scene, ...rest } = value as Record<string, unknown>
    if (Object.keys(rest).length > 0 || (rules !== 'none' && rules !== 'consequence' && rules !== 'handles' && rules !== 'conditions') || (scene !== undefined && !isSceneRender(scene))) {
        return shape
    }
    if (scene === 'explicit' && rules === 'consequence') {
        return "scene: 'explicit' takes no rules: 'consequence'; the explicit render states the securing itself"
    }
    if (scene !== 'explicit' && (rules === 'handles' || rules === 'conditions')) {
        return `rules: '${rules}' tags the explicit render's securings; it needs scene: 'explicit'`
    }
    return scene === undefined ? { rules } : { rules, scene }
}

/** Whether a `rules` value fits a scene render: `handles` and `conditions` tag the explicit render, `consequence` adds to the judge render's. */
const rulesFit = (rules: ImaginationOptions['rules'], scene: SceneRender | undefined): boolean =>
    rules === 'none' || (rules === 'consequence' ? scene !== 'explicit' : scene === 'explicit')

/**
 * The imagination's options over a piece's defaults: with no options the defaults; the default scene filled in where the options name
 * none, before the check, so the default too refuses `rules: 'consequence'` under the explicit render; and the default rules where the
 * options name none and the default fits the scene, else `none` (so `{ scene: 'judge' }` stays a valid ask on a `handles` default).
 */
export const imaginationOptionsParser = (defaults: ImaginationOptions) => (value: unknown): ImaginationOptions | string => {
    if (value === undefined) {
        return parseImaginationOptions(defaults)
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return parseImaginationOptions(value)
    }
    const named = value as Record<string, unknown>
    const withScene = defaults.scene !== undefined && !('scene' in named) ? { ...named, scene: defaults.scene } : named
    const scene = withScene.scene as SceneRender | undefined
    return parseImaginationOptions('rules' in named ? withScene : { ...withScene, rules: rulesFit(defaults.rules, scene) ? defaults.rules : 'none' })
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

/** The sub-scene's rules as fact and consequence, or none when it has no securing. */
const consequenceRules = (scene: SceneModel): string[] => {
    const lines = judgeRules(scene).map(({ handle, parts }) => `- ${handle}: ${parts.fact} ${parts.consequence}`)
    return lines.length === 0 ? [] : [['Rules:', ...lines].join('\n')]
}

/**
 * The scene's parts, the sub-scene of the shown things heading to `End of scene.`: the judge render's Fiction and Graph (with the rules
 * under `rules: 'consequence'`), or with `scene: 'explicit'` the explicit render (`renderSceneExplicit`), its securings tagged with their
 * full-scene rule handles under `rules: 'handles'`, and with their conditions too under `rules: 'conditions'`. A shown handle not in
 * the fixture's scene throws (`subScene`).
 */
export const renderScene = async (
    { fixture, shown }: { fixture: string; shown: readonly SceneHandle[] },
    { rules, scene = 'judge' }: ImaginationOptions,
): Promise<string[]> => {
    const full = await fixtureScene(fixture)
    const sub = subScene(full, [...new Set(shown)])
    if (scene === 'explicit') {
        return [renderSceneExplicit(sub, { rules: rules === 'consequence' ? 'none' : rules, full })]
    }
    const sections = judgeSceneSections(sub)
    return [
        `Scene: ${heading(full)}`,
        sections.fiction,
        sections.graph,
        ...(rules === 'consequence' ? consequenceRules(sub) : []),
        'End of scene.',
    ]
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
