//
// The explicit render's goldens (AGENT.trialQuestion.planning.md, step 0): the tea table and the cup on the floor with the securing removed,
// as step 0's batches show them; the tea table with its glue, and the chained table, with the securing shown, which no step 0 batch shows.
//
import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../positions/ludicCache/sceneModel'
import { renderSceneExplicit, ruleTagHandles } from './renderSceneExplicit'
import { judgeRules, withoutSecuring } from './sceneRules'
import { subScene } from './subScene'

const TEA_TABLE_OMITTED = [
    "Scene: The Parlour",
    "",
    "Fiction:",
    "In the Parlour there is [table1] Table (a small round tea table).",
    "On [table1] there are [saucer1] Saucer and [teapot1] Teapot.",
    "On [saucer1] there is [cup1] Cup.",
    "In [cup1] there is [tea1] Tea.",
    "In [teapot1] there is [tea2] Tea.",
    "You are holding nothing.",
    "",
    "The things:",
    "- [table1] Table (a small round tea table) is in the Parlour. On it are [saucer1] and [teapot1]. When [table1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [table1] is as an ordinary small round tea table is.",
    "- [saucer1] Saucer is on [table1]. On it is [cup1]. When [saucer1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [saucer1] is as an ordinary saucer is.",
    "- [cup1] Cup is on [saucer1]. In it is [tea1]. When [cup1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [cup1] is as an ordinary cup is.",
    "- [tea1] Tea is in [cup1]. In everything the scene doesn't say, [tea1] is as an ordinary tea is.",
    "- [teapot1] Teapot is on [table1]. In it is [tea2]. When [teapot1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [teapot1] is as an ordinary teapot is.",
    "- [tea2] Tea is in [teapot1]. In everything the scene doesn't say, [tea2] is as an ordinary tea is.",
    "",
    "End of scene.",
].join('\n')

const CUP_ON_FLOOR_OMITTED = [
    "Scene: The Parlour",
    "",
    "Fiction:",
    "In the Parlour there are [cup1] Cup and [table1] Table (a small round tea table).",
    "In [cup1] there is [tea1] Tea.",
    "On [table1] there are [saucer1] Saucer and [teapot1] Teapot.",
    "In [teapot1] there is [tea2] Tea.",
    "You are holding nothing.",
    "",
    "The things:",
    "- [cup1] Cup is in the Parlour. In it is [tea1]. When [cup1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [cup1] is as an ordinary cup is.",
    "- [tea1] Tea is in [cup1]. In everything the scene doesn't say, [tea1] is as an ordinary tea is.",
    "- [table1] Table (a small round tea table) is in the Parlour. On it are [saucer1] and [teapot1]. When [table1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [table1] is as an ordinary small round tea table is.",
    "- [saucer1] Saucer is on [table1]. In everything the scene doesn't say, [saucer1] is as an ordinary saucer is.",
    "- [teapot1] Teapot is on [table1]. In it is [tea2]. When [teapot1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [teapot1] is as an ordinary teapot is.",
    "- [tea2] Tea is in [teapot1]. In everything the scene doesn't say, [tea2] is as an ordinary tea is.",
    "",
    "End of scene.",
].join('\n')

const TEA_TABLE_SHOWN = [
    "Scene: The Parlour",
    "",
    "Fiction:",
    "In the Parlour there is [table1] Table (a small round tea table).",
    "On [table1] there are [saucer1] Saucer and [teapot1] Teapot.",
    "On [saucer1] there is [cup1] Cup.",
    "In [cup1] there is [tea1] Tea.",
    "[teapot1] is glued to [table1].",
    "In [teapot1] there is [tea2] Tea.",
    "You are holding nothing.",
    "",
    "The things:",
    "- [table1] Table (a small round tea table) is in the Parlour. On it are [saucer1] and [teapot1]. When [table1] moves, [saucer1] moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [table1] is as an ordinary small round tea table is.",
    "- [saucer1] Saucer is on [table1]. On it is [cup1]. When [saucer1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [saucer1] is as an ordinary saucer is.",
    "- [cup1] Cup is on [saucer1]. In it is [tea1]. When [cup1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [cup1] is as an ordinary cup is.",
    "- [tea1] Tea is in [cup1]. In everything the scene doesn't say, [tea1] is as an ordinary tea is.",
    "- [teapot1] Teapot is on [table1]. [teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped. In it is [tea2]. When [teapot1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [teapot1] is as an ordinary teapot is.",
    "- [tea2] Tea is in [teapot1]. In everything the scene doesn't say, [tea2] is as an ordinary tea is.",
    "",
    "End of scene.",
].join('\n')

const CHAINED_SHOWN = [
    "Scene: The Parlour",
    "",
    "Fiction:",
    "[wall1] Wall is part of the Parlour.",
    "In the Parlour there is [table1] Table (a small round tea table).",
    "[table1] is chained to [wall1].",
    "On [table1] there are [saucer1] Saucer and [teapot1] Teapot.",
    "On [saucer1] there is [cup1] Cup.",
    "In [cup1] there is [tea1] Tea.",
    "[teapot1] is glued to [table1].",
    "In [teapot1] there is [tea2] Tea.",
    "You are holding nothing.",
    "",
    "The things:",
    "- [wall1] Wall is part of the Parlour. In everything the scene doesn't say, [wall1] is as an ordinary wall is.",
    "- [table1] Table (a small round tea table) is in the Parlour. [table1] is chained to [wall1]. [table1] and [wall1] cannot be moved apart until they are freed. They can still be moved together. On it are [saucer1] and [teapot1]. When [table1] moves, [saucer1] moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [table1] is as an ordinary small round tea table is.",
    "- [saucer1] Saucer is on [table1]. On it is [cup1]. When [saucer1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [saucer1] is as an ordinary saucer is.",
    "- [cup1] Cup is on [saucer1]. In it is [tea1]. When [cup1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [cup1] is as an ordinary cup is.",
    "- [tea1] Tea is in [cup1]. In everything the scene doesn't say, [tea1] is as an ordinary tea is.",
    "- [teapot1] Teapot is on [table1]. [teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped. In it is [tea2]. When [teapot1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [teapot1] is as an ordinary teapot is.",
    "- [tea2] Tea is in [teapot1]. In everything the scene doesn't say, [tea2] is as an ordinary tea is.",
    "",
    "End of scene.",
].join('\n')

const fixture = async (name: string): Promise<SceneModel> => {
    const found = sceneFixture(name)
    return (await buildSceneFixture(found)).scene({ exits: found.exits }).scene
}

describe('the explicit scene render', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each([
        ['teaTable', 'removed', TEA_TABLE_OMITTED],
        ['teaTableCupOnFloor', 'removed', CUP_ON_FLOOR_OMITTED],
        ['teaTable', 'shown', TEA_TABLE_SHOWN],
        ['teaTableChained', 'shown', CHAINED_SHOWN],
    ] as const)('renders %s with the securing %s', async (name, securing, golden) => {
        const scene = await fixture(name)
        expect(renderSceneExplicit(securing === 'removed' ? withoutSecuring(scene) : scene)).toBe(golden)
    })

    describe("with rules: 'handles'", () => {
        it('tags each securing\'s fact with its rule\'s handle, and changes nothing else', async () => {
            const scene = await fixture('teaTableChained')
            const tagged = renderSceneExplicit(scene, { rules: 'handles' })
            expect(tagged).toBe(CHAINED_SHOWN
                .replace('[table1] is chained to [wall1]. [table1] and', '[table1] is chained to [wall1] (rule [table-secured-to-wall]). [table1] and')
                .replace('[teapot1] is glued to [table1], so', '[teapot1] is glued to [table1] (rule [teapot-secured-to-table]), so'))
            expect(ruleTagHandles(tagged)).toEqual(['table-secured-to-wall', 'teapot-secured-to-table'])
            expect(ruleTagHandles(renderSceneExplicit(scene))).toEqual([])
        })

        it('mints each handle on the full scene, so a sub-scene shows the full scene\'s handle', async () => {
            const scene = await fixture('teaTable')
            const glued = (handle: string) => ({ kind: 'Custom' as const, label: 'glued to', target: { kind: 'thing' as const, handle }, secured: true })
            const full: SceneModel = {
                ...scene,
                things: { ...scene.things, tea1: { ...scene.things.tea1, relations: [glued('table1')] }, tea2: { ...scene.things.tea2, relations: [glued('table1')] } },
            }
            const sub = subScene(full, ['tea1', 'table1'])
            expect(judgeRules(sub).map(({ handle }) => handle)).toContain('tea-secured-to-table')
            expect(ruleTagHandles(renderSceneExplicit(sub, { rules: 'handles', full }))).toContain('tea1-secured-to-table1')
        })

        it('has no form yet for a securing to something other than a thing', async () => {
            const scene = await fixture('teaTable')
            const boat = { ...scene, things: { ...scene.things, table1: { ...scene.things.table1, relations: [{ kind: 'SecuredTo' as const, target: { kind: 'notShown' as const } }] } } }
            expect(() => renderSceneExplicit(boat, { rules: 'handles' })).toThrow('no rule handle yet')
            expect(() => renderSceneExplicit(boat)).not.toThrow()
        })
    })

    describe("with rules: 'conditions'", () => {
        it('tags each securing and states its condition, with the relation as its measure; a pair takes a carry line with slack in place of the action rule', async () => {
            const scene = await fixture('teaTableChained')
            expect(renderSceneExplicit(scene, { rules: 'conditions' })).toBe(CHAINED_SHOWN
                .replace(
                    '[table1] is chained to [wall1]. [table1] and [wall1] cannot be moved apart until they are freed. They can still be moved together.',
                    '[table1] is chained to [wall1] (rule [table-secured-to-wall]). If an action moves [table1] farther from [wall1] than being chained to it allows, that is a violation of the rule. Short of that, [table1] can be moved as usual, and when [wall1] moves, [table1] goes with it.',
                )
                .replace(
                    '[teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped.',
                    '[teapot1] is glued to [table1] (rule [teapot-secured-to-table]), so it goes wherever [table1] goes, even when [table1] is tipped. If an action moves [teapot1] farther from [table1] than being glued to it allows, that is a violation of the rule.',
                ))
        })
    })

    describe('refuses the shapes step 0 does not probe', () => {
        it('Concepts', async () => {
            const scene = await fixture('teaTable')
            expect(() => renderSceneExplicit({ ...scene, concepts: ['table1'] })).toThrow('doesn\'t render Concepts')
        })

        it('a spread thing', async () => {
            const scene = await fixture('teaTable')
            const [table] = scene.contents
            expect(() => renderSceneExplicit({ ...scene, contents: [{ ...table, elsewhere: [{ kind: 'held' }] }] })).toThrow('doesn\'t render a spread thing yet ([table1])')
        })

        it('a join', async () => {
            const scene = await fixture('teaTable')
            const [table] = scene.contents
            const join = { ...table, kind: 'join' as const, host: 'table1', across: [{ kind: 'room' as const }] }
            expect(() => renderSceneExplicit({ ...scene, contents: [join] })).toThrow('doesn\'t render a join yet ([table1])')
        })
    })
})
