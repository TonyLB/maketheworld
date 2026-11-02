/**
 * The candidate scene renderers (sceneProjection Slice 2): the scene model as text for an LLM reader, in three formats that
 * differ only in how they show nesting. Pre-SP-7 the three coexist; the format probe compares them and the losers are
 * deleted.
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneBlocks } from './renderSceneBlocks'
import { renderSceneA, renderSceneD } from './renderSceneTree'

export type SceneFormat = 'A' | 'D' | 'blocks'

export const sceneFormats: readonly SceneFormat[] = ['A', 'D', 'blocks']

export const renderScene = (format: SceneFormat, scene: SceneModel): string => {
    switch (format) {
        case 'A': return renderSceneA(scene)
        case 'D': return renderSceneD(scene)
        case 'blocks': return renderSceneBlocks(scene)
    }
}
