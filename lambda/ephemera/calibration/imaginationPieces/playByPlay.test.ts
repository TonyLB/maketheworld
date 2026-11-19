import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { mergeStepChanges, planOf, planSteps, type ActionPlan } from '../oracleLoop/actionPlan'
import { textHash } from '../textHash'
import { fixtureScene, planHandles } from './imaginationScene'
import {
    PLAY_BY_PLAY_MERGE, PLAY_BY_PLAY_OPTIONS, checkPlayByPlay, playByPlay, playByPlayCells, playByPlayContract, playByPlayPlans, playByPlayPlansText,
    renderPlayByPlay, type PlayByPlayInputs, type PlayByPlayOptions,
} from './playByPlay'

const POUR = 'pour [tea2] from [teapot1] into [cup1]'
const pourPlan = (): ActionPlan => planOf([{ step: { says: POUR, suppliedBy: 'system' }, items: [{ kind: 'intent', says: POUR }] }])

const cellOf = (inputs: Partial<PlayByPlayInputs>): ReadPieceCell<PlayByPlayInputs> => ({
    inputs: { fixture: 'teaTable', plan: pourPlan(), target: 'pour-tea2-teapot1', missing: 'how [teapot1] is held and moved', alsoShown: ['table1'], ...inputs },
    lookFor: 'anything',
    source: 'hand-written',
})

const fenced = (value: unknown): string => `- lift [teapot1]\n- tilt it\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
const lift = { says: 'lift [teapot1] off [table1]', intent: '[teapot1] is held above [cup1]' }
const tilt = { says: 'tilt [teapot1] over [cup1]', intent: '[tea2] pours into [cup1]' }
const expansion = { changes: [{ add: 'steps', steps: [lift, tilt] }] }
/** The reply's own form: only what the model provides. */
const steps = { steps: [lift, tilt] }

describe('playByPlay', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('gives the scene, then the plan, then the step to expand with the detail asked for, with no things line', async () => {
            const parts = (await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)).split('\n\n')
            expect(parts.slice(-2)).toEqual([
                'The plan:\nStep pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]\n  - intent pour-tea2-teapot1.intent: pour [tea2] from [teapot1] into [cup1]',
                'The step to expand: pour-tea2-teapot1\nThe detail asked for: how [teapot1] is held and moved',
            ])
            expect(parts.some((part) => part.startsWith('The things to describe'))).toBe(false)
        })

        it('shows the things the plan names in the scene, as well as the things also shown', async () => {
            const text = await renderPlayByPlay(cellOf({}), PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('The plan:'))
            expect(['tea2', 'cup1', 'teapot1', 'table1'].filter((handle) => !scene.includes(`[${handle}]`))).toEqual([])
        })

        it('takes a sub-step as the target, and shows the expanded plan nested', async () => {
            const merged = mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', expansion, [], PLAY_BY_PLAY_MERGE)
            if (!('plan' in merged)) {
                throw new Error(merged.problems.join('; '))
            }
            const text = await renderPlayByPlay(cellOf({ plan: merged.plan, target: 'tilt-teapot1-over' }), PLAY_BY_PLAY_OPTIONS)
            expect(text).toContain('  - step tilt-teapot1-over: tilt [teapot1] over [cup1]\n    - intent tilt-teapot1-over.intent: [tea2] pours into [cup1]')
            expect(text.endsWith('The step to expand: tilt-teapot1-over\nThe detail asked for: how [teapot1] is held and moved')).toBe(true)
        })

        it('shows the sub-scene\'s rules as fact and consequence under the judge render with rules: consequence', async () => {
            const text = await renderPlayByPlay(cellOf({}), { rules: 'consequence', scene: 'judge' })
            expect(text).toContain('\n\nRules:\n- teapot-secured-to-table: [teapot1] is glued to [table1]. When [table1] changes its position or orientation, [teapot1] moves with it.\n\nEnd of scene.')
            expect(text).not.toContain('blocks')
        })

        it('throws on a target already expanded or marked atomic: asking for one is the caller\'s error', async () => {
            const expanded = mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', expansion, [], PLAY_BY_PLAY_MERGE)
            const atomic = mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', { changes: [{ mark: 'atomic' }] }, [], PLAY_BY_PLAY_MERGE)
            if (!('plan' in expanded) || !('plan' in atomic)) {
                throw new Error('the merges should pass')
            }
            await expect(renderPlayByPlay(cellOf({ plan: expanded.plan }), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(/already expanded; expand one of its sub-steps/)
            await expect(renderPlayByPlay(cellOf({ plan: atomic.plan }), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(/is marked atomic; nothing to expand/)
        })

        it.each([
            [{ target: 'pick-up-cup1' }, /The target "pick-up-cup1" names no step of the plan/],
            [{ alsoShown: ['table1', 'wall1', 'table1'] }, /Things shown twice: table1/],
            [{ alsoShown: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
            [{ missing: ' ' }, /No detail asked for/],
            [{ missing: 'how [kettle1] is held' }, /Unknown scene handle\(s\) kettle1/],
        ])('throws on %j', async (inputs, error) => {
            await expect(renderPlayByPlay(cellOf(inputs), PLAY_BY_PLAY_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to the explicit render with no rules, which refuses rules: consequence unless the judge render is named', () => {
            expect(playByPlay.parseOptions(undefined)).toEqual({ rules: 'none', scene: 'explicit' })
            expect(playByPlay.parseOptions({})).toEqual({ rules: 'none', scene: 'explicit' })
            expect(playByPlay.parseOptions({ rules: 'consequence' })).toMatch(/takes no rules: 'consequence'/)
            expect(playByPlay.parseOptions({ rules: 'consequence', scene: 'judge' })).toEqual({ rules: 'consequence', scene: 'judge' })
        })

        it('pins the cells\' inputs hashes on the default (with `missing`; batches 32 and 33 ran ecfa6fcc, e3a5763d, 4e15e889, 99c1b023 without it)', async () => {
            const hashes = await Promise.all((['OC-1', 'OC-1b', 'OC-6', 'OC-19', 'OC-20'] as const).map(async (id) => textHash(await renderPlayByPlay(playByPlayCells[id], PLAY_BY_PLAY_OPTIONS))))
            expect(hashes).toEqual(['500b35a7', '58d72024', 'b8f4b846', '048eb091', 'df87eec6'])
        })

        it.each([['loud'], [{ rules: 'v45' }], [{ sceneRules: true }], [{ show: 'none' }]])('refuses %j', (value) => {
            expect(playByPlay.parseOptions(value)).toBe("options must be { rules?: 'none' | 'consequence', scene?: 'judge' | 'explicit' }")
        })

        it('renders the explicit scene by default, with no Fiction and Graph', async () => {
            const options = playByPlay.parseOptions({ scene: 'explicit' })
            expect(options).toEqual({ rules: 'none', scene: 'explicit' })
            expect(await renderPlayByPlay(playByPlayCells['OC-1'], options as PlayByPlayOptions)).not.toContain('Graph')
        })
    })

    describe('the contract', () => {
        const cell = cellOf({})
        const parse = (reply: string) => playByPlayContract.parse(reply, { input: cell.inputs, rendered: '' })
        const planOfReply = (reply: string): ActionPlan => {
            const parsed = parse(reply)
            if (!('value' in parsed)) {
                throw new Error(parsed.problems.join('; '))
            }
            return parsed.value
        }

        it('reads {"steps": [...]} as the expansion, code supplying the verb, the list and `to`', () => {
            const plan = planOfReply(fenced(steps))
            expect({ plan }).toEqual(mergeStepChanges(pourPlan(), 'pour-tea2-teapot1', expansion, [], PLAY_BY_PLAY_MERGE))
            expect(planSteps(plan).map(({ path }) => path)).toEqual(['pour-tea2-teapot1', 'lift-teapot1-table1', 'tilt-teapot1-over'])
            expect(checkPlayByPlay(fenced(steps), cell)).toEqual([])
        })

        it('reads a one-entry list as its entry, since the splitter takes the block from its first { to its last } (llm/)', () => {
            expect(planOfReply(fenced([steps]))).toEqual(planOfReply(fenced(steps)))
        })

        it('reads {"atomic": true} as the mark', () => {
            expect(planOfReply(fenced({ atomic: true })).steps[0].atomic).toBe(true)
        })

        it('brackets bare handles in each sub-step\'s says and intent, against the handles shown', () => {
            const plan = planOfReply(fenced({ steps: [{ says: 'lift teapot1', intent: 'teapot1 is above cup1' }, tilt] }))
            expect(planSteps(plan)[1]).toMatchObject({ says: 'lift [teapot1]', items: [{ says: '[teapot1] is above [cup1]' }] })
        })

        it('keeps a handle the scene doesn\'t hold as written: a breakdown may improvise an object', () => {
            const plan = planOfReply(fenced({ steps: [{ says: 'slide [cloth1] under [teapot1]' }, tilt] }))
            expect(planSteps(plan)[1].says).toBe('slide [cloth1] under [teapot1]')
        })

        it.each([
            ['no block', 'Lift it, then tilt it.', ['no JSON block']],
            ['a list of two (the reply is one object)', fenced([steps, { atomic: true }]), ['the JSON block does not parse']],
            ['the change language written out (batch 32)', fenced({ changes: [{ add: 'steps', steps: [lift, tilt] }] }), ['has "changes", not one of steps, atomic']],
            ['an empty object', fenced({}), ['has neither "steps" nor "atomic": expand the step, or mark it atomic']],
            ['both steps and atomic', fenced({ ...steps, atomic: true }), ['has both "steps" and "atomic": expand the step, or mark it atomic']],
            ['atomic false', fenced({ atomic: false }), ['"atomic" must be true']],
            ['a written `to`', fenced({ ...steps, to: 'pour-tea2-teapot1' }), ['has "to", not one of steps, atomic']],
            ['a consequence (no per-thing lines)', fenced({ ...steps, thing: 'teapot1' }), ['has "thing", not one of steps, atomic']],
            ['steps not a list', fenced({ steps: 'lift it, tilt it' }), ['has no "steps" list']],
            ['a single sub-step', fenced({ steps: [lift] }), ['has 1 sub-step; an expansion needs at least two']],
            ['a sub-step with another key', fenced({ steps: [lift, { ...tilt, thing: 'cup1' }] }), ['sub-step 2: has "thing", not one of says, intent']],
        ])('refuses %s', (_, reply, problems) => {
            expect(parse(reply)).toEqual({ problems })
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(playByPlayCells))('%s renders, and every thing it shows or its plan names is in its fixture\'s scene', async (id) => {
            const cell = playByPlayCells[id]
            await expect(renderPlayByPlay(cell, PLAY_BY_PLAY_OPTIONS)).resolves.toEqual(expect.any(String))
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.alsoShown, ...planHandles(cell.inputs.plan)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it.each([
            ['OC-1', 'pick up [table1]', 'pick-up-table1'],
            ['OC-6', 'pour [tea2] from [teapot1] into [cup1]', 'pour-tea2-teapot1'],
            ['OC-19', 'pry [teapot1] off [table1] with [hammer1]', 'pry-teapot1-table1'],
            ['OC-20', 'pick up [table1]', 'pick-up-table1'],
        ] as const)('%s is one step, %j, whose intent is its own text, and its target', (id, says, path) => {
            const { plan, target } = playByPlayCells[id].inputs
            expect(plan).toBe(playByPlayPlans[id])
            expect(plan.steps).toEqual([{ says, suppliedBy: 'system', path, items: [{ kind: 'intent', path: `${path}.intent`, says }] }])
            expect(target).toBe(path)
        })

        it('OC-1b is OC-1\'s plan expanded once, its target the grip sub-step, which states the detail asked for (the atomic cell)', () => {
            const { plan, target, missing } = playByPlayCells['OC-1b'].inputs
            expect(planSteps(plan).map(({ path, says }) => [path, says])).toEqual([
                ['pick-up-table1', 'pick up [table1]'], ['grip-table1-by', 'grip [table1] by its edges'], ['lift-table1-floor', 'lift [table1] off the floor'],
            ])
            expect([target, missing]).toEqual(['grip-table1-by', 'how [table1] is held'])
        })

        it('OC-1 and OC-20 ask for the same detail, so they differ by the scene alone', () => {
            expect(playByPlayCells['OC-20'].inputs.missing).toBe(playByPlayCells['OC-1'].inputs.missing)
        })

        it('OC-20 shows the wall and the chain, though its plan names only the table', async () => {
            const text = await renderPlayByPlay(playByPlayCells['OC-20'], PLAY_BY_PLAY_OPTIONS)
            const scene = text.slice(0, text.indexOf('The plan:'))
            expect(scene).toContain('[wall1]')
            expect(scene).toContain('chained to')
        })
    })

    it('is registered, and runs through the probe: five cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({
            success: true as const, body: fenced({ steps: [{ says: 'take hold' }, { says: 'move it' }] }),
        }))
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'playByPlay', instructions: 'Expand the step.', repeats: 3 }, { invoke, pieces })
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

    it('prints a batch\'s merged plans for reading, or why a reply gave none', () => {
        const groups = [{ cell: 'OC-20', lookFor: '', replies: [
            { repeat: 1, reply: fenced({ steps: [{ says: 'grip [table1] by its edges' }, { says: 'lift [table1]', intent: '[table1] is off the floor' }] }), problems: [] },
            { repeat: 2, reply: fenced({ atomic: true }), problems: [] },
            { repeat: 3, reply: 'The table rises.', problems: ['no JSON block'] },
            { repeat: 4, error: 'throttled' },
        ] }, { cell: 'OC-99', lookFor: '', replies: [{ repeat: 1, reply: 'x' }] }]
        expect(playByPlayPlansText(groups)).toBe([
            [
                '## OC-20, repeat 1',
                'Step pick-up-table1: pick up [table1]',
                '  - intent pick-up-table1.intent: pick up [table1]',
                '  - step grip-table1-by: grip [table1] by its edges',
                '  - step lift-table1: lift [table1]',
                '    - intent lift-table1.intent: [table1] is off the floor',
            ].join('\n'),
            '## OC-20, repeat 2\nStep pick-up-table1 (atomic): pick up [table1]\n  - intent pick-up-table1.intent: pick up [table1]',
            '## OC-20, repeat 3\nform: no JSON block',
            '## OC-20, repeat 4\nerror: throttled',
            '## OC-99, repeat 1\nnot a playByPlay cell',
        ].join('\n\n'))
    })
})
