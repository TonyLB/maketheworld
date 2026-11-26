import { withoutSecuring } from '../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene, knowledgeOf, shownScene, viewScene, withViewedScene } from './viewedRender'

describe('what a piece may know of the scene, before its render', () => {
    const view = { shows: 'whole', securing: 'shown' } as const

    it.each<[string, unknown, ReturnType<typeof knowledgeOf>]>([
        ['the view\'s, with no options', undefined, view],
        ['an option on each axis, by its name', { show: 'none', securing: 'omitted' }, { shows: 'none', securing: 'omitted' }],
        ['the view\'s, past an option on another axis or an unknown value', { scene: 'explicit', show: 'everything', securing: 3 }, view],
    ])('reads %s', (_, options, knowledge) => {
        expect(knowledgeOf(view, options)).toEqual(knowledge)
    })

    it('gives the whole scene, without its securing where that is omitted, a sub-scene of the given handles, or none', async () => {
        const full = await fixtureScene('teaTableChained')
        expect(viewScene(full, view)?.model).toBe(full)
        expect(viewScene(full, { shows: 'whole', securing: 'omitted' })?.model).toEqual(withoutSecuring(full))
        expect(Object.keys(viewScene(full, { shows: 'subScene', securing: 'shown' }, ['teapot1'])?.model.things ?? {}).sort()).toEqual(['table1', 'teapot1'])
        expect(viewScene(full, { shows: 'none', securing: 'shown' })).toBeUndefined()
        expect(() => viewScene(full, { shows: 'subScene', securing: 'shown' })).toThrow('A sub-scene needs the handles it keeps')
    })

    it('runs the prep on the full scene, then hands the render the viewed scene and what the prep gave', async () => {
        const render = withViewedScene(
            { shows: 'subScene', securing: 'omitted' },
            (_cell: { inputs: { fixture: string } }, _options: undefined, viewed, given: string) => `${given}: ${Object.keys(shownScene(viewed).model.things).sort().join(', ')}; ${shownScene(viewed).rules.size} rules`,
            (_cell, _options, full) => ({ handles: ['teapot1'], given: `${Object.keys(full.things).length} things` }),
        )
        expect(await render({ inputs: { fixture: 'teaTableChained' } }, undefined)).toBe('7 things: table1, teapot1; 0 rules')
    })

    it('refuses a render that shows a scene and was given none', () => {
        expect(() => shownScene(undefined)).toThrow('was given none')
    })
})
