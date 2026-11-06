import { buildSceneFixture, sceneFixture } from '../../positions/ludicCache/sceneFixtures'
import { composeJudgePrompt, JUDGE_INSTRUCTIONS } from './frame'
import { renderScene } from '.'

/** The scene part of the agreed judge prompt, for `teaTable`. Written out once from the render and read through by hand. */
const judgeTeaTableGolden = [
    'Scene: The Parlour',
    '',
    'Fiction:',
    'In the Parlour there is [table1] Table (a small round tea table).',
    'On [table1] there are [saucer1] Saucer and [teapot1] Teapot.',
    'On [saucer1] there is [cup1] Cup.',
    'In [cup1] there is [tea1] Tea.',
    '[teapot1] is glued to [table1].',
    'In [teapot1] there is [tea2] Tea.',
    'You are holding nothing.',
    '',
    'Graph:',
    '```',
    'Contents of the Parlour:',
    '- [table1] Table (a small round tea table), in the Parlour',
    '  - [saucer1] Saucer, on [table1]',
    '    - [cup1] Cup, on [saucer1]',
    '      - [tea1] Tea, in [cup1]',
    '  - [teapot1] Teapot, on [table1]; [teapot1] glued to [table1]',
    '    - [tea2] Tea, in [teapot1]',
    'You are holding: nothing.',
    '```',
    '',
    'Rules:',
    "- teapot-secured-to-table: [teapot1] stays fixed relative to [table1]'s frame. When [table1]'s frame moves, [teapot1] travels along with [table1].",
    '',
    'End of scene.',
].join('\n')

describe('judge prompt', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('renders teaTable as the agreed scene text', async () => {
        const fixture = sceneFixture('teaTable')
        const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
        expect(renderScene(scene, 'judge')).toBe(judgeTeaTableGolden)
    })

    it('composes the instructions, the scene and the request, in that order', () => {
        const prompt = composeJudgePrompt({ sceneText: judgeTeaTableGolden, request: 'I want to pick up [table1].' })
        expect(prompt).toBe([JUDGE_INSTRUCTIONS, judgeTeaTableGolden, 'Request: I want to pick up [table1].'].join('\n\n'))
        expect(prompt.endsWith('\n\nRequest: I want to pick up [table1].')).toBe(true)
    })

    it('holds nothing variable in the instructions, and puts them before the scene', () => {
        const a = composeJudgePrompt({ sceneText: 'SCENE A', request: 'one' })
        const b = composeJudgePrompt({ sceneText: 'SCENE B', request: 'two' })
        expect(a.startsWith(`${JUDGE_INSTRUCTIONS}\n\n`)).toBe(true)
        expect(b.startsWith(`${JUDGE_INSTRUCTIONS}\n\n`)).toBe(true)
        expect(JUDGE_INSTRUCTIONS).not.toContain('[table1]')
    })

    it('leaves the Rules section out of a scene with no securing', async () => {
        const fixture = sceneFixture('tavern')
        const { scene } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
        const text = renderScene(scene, 'judge')
        expect(text).not.toContain('Rules:')
        expect(text).toContain('Graph:\n```\n')
        expect(text).not.toContain('secured')
    })
})
