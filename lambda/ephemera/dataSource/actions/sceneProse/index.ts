/**
 * The scene renderers (sceneProjection Slice 2): the scene model as text for an LLM reader. D, an indented tree whose lines
 * each name their parent, was chosen in Slice 3 (SP-7) and is the default. `flatD` (D unindented) and `fans` (a block per
 * host) were retired 2026-11-03 (user) after the SP-10 comparison under `twoRegisters`. `registers`, `affordance` and
 * `examples` (SP-10, Slice 5) are the multi-register renders of `renderSceneRegisters.ts`: one function, two switches. `rulesD` and
 * `rules` are D and `registers` with the `secured` mark moved to a Rules section (`sceneRules.ts`, 2026-11-04) and each row's relations naming their subject, compared because neither base is settled for it.
 * `rulesAction` is a temporary branch of `rules`: the rule as what each move does. `judge` is the judge prompt's scene (`renderSceneJudge.ts`).
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneRegisters } from './renderSceneRegisters'
import { renderSceneD } from './renderSceneTree'
import { renderSceneJudge } from './renderSceneJudge'
import { rulesLines, withoutSecuredMark } from './sceneRules'

export type SceneFormat = 'D' | 'registers' | 'affordance' | 'examples' | 'rulesD' | 'rules' | 'rulesAction' | 'judge'

export const sceneFormats: readonly SceneFormat[] = ['D', 'registers', 'affordance', 'examples', 'rulesD', 'rules', 'rulesAction', 'judge']

/** The formats a probe runs when none are named: D, the provisional render. The SP-10 renders must be named. */
export const defaultSceneFormats: readonly SceneFormat[] = ['D']

export const isSceneFormat = (value: unknown): value is SceneFormat => sceneFormats.includes(value as SceneFormat)

const withRules = (base: string, scene: SceneModel, style: 'relative' | 'action' = 'relative'): string => [base, ...rulesLines(scene, style)].join('\n')

/** `registers` as the rules renders use it: no `secured` mark, and each row's relations name their subject. */
const rulesBase = (scene: SceneModel): string => renderSceneRegisters(withoutSecuredMark(scene), { foreground: false, examples: false, relationStyle: 'subjected' })

export const renderScene = (scene: SceneModel, format: SceneFormat = 'D'): string => {
    switch (format) {
        case 'D': return renderSceneD(scene)
        case 'registers': return renderSceneRegisters(scene, { foreground: false, examples: false })
        case 'affordance': return renderSceneRegisters(scene, { foreground: true, examples: false })
        case 'examples': return renderSceneRegisters(scene, { foreground: false, examples: true })
        case 'rulesD': return withRules(renderSceneD(withoutSecuredMark(scene), 'subjected'), scene)
        case 'rules': return withRules(rulesBase(scene), scene)
        case 'rulesAction': return withRules(rulesBase(scene), scene, 'action')
        case 'judge': return renderSceneJudge(scene)
    }
}
