import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { PLAY_BY_PLAY_OPTIONS, checkPlayByPlay, namedHandles, playByPlay, playByPlayCells, renderPlayByPlay, type PlayByPlayInputs } from './playByPlay'

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

const cellOf = (inputs: Partial<PlayByPlayInputs>): ReadPieceCell<PlayByPlayInputs> => ({
    inputs: { fixture: 'teaTable', actions: ['pick up [saucer1]', 'pour [tea2] from [teapot1] into [cup1]'], things: ['teapot1', 'table1'], ...inputs },
    lookFor: 'anything',
    source: 'hand-written',
})

const fenced = (value: unknown): string => `The teapot rises.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
const line = { teapot1: 'rises off [table1]', table1: 'stays where it is' }

describe('playByPlay', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('gives the sub-scene, then each action in order, then the things last', async () => {
            const text = await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)
            expect(text.startsWith('Scene: ')).toBe(true)
            const parts = text.split('\n\n')
            expect(parts.slice(-4)).toEqual([
                'End of scene.',
                'Action 1: pick up [saucer1]',
                'Action 2: pour [tea2] from [teapot1] into [cup1]',
                'The things: [teapot1], [table1]',
            ])
        })

        it('shows the things the actions name in the scene, as well as the listed things', async () => {
            const text = await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('End of scene.'))
            expect(['saucer1', 'tea2', 'cup1', 'teapot1', 'table1'].filter((handle) => !scene.includes(`[${handle}]`))).toEqual([])
        })

        it('shows the sub-scene\'s rules as fact and consequence with rules: consequence, and no rules by default', async () => {
            expect(await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)).not.toContain('Rules:')
            const text = await renderPlayByPlay(cellOf({}), { rules: 'consequence' })
            expect(text).toContain('\n\nRules:\n- teapot-secured-to-table: [teapot1] is glued to [table1]. When [table1] changes its position or orientation, [teapot1] moves with it.\n\nEnd of scene.')
            expect(text).not.toContain('blocks')
        })

        it('runs a chain\'s consequence from the wall, which no action moves', async () => {
            const text = await renderPlayByPlay(cellOf({ fixture: 'teaTableChained', actions: ['pick up [table1]'], things: ['table1', 'wall1'] }), { rules: 'consequence' })
            expect(text).toContain('[table1] is chained to [wall1]. When [wall1] changes its position or orientation, [table1] moves with it.')
        })

        it.each([
            [{ actions: [] }, /No actions/],
            [{ things: [] }, /No things to describe/],
            [{ things: ['teapot1', 'table1', 'teapot1'] }, /Things listed twice: teapot1/],
            [{ actions: ['pick up [kettle1]'] }, /The actions name kettle1, not in teaTable's scene/],
            [{ things: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
        ])('throws on %j', async (inputs, error) => {
            await expect(renderPlayByPlay(cellOf(inputs), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to no rules', () => {
            expect(playByPlay.parseOptions(undefined)).toEqual({ rules: 'none' })
            expect(playByPlay.parseOptions({ rules: 'consequence' })).toEqual({ rules: 'consequence' })
        })

        it.each([['loud'], [{ rules: 'v45' }], [{ sceneRules: true }], [{ show: 'none' }]])('refuses %j', (value) => {
            expect(playByPlay.parseOptions(value)).toBe("options must be { rules?: 'none' | 'consequence' }")
        })
    })

    describe('the check', () => {
        const cell = cellOf({})

        it('passes reasoning then a fenced json block with a line for each listed thing in each action', () => {
            expect(checkPlayByPlay(fenced({ actions: [line, line] }), cell)).toEqual([])
        })

        it('reads a handle in brackets as the handle, and merges the two spellings where both appear', () => {
            expect(checkPlayByPlay(fenced({ actions: [{ '[teapot1]': 'rises', '[table1]': 'stays' }, { teapot1: 'tilts', '[teapot1]': 'to pour', table1: 'stays' }] }), cell)).toEqual([])
        })

        it('passes a listed thing with no line, or an action with no lines, since a silent thing stays in its frame', () => {
            expect(checkPlayByPlay(fenced({ actions: [{ teapot1: 'tilts' }, {}] }), cell)).toEqual([])
        })

        it.each([
            ['no block', 'The teapot rises.', ['no JSON block']],
            ['a block that does not parse', 'Prose.\n\n```json\n{ "actions": [ }\n```', ['the JSON block does not parse']],
            ['no actions array', fenced({ motions: [line, line] }), ['the JSON block has no "actions" array']],
            ['the wrong count', fenced({ actions: [line] }), ['expected 2 actions, got 1']],
            ['an entry that is not an object', fenced({ actions: [line, 'rises'] }), ['action 2 is not an object']],
            ['a thing not listed', fenced({ actions: [line, { ...line, cup1: 'fills' }] }), ['action 2: cup1 is not a listed thing']],
            ['a bracketed thing not listed', fenced({ actions: [line, { ...line, '[cup1]': 'fills' }] }), ['action 2: cup1 is not a listed thing']],
            ['both spellings, one empty and one not a string', fenced({ actions: [line, { teapot1: 'tilts', '[teapot1]': 4, table1: '', '[table1]': ' ' }] }), [
                "action 2: teapot1's line is not a string", "action 2: table1's line is empty",
            ]],
            ['an empty line', fenced({ actions: [line, { ...line, table1: '  ' }] }), ["action 2: table1's line is empty"]],
            ['a line that is not a string', fenced({ actions: [{ ...line, teapot1: 3 }, line] }), ["action 1: teapot1's line is not a string"]],
        ])('reports %s', (_, reply, problems) => {
            expect(checkPlayByPlay(reply, cell)).toEqual(problems)
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(playByPlayCells))('%s renders, and every thing it lists or its actions name is in its fixture\'s scene', async (id) => {
            const cell = playByPlayCells[id]
            await expect(renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS)).resolves.toEqual(expect.any(String))
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.things, ...cell.inputs.actions.flatMap(namedHandles)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })
    })

    it('is registered, and runs through the probe: five cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages[0].content?.[0]?.text ?? ''
            const things = namedHandles(prompt.slice(prompt.lastIndexOf('The things: ')))
            const actions = prompt.split('\n\n').filter((part) => part.startsWith('Action ')).length
            return { success: true as const, body: fenced({ actions: Array(actions).fill(Object.fromEntries(things.map((handle) => [handle, 'stays']))) }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'playByPlay', instructions: 'Say what each thing does.', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(15)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 15, formFails: 0, errors: 0 })
        expect(result.options).toEqual(PLAY_BY_PLAY_OPTIONS)
        expect(result.read.map(({ cell, replies }: { cell: string; replies: unknown[] }) => [cell, replies.length])).toEqual(
            Object.keys(playByPlayCells).map((id) => [id, 3]),
        )
    })
})
