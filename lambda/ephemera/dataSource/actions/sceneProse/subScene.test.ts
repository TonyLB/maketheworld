import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderScene, subScene } from '.'
import { renderSceneJudge } from './renderSceneJudge'

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

const subD = async (name: string, handles: string[]): Promise<string> => renderScene(subScene(await fixtureScene(name), handles))

describe('subScene', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('keeps a rule pair and the relation between them, and drops the rest', async () => {
        expect(await subD('teaTable', ['teapot1', 'table1'])).toBe([
            'The Parlour',
            'Contents of the Parlour:',
            '- [table1] Table (a small round tea table), in the Parlour',
            '  - [teapot1] Teapot, on [table1], glued to [table1], secured',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('drops a relation whose other end is not kept: a cell on the glued-to rule loses the chain to the wall', async () => {
        const scene = subScene(await fixtureScene('teaTableChained'), ['teapot1', 'table1'])
        expect(Object.keys(scene.things).sort()).toEqual(['table1', 'teapot1'])
        expect(renderScene(scene)).toBe([
            'The Parlour',
            'Contents of the Parlour:',
            '- [table1] Table (a small round tea table), in the Parlour',
            '  - [teapot1] Teapot, on [table1], glued to [table1], secured',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('keeps the other rule of the same scene for a cell on the chained-to rule, and drops the teapot', async () => {
        expect(await subD('teaTableChained', ['table1', 'wall1'])).toBe([
            'The Parlour',
            'Contents of the Parlour:',
            '- [wall1] Wall, part of the Parlour',
            '- [table1] Table (a small round tea table), in the Parlour, chained to [wall1], secured',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('keeps a container\'s own containers up to the room, and none of their other contents', async () => {
        expect(await subD('branchInBranch', ['teapot1'])).toBe([
            'The Tavern: A low-beamed common room, smoky from the hearth.',
            'Contents of the Tavern:',
            '- [table1] Table (a long oak trestle, ring-stained), in the Tavern',
            '  - [tray1] Tray (a dented copper tray), on [table1]',
            '    - [teapot1] Teapot (brown glaze, still warm), on [tray1]',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('keeps every binding of a spread thing, with its other bindings noted', async () => {
        expect(await subD('heldInventory', ['rope1'])).toBe([
            'The Kitchen',
            'Contents of the Kitchen:',
            '- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen',
            '  - [rope1] Rope (a coil of thick hemp rope), on [table1] (also held by you)',
            'You are holding:',
            '- [rope1] Rope, held by you (also on [table1])',
        ].join('\n'))
    })

    it('keeps a join with its host\'s every binding and their parents', async () => {
        expect(await subD('join', ['fruit-bowl1'])).toBe([
            'The Dining Room',
            'Contents of the Dining Room:',
            '- [table-a1] Table A, in the Dining Room',
            '  - [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1]) (see [fruit-bowl1] below)',
            '- [table-b1] Table B, in the Dining Room',
            '  - [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1]) (see [fruit-bowl1] below)',
            '  - [fruit-bowl1] Fruit Bowl, on [tablecloth1] (across [table-a1] and [table-b1])',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('drops a parent line\'s reference to a join that is not kept', async () => {
        const scene = subScene(await fixtureScene('join'), ['tablecloth1'])
        expect(scene.things['fruit-bowl1']).toBeUndefined()
        expect(renderScene(scene)).toBe([
            'The Dining Room',
            'Contents of the Dining Room:',
            '- [table-a1] Table A, in the Dining Room',
            '  - [tablecloth1] Tablecloth, on [table-a1] (also on [table-b1])',
            '- [table-b1] Table B, in the Dining Room',
            '  - [tablecloth1] Tablecloth, on [table-b1] (also on [table-a1])',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('keeps a held thing\'s container in what is held', async () => {
        expect(await subD('heldInventory', ['coin1'])).toBe([
            'The Kitchen',
            'Contents of the Kitchen: nothing.',
            'You are holding:',
            '- [bag1] Bag (a drawstring leather pouch), held by you',
            '  - [coin1] Coin, in [bag1]',
        ].join('\n'))
    })

    it('keeps the room\'s name and gloss, and drops the exits', async () => {
        const scene = subScene(await fixtureScene('tavern'), ['hammer1'])
        expect(scene.exits).toEqual([])
        expect(renderScene(scene)).toBe([
            'The Tavern: A low-beamed common room, smoky from the hearth.',
            'Contents of the Tavern: nothing.',
            'You are holding:',
            '- [hammer1] Hammer (a claw hammer with a taped handle), held by you',
        ].join('\n'))
    })

    it('keeps the Concepts a named thing is associated with', async () => {
        expect(await subD('lab', ['spring1'])).toBe([
            'The Lab',
            'Contents of the Lab:',
            '- [box1] Box (a plywood crate, lid off), in the Lab',
            '  - [spring1] Spring (a tight steel coil), in [box1], associated with [contraption1]',
            'Concepts here:',
            '- [contraption1] Contraption (a half-built mousetrap mechanism)',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('drops relations to things not kept and to open legs', async () => {
        const scene = subScene(await fixtureScene('openLegs'), ['table1'])
        expect(scene.things.table1.relations).toEqual([])
        expect(renderScene(scene)).toBe([
            'The Kitchen',
            'Contents of the Kitchen:',
            '- [table1] Table (scrubbed pine, knife-scarred), in the Kitchen',
            'You are holding: nothing.',
        ].join('\n'))
    })

    it('throws on a handle not in the scene', async () => {
        const scene = await fixtureScene('teaTable')
        expect(() => subScene(scene, ['teapot1', 'kettle1'])).toThrow(/kettle1.*expected one of: .*teapot1/)
    })

    it('renders the judge\'s scene of a sub-scene, its Rules section limited to the securing inside the set', async () => {
        expect(renderSceneJudge(subScene(await fixtureScene('teaTableChained'), ['teapot1', 'table1']))).toBe([
            'Scene: The Parlour',
            '',
            'Fiction:',
            'In the Parlour there is [table1] Table (a small round tea table).',
            'On [table1] there is [teapot1] Teapot.',
            '[teapot1] is glued to [table1].',
            'You are holding nothing.',
            '',
            'Graph:',
            '```',
            'Contents of the Parlour:',
            '- [table1] Table (a small round tea table), in the Parlour',
            '  - [teapot1] Teapot, on [table1]; [teapot1] glued to [table1]',
            'You are holding: nothing.',
            '```',
            '',
            'Rules:',
            '- teapot-secured-to-table: [teapot1] stays fixed relative to [table1]\'s frame. When [table1]\'s frame moves, [teapot1] travels along with [table1].',
            '',
            'End of scene.',
        ].join('\n'))
    })
})
