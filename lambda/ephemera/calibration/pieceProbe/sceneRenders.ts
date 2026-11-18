//
// Which render a piece's scene takes, shared by the oracle's pieces and the imagination's (AGENT.actionPlan.planning.md, step 4a): a leaf
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
    'ruleCell', 'nonRuleCell', 'playByPlay', 'consequences', 'stepConsiderations', 'trial/against', 'trial/rebuttal', 'trial/verdict',
]
