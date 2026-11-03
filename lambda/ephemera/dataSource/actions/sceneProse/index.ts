/**
 * The scene renderers (sceneProjection Slice 2): the scene model as text for an LLM reader. D, an indented tree whose lines
 * each name their parent, was chosen in Slice 3 (SP-7); SP-7 was reopened (user, 2026-11-03) against `fans`, which keeps
 * D's lines but gathers each host's direct members into one block, the one grouped variant never built before. Until it is
 * decided again the two coexist, D the default; the loser is deleted. `flatD` (2026-11-03) is D with no indentation, to
 * test whether the indent's YAML-like register costs the reader anything. `registers`, `affordance` and `examples` (SP-10,
 * Slice 5) are the multi-register renders of `renderSceneRegisters.ts`: one function, two switches.
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneFans } from './renderSceneFans'
import { renderSceneRegisters } from './renderSceneRegisters'
import { renderSceneD, renderSceneFlatD } from './renderSceneTree'

export type SceneFormat = 'D' | 'flatD' | 'fans' | 'registers' | 'affordance' | 'examples'

export const sceneFormats: readonly SceneFormat[] = ['D', 'flatD', 'fans', 'registers', 'affordance', 'examples']

/** The formats a probe runs when none are named: the SP-7 set. The SP-10 renders must be named, so the default stays inside the call cap. */
export const defaultSceneFormats: readonly SceneFormat[] = ['D', 'flatD', 'fans']

export const isSceneFormat = (value: unknown): value is SceneFormat => sceneFormats.includes(value as SceneFormat)

export const renderScene = (scene: SceneModel, format: SceneFormat = 'D'): string => {
    switch (format) {
        case 'D': return renderSceneD(scene)
        case 'flatD': return renderSceneFlatD(scene)
        case 'fans': return renderSceneFans(scene)
        case 'registers': return renderSceneRegisters(scene, { foreground: false, examples: false })
        case 'affordance': return renderSceneRegisters(scene, { foreground: true, examples: false })
        case 'examples': return renderSceneRegisters(scene, { foreground: false, examples: true })
    }
}
