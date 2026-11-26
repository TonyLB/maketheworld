//
// What a piece may know of the scene, and the renderers that word it, shared by the oracle's pieces and the imagination's (calibration
// AGENT.md, "Piece views" and "Scene renders"). What it may know is a filter on the scene model, applied before its render
// (`viewedRender.ts`); how the scene is worded is a renderer of the viewed scene model, one of the piece's named arms. A leaf module, since
// `nonRuleCell.ts` imports from `imaginationScene.ts`.
//
import { renderSceneExplicit } from '../../dataSource/actions/sceneProse/renderSceneExplicit'
import { judgeSceneSections } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { heading } from '../../dataSource/actions/sceneProse/sceneWording'
import type { ViewedSceneModel } from '../../dataSource/actions/sceneProse/viewedSceneModel'

/** How much of the scene a piece may know: all of it, the sub-scene of the things the piece's inputs name, or none. */
export const SCENE_SHOWS = ['whole', 'subScene', 'none'] as const
export type SceneShows = typeof SCENE_SHOWS[number]

/** Whether a piece may know the scene's securing: `known`, or `omitted` (`withoutSecuring`), since the rule cell judges it. */
export const SECURINGS = ['known', 'omitted'] as const
export type Securing = typeof SECURINGS[number]

/**
 * A piece's view of the scene (calibration AGENT.md, "Piece views"): what it may know of it, each axis a filter of the scene model. An
 * option on the same axis (`show`, `securing`) is a knowledge arm that overrides it.
 */
export type SceneView = {
    shows: SceneShows
    securing: Securing
}

/** A scene's wording: the scene block, its heading to `End of scene.`, from the viewed scene model alone. */
export type SceneRenderer = (viewed: ViewedSceneModel) => string

/** The judge render's heading, Fiction and Graph, with no Rules section. */
export const judgeScene: SceneRenderer = ({ model }) => {
    const { fiction, graph } = judgeSceneSections(model)
    return [`Scene: ${heading(model)}`, fiction, graph, 'End of scene.'].join('\n\n')
}

/** The judge render with the scene's own Rules section, in the built judge's `v45` wording, where the scene has a securing. */
export const judgeSceneWithRules: SceneRenderer = ({ model }) => {
    const { fiction, graph, rules } = judgeSceneSections(model)
    return [`Scene: ${heading(model)}`, fiction, graph, ...(rules === undefined ? [] : [rules]), 'End of scene.'].join('\n\n')
}

/** The explicit render (`renderSceneExplicit`), each securing in its own wording. */
export const explicitScene: SceneRenderer = ({ model }) => renderSceneExplicit(model)

/**
 * The explicit render with each securing tagged with its rule's handle, minted on the full model (`viewedSceneModel`), and stated as its
 * condition and carry.
 */
export const taggedExplicitScene: SceneRenderer = ({ model, rules }) => renderSceneExplicit(model, { rules: 'conditions', ruleHandles: rules })

/**
 * A piece's wording of the scene: its named arms, each a renderer, chosen by the payload's `scene` option, and the arm taken when the
 * option is absent. A piece with no default has every payload name one.
 */
export type SceneWording<Arm extends string = string> = { default?: Arm; arms: Readonly<Record<Arm, SceneRenderer>> }

/** The arms a wording names, in order. */
export const armsOf = <Arm extends string>({ arms }: SceneWording<Arm>): Arm[] => Object.keys(arms) as Arm[]

/** Whether a value names one of a wording's arms. */
export const isArmOf = <Arm extends string>(wording: SceneWording<Arm>, value: unknown): value is Arm => (armsOf(wording) as unknown[]).includes(value)

/** The `scene` option's shape over a wording's arms, for a parse's refusal. */
export const sceneOptionShape = (wording: SceneWording): string => armsOf(wording).map((arm) => `'${arm}'`).join(' | ')

/** The renderer an option names, or the wording's default. Throws where neither names an arm. */
export const sceneRendererOf = <Arm extends string>(wording: SceneWording<Arm>, arm?: Arm): SceneRenderer => {
    const chosen = arm ?? wording.default
    if (chosen === undefined || !isArmOf(wording, chosen)) {
        throw new Error(`No scene render named ${chosen === undefined ? 'and no default' : `"${chosen}"`}`)
    }
    return wording.arms[chosen]
}

/** The two arms most pieces take: the judge render's Fiction and Graph, and the explicit render, each securing in its own wording. */
export const JUDGE_OR_EXPLICIT = { judge: judgeScene, explicit: explicitScene } as const
export type JudgeOrExplicit = keyof typeof JUDGE_OR_EXPLICIT
