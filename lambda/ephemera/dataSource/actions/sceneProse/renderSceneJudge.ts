/**
 * The scene as the judge prompt shows it: a `Scene:` line, then `Fiction` (the place in sentences),
 * `Graph` (D's list in a code fence, relations naming their subject), `Rules` and an `End of scene.` marker, each set off by a blank line. The `secured` mark is
 * taken off both registers, since the Rules section carries it (`sceneRules.ts`). A scene with no securing has no `Rules` section.
 * It reuses the `registers` pieces and changes none of them, so the control renders stay as they were.
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { placeLines } from './renderSceneRegisters'
import { sceneListLines } from './renderSceneTree'
import { judgeRulesLines, withoutSecuredMark } from './sceneRules'
import { heading } from './sceneWording'

/** The three views of the place, each with its own label; `rules` is absent for a scene with no securing. */
export const judgeSceneSections = (scene: SceneModel): { fiction: string; graph: string; rules?: string } => {
    const plain = withoutSecuredMark(scene)
    const rules = judgeRulesLines(scene)
    return {
        fiction: ['Fiction:', ...placeLines(plain).slice(1)].join('\n'),
        graph: ['Graph:', '```', ...sceneListLines(plain, '  ', 'subjected'), '```'].join('\n'),
        ...(rules.length === 0 ? {} : { rules: rules.join('\n') }),
    }
}

export const renderSceneJudge = (scene: SceneModel): string => {
    const { fiction, graph, rules } = judgeSceneSections(scene)
    return [
        `Scene: ${heading(scene)}`,
        fiction,
        graph,
        ...(rules === undefined ? [] : [rules]),
        'End of scene.',
    ].join('\n\n')
}
