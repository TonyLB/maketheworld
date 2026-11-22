//
// Which render a piece's scene takes, shared by the oracle's pieces and the imagination's (calibration AGENT.md, "Scene renders"): a leaf
// module, since `nonRuleCell.ts` imports from `imaginationScene.ts`.
//
/** The judge render, Fiction and Graph (the default), or the explicit render (AGENT.trialQuestion.planning.md, step 0). */
export const SCENE_RENDERS = ['judge', 'explicit'] as const
export type SceneRender = typeof SCENE_RENDERS[number]

export const isSceneRender = (value: unknown): value is SceneRender => (SCENE_RENDERS as readonly unknown[]).includes(value)

/**
 * The pieces whose default render is still the judge render, by registry name (`family/stage` for a family's stage). The direction is
 * the explicit render as every piece's default (the user, 2026-11-18). A piece moves at its next redraft, as a draft of its own with a
 * parity batch, and its default flips once its kept draft runs explicit; then it leaves this list. The list only shrinks:
 * `sceneRenders.test.ts` fails on a judge-render piece missing from it, and on a listed piece that no longer renders the judge's scene.
 */
export const JUDGE_RENDER_HOLDOUTS: readonly string[] = [
    'ruleCell', 'nonRuleCell', 'stepConsiderations', 'trial/against', 'trial/rebuttal', 'trial/verdict',
]

/** How much of the scene a piece shows: all of it, the sub-scene of the things the piece's render names, or none. */
export const SCENE_SHOWS = ['whole', 'subScene', 'none'] as const
export type SceneShows = typeof SCENE_SHOWS[number]

/**
 * How a piece's scene states each securing: `shown`, in the render's own wording; `omitted` (`withoutSecuring`), since the rule cell
 * judges it; or `conditions`, each securing tagged with its rule's handle and stated as its condition and carry, which tags the explicit
 * render's securings, so under the judge render it is the judge's own wording.
 */
export const SECURINGS = ['shown', 'omitted', 'conditions'] as const
export type Securing = typeof SECURINGS[number]

/** A rule's parts, as `judgeRules` gives them, that a piece's own Rule section can show. */
export const RULE_PARTS = ['fact', 'enforcing', 'voiding', 'consequence'] as const
export type RulePart = typeof RULE_PARTS[number]

/**
 * A piece's view of the scene (calibration AGENT.md, "Piece views"): its declared setting on each axis. An option is an experiment arm
 * that overrides one axis, its default the view's value; which render the scene takes (`scene`, `SCENE_RENDERS`) is an arm, not the view,
 * while the explicit render becomes every piece's default (`JUDGE_RENDER_HOLDOUTS`).
 */
export type SceneView = {
    shows: SceneShows
    securing: Securing
    /** Whether the scene's own Rules section, in the built judge's `v45` wording, is shown. */
    sceneRules: boolean
    /** The parts of a rule the piece's own Rule section shows, for a piece that has one (the rule cell). */
    ruleParts?: readonly RulePart[]
}
