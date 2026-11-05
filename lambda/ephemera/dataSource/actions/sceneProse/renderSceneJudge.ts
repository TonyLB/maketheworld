/**
 * The scene as the judge prompt shows it (judgePrompt plan, Slice 3; v24): a `Scene:` line, then `Fiction` (the place in sentences),
 * `Graph` (D's list in a code fence, relations naming their subject) and `Rules`, each set off by a blank line. The `secured` mark is
 * taken off both registers, since the Rules section carries it (`sceneRules.ts`). A scene with no securing has no `Rules` section.
 * It reuses the `registers` pieces and changes none of them, so the control renders stay as they were.
 */
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { placeLines } from './renderSceneRegisters'
import { sceneListLines } from './renderSceneTree'
import { judgeRulesLines, withoutSecuredMark } from './sceneRules'
import { heading } from './sceneWording'

export const renderSceneJudge = (scene: SceneModel): string => {
    const plain = withoutSecuredMark(scene)
    const rules = judgeRulesLines(scene)
    return [
        `Scene: ${heading(scene)}`,
        ['Fiction:', ...placeLines(plain).slice(1)].join('\n'),
        ['Graph:', '```', ...sceneListLines(plain, '  ', 'subjected'), '```'].join('\n'),
        ...(rules.length === 0 ? [] : [rules.join('\n')]),
    ].join('\n\n')
}
