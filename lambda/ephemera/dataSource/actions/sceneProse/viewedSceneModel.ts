//
// A scene model as a reader may know it (AGENT.sceneModelFilters.planning.md): the model after the filters that decide what a reader may
// know (`withoutSecuring`, `subScene`), with the rule handles minted on the full model before any of them. A view declares what may be
// known; this is the model once that is applied, and every render reads it, never the full model.
//
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { ruleHandlesOf, securingEdge, securingWords, type RuleHandles } from './sceneRules'

/** The model a reader may know, and its rules' handles as the full model mints them, so a render of it names each rule as every other does. */
export type ViewedSceneModel = { model: SceneModel; rules: RuleHandles }

/** The full model, before any filter, with its rule handles minted on it. */
export const viewedSceneModel = (full: SceneModel): ViewedSceneModel => ({ model: full, rules: ruleHandlesOf(full) })

/** The securing edges a model still has, as `securingEdge` keys them. */
const securingEdges = (model: SceneModel): ReadonlySet<string> => new Set(Object.entries(model.things).flatMap(([subject, { relations }]) => (
    relations.flatMap((relation) => (securingWords(relation) !== undefined && relation.target.kind === 'thing' ? [securingEdge(subject, relation.target.handle)] : []))
)))

/**
 * The viewed model through a filter (`withoutSecuring`, `subScene`): the filtered model, and the rule handles of the securings it still
 * has, each as the full model minted it. A handle is never minted again.
 */
export const filterViewedModel = ({ model, rules }: ViewedSceneModel, filter: (model: SceneModel) => SceneModel): ViewedSceneModel => {
    const filtered = filter(model)
    const kept = securingEdges(filtered)
    return { model: filtered, rules: new Map([...rules].filter(([edge]) => kept.has(edge))) }
}
