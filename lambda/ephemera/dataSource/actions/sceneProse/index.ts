/**
 * The scene renderers (sceneProjection Slice 2): the scene model as text for an LLM reader. D, an indented tree whose lines
 * each name their parent, was chosen in Slice 3 (SP-7) and is the default. `flatD` (D unindented) and `fans` (a block per
 * host) were retired 2026-11-03 (user) after the SP-10 comparison under `twoRegisters`. `registers`, `affordance` and
 * `examples` (SP-10, Slice 5) are the multi-register renders of `renderSceneRegisters.ts`: one function, two switches.
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneRegisters } from './renderSceneRegisters'
import { renderSceneD } from './renderSceneTree'

export type SceneFormat = 'D' | 'registers' | 'affordance' | 'examples'

export const sceneFormats: readonly SceneFormat[] = ['D', 'registers', 'affordance', 'examples']

/** The formats a probe runs when none are named: D, the provisional render. The SP-10 renders must be named. */
export const defaultSceneFormats: readonly SceneFormat[] = ['D']

export const isSceneFormat = (value: unknown): value is SceneFormat => sceneFormats.includes(value as SceneFormat)

export const renderScene = (scene: SceneModel, format: SceneFormat = 'D'): string => {
    switch (format) {
        case 'D': return renderSceneD(scene)
        case 'registers': return renderSceneRegisters(scene, { foreground: false, examples: false })
        case 'affordance': return renderSceneRegisters(scene, { foreground: true, examples: false })
        case 'examples': return renderSceneRegisters(scene, { foreground: false, examples: true })
    }
}
