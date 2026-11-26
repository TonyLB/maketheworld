import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneExplicit, ruleTagHandles } from './renderSceneExplicit'
import { withoutSecuring } from './sceneRules'
import { subScene } from './subScene'
import { filterViewedModel, viewedSceneModel } from './viewedSceneModel'

const fixture = async (name: string): Promise<SceneModel> => {
    const found = sceneFixture(name)
    return (await buildSceneFixture(found)).scene({ exits: found.exits }).scene
}

/** The tea table with both teas glued to the table: two rules whose ends share their stems, so each takes its long handle. */
const twoGlued = async (): Promise<SceneModel> => {
    const scene = await fixture('teaTable')
    const glued = (handle: string) => ({ kind: 'Custom' as const, label: 'glued to', target: { kind: 'thing' as const, handle }, secured: true })
    return { ...scene, things: { ...scene.things, tea1: { ...scene.things.tea1, relations: [glued('table1')] }, tea2: { ...scene.things.tea2, relations: [glued('table1')] } } }
}

describe('a viewed scene model', () => {
    it('mints its rule handles on the full model', async () => {
        expect([...viewedSceneModel(await fixture('teaTableChained')).rules.values()].sort()).toEqual(['table-secured-to-wall', 'teapot-secured-to-table'])
    })

    it('keeps the full model\'s handles through a sub-scene, where minting again would give another', async () => {
        const viewed = filterViewedModel(viewedSceneModel(await twoGlued()), (model) => subScene(model, ['tea1', 'table1']))
        expect([...viewed.rules.values()]).toEqual(['tea1-secured-to-table1'])
        expect(ruleTagHandles(renderSceneExplicit(viewed.model, { rules: 'handles', ruleHandles: viewed.rules }))).toEqual(['tea1-secured-to-table1'])
    })

    it('keeps the handle of each securing the filtered model still has, and no other', async () => {
        const viewed = viewedSceneModel(await fixture('teaTableChained'))
        expect(filterViewedModel(viewed, withoutSecuring).rules.size).toBe(0)
        expect([...filterViewedModel(viewed, (model) => subScene(model, ['teapot1'])).rules.values()]).toEqual(['teapot-secured-to-table'])
        expect(filterViewedModel(viewed, withoutSecuring).model).toEqual(withoutSecuring(viewed.model))
    })
})
