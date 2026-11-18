import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { orderItems, type ActionPlan } from '../oracleLoop/actionPlan'
import { checkActionsBlock } from './imaginationScene'
import {
    PLAY_BY_PLAY_OPTIONS, checkPlayByPlay, namedHandles, planFromPlayByPlay, playByPlay, playByPlayCells, playByPlayContract, playByPlayPlansText, playByPlayThings,
    renderPlayByPlay, type PlayByPlayInputs, type PlayByPlayOptions,
} from './playByPlay'

const fixtureScene = async (name: string): Promise<SceneModel> => {
    const fixture = sceneFixture(name)
    return (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
}

const cellOf = (inputs: Partial<PlayByPlayInputs>): ReadPieceCell<PlayByPlayInputs> => ({
    inputs: { fixture: 'teaTable', actions: ['pick up [saucer1]', 'pour [tea2] from [teapot1] into [cup1]'], alsoShown: ['table1'], ...inputs },
    lookFor: 'anything',
    source: 'hand-written',
})

const fenced = (value: unknown): string => `The teapot rises.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
const line = { teapot1: 'rises off [table1]', cup1: 'stays where it is' }

describe('playByPlay', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('gives the sub-scene, then each action in order, then the things the actions name last, each once', async () => {
            const text = await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)
            expect(text.startsWith('Scene: ')).toBe(true)
            const parts = text.split('\n\n')
            expect(parts.slice(-4)).toEqual([
                'End of scene.',
                'Action 1: pick up [saucer1]',
                'Action 2: pour [tea2] from [teapot1] into [cup1]',
                'The things: [saucer1], [tea2], [teapot1], [cup1]',
            ])
        })

        it('shows the things the actions name in the scene, as well as the things also shown', async () => {
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

        it('runs a chain\'s consequence from the wall, which no action names, when the wall is also shown', async () => {
            const text = await renderPlayByPlay(cellOf({ fixture: 'teaTableChained', actions: ['pick up [table1]'], alsoShown: ['wall1'] }), { rules: 'consequence' })
            expect(text).toContain('[table1] is chained to [wall1]. When [wall1] changes its position or orientation, [table1] moves with it.')
        })

        it.each([
            [{ actions: [] }, /No actions/],
            [{ actions: ['look around'] }, /The actions name no things to describe/],
            [{ alsoShown: ['table1', 'wall1', 'table1'] }, /Things shown twice: table1/],
            [{ actions: ['pick up [kettle1]'] }, /The actions name kettle1, not in teaTable's scene/],
            [{ alsoShown: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
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
            expect(playByPlay.parseOptions(value)).toBe("options must be { rules?: 'none' | 'consequence', scene?: 'judge' | 'explicit' }")
        })

        it('takes the explicit render, which ends with the things to describe (AGENT.actionPlan.planning.md, step 4a)', async () => {
            const options = playByPlay.parseOptions({ scene: 'explicit' })
            expect(options).toEqual({ rules: 'none', scene: 'explicit' })
            const text = await renderPlayByPlay(playByPlayCells['OC-1'], options as PlayByPlayOptions)
            expect(text).not.toContain('Graph')
            expect(text.split('\n\n').slice(-1)[0]).toMatch(/^The things to describe: \[/)
        })
    })

    describe('the check', () => {
        const cell = cellOf({})

        it('passes reasoning then a fenced json block with a line for things the actions name, in each action', () => {
            expect(checkPlayByPlay(fenced({ actions: [line, line] }), cell)).toEqual([])
        })

        it('reads a handle in brackets as the handle, and merges the two spellings where both appear', () => {
            expect(checkPlayByPlay(fenced({ actions: [{ '[teapot1]': 'rises', '[cup1]': 'stays' }, { teapot1: 'tilts', '[teapot1]': 'to pour', cup1: 'stays' }] }), cell)).toEqual([])
        })

        it('passes a named thing with no line, or an action with no lines, since a silent thing stays in its frame', () => {
            expect(checkPlayByPlay(fenced({ actions: [{ teapot1: 'tilts' }, {}] }), cell)).toEqual([])
        })

        it.each([
            ['no block', 'The teapot rises.', ['no JSON block']],
            ['a block that does not parse', 'Prose.\n\n```json\n{ "actions": [ }\n```', ['the JSON block does not parse']],
            ['no actions array', fenced({ motions: [line, line] }), ['the JSON block has no "actions" array']],
            ['the wrong count', fenced({ actions: [line] }), ['expected 2 actions, got 1']],
            ['an entry that is not an object', fenced({ actions: [line, 'rises'] }), ['action 2 is not an object']],
            ['a thing the actions don\'t name, though shown', fenced({ actions: [line, { ...line, table1: 'stays' }] }), ['action 2: table1 is not a listed thing']],
            ['a bracketed thing not named', fenced({ actions: [line, { ...line, '[table1]': 'stays' }] }), ['action 2: table1 is not a listed thing']],
            ['both spellings, one empty and one not a string', fenced({ actions: [line, { teapot1: 'tilts', '[teapot1]': 4, cup1: '', '[cup1]': ' ' }] }), [
                "action 2: teapot1's line is not a string", "action 2: cup1's line is empty",
            ]],
            ['an empty line', fenced({ actions: [line, { ...line, cup1: '  ' }] }), ["action 2: cup1's line is empty"]],
            ['a line that is not a string', fenced({ actions: [{ ...line, teapot1: 3 }, line] }), ["action 1: teapot1's line is not a string"]],
        ])('reports %s', (_, reply, problems) => {
            expect(checkPlayByPlay(reply, cell)).toEqual(problems)
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(playByPlayCells))('%s renders, and every thing it shows or its actions name is in its fixture\'s scene', async (id) => {
            const cell = playByPlayCells[id]
            await expect(renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS)).resolves.toEqual(expect.any(String))
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.alsoShown, ...cell.inputs.actions.flatMap(namedHandles)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it.each([
            ['OC-1', ['table1']],
            ['OC-6', ['tea2', 'teapot1', 'cup1']],
            ['OC-19', ['teapot1', 'table1', 'hammer1']],
            ['OC-20', ['table1']],
        ])('%s describes the things its actions name: %j', (id, things) => {
            expect(playByPlayThings(playByPlayCells[id].inputs)).toEqual(things)
        })

        it('OC-20 shows the wall and the chain, though its action names only the table', async () => {
            const text = await renderPlayByPlay(playByPlayCells['OC-20'], PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('End of scene.'))
            expect(scene).toContain('[wall1]')
            expect(scene).toContain('chained to')
        })
    })

    it('is registered, and runs through the probe: four cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages[0].content?.[0]?.text ?? ''
            const things = namedHandles(prompt.slice(prompt.lastIndexOf('The things: ')))
            const actions = prompt.split('\n\n').filter((part) => part.startsWith('Action ')).length
            return { success: true as const, body: fenced({ actions: Array(actions).fill(Object.fromEntries(things.map((handle) => [handle, 'stays']))) }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'playByPlay', instructions: 'Say what each thing does.', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(12)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 12, formFails: 0, errors: 0 })
        expect(result.options).toEqual(PLAY_BY_PLAY_OPTIONS)
        expect(result.read.map(({ cell, replies }: { cell: string; replies: unknown[] }) => [cell, replies.length])).toEqual(
            Object.keys(playByPlayCells).map((id) => [id, 3]),
        )
    })

    describe('the plan it builds (AGENT.actionPlan.planning.md, step 3)', () => {
        const inputs = cellOf({}).inputs
        const parse = (reply: string, input: PlayByPlayInputs = inputs) => playByPlayContract.parse(reply, { input, rendered: '' })
        const planOfReply = (reply: string, input: PlayByPlayInputs = inputs): ActionPlan => {
            const parsed = parse(reply, input)
            if (!('value' in parsed)) {
                throw new Error(parsed.problems.join('; '))
            }
            return parsed.value
        }

        it('makes each action a step, and each described thing\'s line a consequence with its thing, in the things\' order', () => {
            const plan = planOfReply(fenced({ actions: [{ saucer1: 'rises off [table1]' }, { cup1: 'fills with [tea2]', teapot1: 'tilts over [cup1]' }], problems: [] }))
            expect(plan).toEqual({ steps: [
                { says: 'pick up [saucer1]', suppliedBy: 'system', path: 'pick-up-saucer1', items: [
                    { kind: 'consequence', path: 'pick-up-saucer1.rises-table1', thing: 'saucer1', says: 'rises off [table1]' },
                ] },
                { says: 'pour [tea2] from [teapot1] into [cup1]', suppliedBy: 'system', path: 'pour-tea2-teapot1', items: [
                    { kind: 'consequence', path: 'pour-tea2-teapot1.tilts-over-cup1', thing: 'teapot1', says: 'tilts over [cup1]' },
                    { kind: 'consequence', path: 'pour-tea2-teapot1.fills-tea2', thing: 'cup1', says: 'fills with [tea2]' },
                ] },
            ] })
        })

        it('joins a thing\'s two spellings into one line, as the check reads them', () => {
            const plan = planOfReply(fenced({ actions: [{}, { teapot1: 'tilts', '[teapot1]': 'to pour' }] }))
            expect(plan.steps[1].items).toEqual([{ kind: 'consequence', path: 'pour-tea2-teapot1.tilts-pour', thing: 'teapot1', says: 'tilts to pour' }])
        })

        it('puts a problem on the step it names as Action N, else on the last step, after the consequences', () => {
            const plan = planOfReply(fenced({ actions: [line, line], problems: ['In Action 1, [saucer1] may be stuck', 'The [teapot1] is glued to [table1]', 'Action 9 is not one'] }))
            expect(plan.steps.map(({ items }) => items.map(({ kind, says }) => [kind, says]))).toEqual([
                [['consequence', 'rises off [table1]'], ['consequence', 'stays where it is'], ['concern', 'In Action 1, [saucer1] may be stuck']],
                [['consequence', 'rises off [table1]'], ['consequence', 'stays where it is'], ['concern', 'The [teapot1] is glued to [table1]'], ['concern', 'Action 9 is not one']],
            ])
            expect(plan.steps.every(({ items }) => orderItems(items).every((item, index) => item === items[index]))).toBe(true)
        })

        it('tells repeated texts in one step apart with -2', () => {
            const plan = planOfReply(fenced({ actions: [{}, { teapot1: 'stays', cup1: 'stays' }] }))
            expect(plan.steps[1].items.map(({ path }) => path)).toEqual(['pour-tea2-teapot1.stays', 'pour-tea2-teapot1.stays-2'])
        })

        it('has the block\'s form problems unchanged, for every reply the check tests with no problems list', () => {
            const replies = [
                fenced({ actions: [line, line] }), 'The teapot rises.', 'Prose.\n\n```json\n{ "actions": [ }\n```', fenced({ motions: [line, line] }),
                fenced({ actions: [line] }), fenced({ actions: [line, 'rises'] }), fenced({ actions: [line, { ...line, table1: 'stays' }] }),
                fenced({ actions: [{ ...line, teapot1: 3 }, line] }), fenced({ actions: [line, { ...line, cup1: '  ' }] }),
            ]
            for (const reply of replies) {
                expect([reply, checkPlayByPlay(reply, cellOf({}))]).toEqual([reply, checkActionsBlock(reply, 2, playByPlayThings(inputs))])
            }
        })

        it.each([
            ['a problems list that is not a list', { problems: 'none' }, ['"problems" is not a list']],
            ['a problem that is not a string, or is blank', { problems: ['ok', 3, ' '] }, ['problem 2 is not a non-empty string', 'problem 3 is not a non-empty string']],
        ])('refuses %s', (_, extra, problems) => {
            expect(parse(fenced({ actions: [line, line], ...extra }))).toEqual({ problems })
        })

        it('lists the block\'s problems and the problems list\'s together', () => {
            expect(parse(fenced({ actions: [line], problems: [4] }))).toEqual({ problems: ['expected 2 actions, got 1', 'problem 1 is not a non-empty string'] })
        })

        it('gives the builder\'s plan as its value', () => {
            const block = { actions: [line, { teapot1: 'tilts' }], problems: ['[cup1] may tip'] }
            expect(parse(fenced(block))).toEqual({ value: planFromPlayByPlay(inputs, block) })
        })

        it.each(Object.keys(playByPlayCells))('%s: a reply with a line for each thing builds a well-formed plan', (id) => {
            const { inputs: cellInputs } = playByPlayCells[id]
            const entry = Object.fromEntries(playByPlayThings(cellInputs).map((handle) => [`[${handle}]`, `[${handle}] moves as the action needs`]))
            const plan = planOfReply(fenced({ actions: cellInputs.actions.map(() => entry), problems: ['something might get in the way'] }), cellInputs)
            const paths = plan.steps.flatMap(({ path, items }) => [path, ...items.map((item) => item.path)])
            expect(new Set(paths).size).toBe(paths.length)
            expect(plan.steps.map(({ items }) => items.length)).toEqual(cellInputs.actions.map((_, index) => playByPlayThings(cellInputs).length + (index === cellInputs.actions.length - 1 ? 1 : 0)))
            expect(plan.steps.every(({ path, items }) => items.every((item) => item.path.startsWith(`${path}.`)))).toBe(true)
        })

        it('prints a batch\'s plans for reading, or why a reply gave none', () => {
            const groups = [{ cell: 'OC-20', lookFor: '', replies: [
                { repeat: 1, reply: fenced({ actions: [{ table1: 'rises off the floor' }], problems: ['[table1] is chained to [wall1]'] }), problems: [] },
                { repeat: 2, reply: 'The table rises.', problems: ['no JSON block'] },
                { repeat: 3, error: 'throttled' },
            ] }, { cell: 'OC-99', lookFor: '', replies: [{ repeat: 1, reply: 'x' }] }]
            expect(playByPlayPlansText(groups)).toBe([
                '## OC-20, repeat 1\nStep pick-up-table1: pick up [table1]\n  - consequence pick-up-table1.rises-floor: rises off the floor\n  - concern pick-up-table1.table1-chained-wall1: [table1] is chained to [wall1]',
                '## OC-20, repeat 2\nform: no JSON block',
                '## OC-20, repeat 3\nerror: throttled',
                '## OC-99, repeat 1\nnot a playByPlay cell',
            ].join('\n\n'))
        })
    })
})
