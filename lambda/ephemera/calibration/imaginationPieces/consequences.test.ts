import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { planOf, type ActionPlan } from '../oracleLoop/actionPlan'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { CONSEQUENCES_OPTIONS, checkConsequences, consequences, consequencesCells, consequencesContract, consequencesPlansText, renderConsequences, replyHandles, type ConsequencesInputs } from './consequences'
import { fixtureScene, namedHandles } from './imaginationScene'
import { textHash } from '../textHash'

const pickUp: ActionPlan = planOf([{ step: { says: 'pick up [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: 'pick up [table1]' }] }])

const cellOf = (inputs: Partial<ConsequencesInputs>): ReadPieceCell<ConsequencesInputs> => ({
    inputs: { fixture: 'teaTable', plan: pickUp, target: 'pick-up-table1', things: ['saucer1', 'cup1'], ...inputs },
    lookFor: 'anything',
    source: 'hand-written',
})

const fenced = (value: unknown): string => `The saucer rises.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

describe('consequences', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('gives the explicit scene, then the plan, the step to expand and the things to describe last', async () => {
            const text = await renderConsequences(cellOf({}), CONSEQUENCES_OPTIONS)
            expect(text.startsWith('Scene: ')).toBe(true)
            expect(text).toContain('\n\nThe things:\n- ')
            expect(text).not.toContain('Graph')
            expect(text).not.toContain('Rules:')
            expect(text.split('\n\n').slice(-4)).toEqual([
                'End of scene.',
                'The plan:\nStep pick-up-table1: pick up [table1]\n  - intent pick-up-table1.intent: pick up [table1]',
                'The step to expand: pick-up-table1',
                'The things to describe: [saucer1], [cup1]',
            ])
        })

        it('shows the listed things and every thing the plan names in the scene', async () => {
            const plan = planOf([{ step: { says: 'tip [table1]', suppliedBy: 'system' }, items: [{ kind: 'intent', says: '[teapot1] pours [tea2] into [cup1]' }] }])
            const text = await renderConsequences(cellOf({ plan, target: 'tip-table1', things: ['saucer1'] }), CONSEQUENCES_OPTIONS)
            const scene = text.slice(0, text.indexOf('End of scene.'))
            expect(['saucer1', 'table1', 'teapot1', 'tea2', 'cup1'].filter((handle) => !scene.includes(`[${handle}]`))).toEqual([])
        })

        it('still takes the judge render, as an option', async () => {
            const text = await renderConsequences(cellOf({ things: ['teapot1'] }), { rules: 'consequence', scene: 'judge' })
            expect(text).toContain('\nGraph:\n')
            expect(text).toContain('[teapot1] is glued to [table1].')
        })

        it.each([
            [{ things: [] }, /No things to describe/],
            [{ things: ['cup1', 'saucer1', 'cup1'] }, /Things listed twice: cup1/],
            [{ target: 'tip-table1' }, /The target "tip-table1" names no step of the plan/],
            [{ target: 'pick-up-table1.pick-up-table1' }, /names no step of the plan/],
            [{ things: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
        ])('throws on %j', async (inputs, error) => {
            await expect(renderConsequences(cellOf(inputs), CONSEQUENCES_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to the explicit render with no rules, and refuses another shape', () => {
            expect(consequences.parseOptions(undefined)).toEqual({ rules: 'none', scene: 'explicit' })
            expect(consequences.parseOptions({})).toEqual({ rules: 'none', scene: 'explicit' })
            expect(consequences.parseOptions({ scene: 'judge', rules: 'consequence' })).toEqual({ rules: 'consequence', scene: 'judge' })
            expect(consequences.parseOptions({ rules: 'v45' })).toBe("options must be { rules?: 'none' | 'consequence', scene?: 'judge' | 'explicit' }")
        })

        it('refuses rules: consequence under the explicit render, its default included', () => {
            expect(consequences.parseOptions({ scene: 'explicit', rules: 'consequence' })).toMatch(/takes no rules: 'consequence'/)
            expect(consequences.parseOptions({ rules: 'consequence' })).toMatch(/takes no rules: 'consequence'/)
        })
    })

    describe('the check: does the block merge into the plan?', () => {
        const cell = cellOf({})

        it('merges changes with no `to` into the step to expand, as code supplies it', () => {
            const reply = fenced({ changes: [
                { add: 'consequence', thing: '[saucer1]', says: '[saucer1] rises with [table1]' },
                { add: 'concern', says: '[cup1] may rattle on [saucer1]' },
            ] })
            expect(checkConsequences(reply, cell)).toEqual([])
            expect(consequencesContract.parse(reply, { input: cell.inputs, rendered: '' })).toEqual({ value: { steps: [{
                ...pickUp.steps[0],
                items: [
                    ...pickUp.steps[0].items,
                    { kind: 'consequence', path: 'pick-up-table1.saucer1-rises-table1', thing: 'saucer1', says: '[saucer1] rises with [table1]' },
                    { kind: 'concern', path: 'pick-up-table1.cup1-may-rattle', says: '[cup1] may rattle on [saucer1]' },
                ],
            }] } })
        })

        it('brackets bare handles in `says`, the plan\'s and the listed things\' (CQ-P5), and reads a bare `thing`', () => {
            const reply = fenced({ changes: [{ add: 'consequence', thing: 'saucer1', says: 'saucer1 rises with table1' }, { add: 'concern', says: 'Cup1 may rattle' }] })
            const parsed = consequencesContract.parse(reply, { input: cell.inputs, rendered: '' })
            expect('value' in parsed && parsed.value.steps[0].items.slice(1).map(({ says }) => says)).toEqual(['[saucer1] rises with [table1]', '[cup1] may rattle'])
        })

        it('brackets a handle only the rendered prompt names', () => {
            const reply = fenced({ changes: [{ add: 'concern', says: 'teapot1 tips' }] })
            const parsed = consequencesContract.parse(reply, { input: cell.inputs, rendered: 'On [table1] is [teapot1].' })
            expect('value' in parsed && parsed.value.steps[0].items[1].says).toBe('[teapot1] tips')
        })

        describe('the handles a reply may name: the listed things, plus the target step\'s own', () => {
            const tipCell = consequencesCells['OC-30/2']
            const success = [{ thing: '[teapot1]', says: '[teapot1] pours [tea2] into [cup1]' }]
            const failure = [{ thing: '[saucer1]', says: '[saucer1] and [cup1] slide off' }]

            it('lists them: the things, then the handles the step and its intent name', () => {
                expect(replyHandles(tipCell.inputs)).toEqual(['saucer1', 'cup1', 'table1', 'teapot1', 'tea2'])
                expect(replyHandles(cell.inputs)).toEqual(['saucer1', 'cup1', 'table1'])
            })

            it('passes a possibility whose success branch names what the intent names, unlisted', () => {
                const reply = fenced({ changes: [{ add: 'possibility', kind: 'execution', says: 'tipping [table1] gently', branches: [success, failure] }] })
                expect(checkConsequences(reply, tipCell)).toEqual([])
            })

            it('passes a line for the step\'s own thing (batch 2\'s [table1], CQ-P4: redundant, not wrong)', () => {
                expect(checkConsequences(fenced({ changes: [{ add: 'consequence', thing: 'table1', says: '[table1] rises' }] }), cell)).toEqual([])
            })

            it('brackets bare handles inside branches, as in flat changes (CQ-P5)', () => {
                const reply = fenced({ changes: [{ add: 'possibility', kind: 'execution', says: 'tipping table1 gently', branches: [[{ thing: 'teapot1', says: 'teapot1 pours' }], []] }] })
                const parsed = consequencesContract.parse(reply, { input: tipCell.inputs, rendered: '' })
                const possibility = 'value' in parsed ? parsed.value.steps[0].items[1] : undefined
                expect(possibility?.kind === 'possibility' && [possibility.says, possibility.branches[0].items[0].says]).toEqual(['tipping [table1] gently', '[teapot1] pours'])
            })
        })

        it('passes an empty list: nothing to add', () => {
            expect(checkConsequences(fenced({ changes: [] }), cell)).toEqual([])
        })

        it.each([
            ['no block', 'The saucer rises.', ['no JSON block']],
            ['the old block', fenced({ actions: [{ saucer1: 'rises' }], problems: [] }), [
                'the JSON block has no "changes" array',
                'the JSON block has "actions"; everything it adds goes in "changes"',
                'the JSON block has "problems"; everything it adds goes in "changes"',
            ]],
            ['a `to` naming another step', fenced({ changes: [{ add: 'consequence', to: 'tip-table1', says: 'x' }] }), ['change 1: to "tip-table1" is not the step being expanded, pick-up-table1']],
            ['a thing neither listed nor named by the step (CQ-P4)', fenced({ changes: [{ add: 'consequence', thing: 'teapot1', says: '[teapot1] rises' }] }), ['change 1: thing "teapot1" is not a listed thing or named by the step']],
            ['a key beside "changes" (batch 4)', fenced({ changes: [], concerns: [{ add: 'concern', says: 'x' }] }), ['the JSON block has "concerns"; everything it adds goes in "changes"']],
            ['an intended consequence', fenced({ changes: [{ add: 'consequence', intended: true, says: 'x' }] }), ['change 1: "intended" isn\'t writable: a change adds only unintended consequences']],
        ])('refuses %s', (_, reply, problems) => {
            expect(checkConsequences(reply, cell)).toEqual(problems)
        })
    })

    describe('its cells', () => {
        it('each a one-step plan holding its intent and no consequences, so the reply establishes the outcome (the user, 2026-11-18)', () => {
            expect(Object.fromEntries(Object.entries(consequencesCells).map(([id, { inputs: { plan, target } }]) => [id, { target, plan }]))).toEqual({
                'OC-30/2': { target: 'tip-table1', plan: { steps: [{
                    says: 'tip [table1]', suppliedBy: 'system', path: 'tip-table1',
                    items: [{ kind: 'intent', path: 'tip-table1.intent', says: '[teapot1] pours [tea2] into [cup1]' }],
                }] } },
                'OC-1': { target: 'pick-up-table1', plan: { steps: [{
                    says: 'pick up [table1]', suppliedBy: 'system', path: 'pick-up-table1',
                    items: [{ kind: 'intent', path: 'pick-up-table1.intent', says: 'pick up [table1]' }],
                }] } },
                cup: { target: 'pick-up-cup1', plan: { steps: [{
                    says: 'pick up [cup1]', suppliedBy: 'system', path: 'pick-up-cup1',
                    items: [{ kind: 'intent', path: 'pick-up-cup1.intent', says: 'pick up [cup1]' }],
                }] } },
                'OC-1/teapot1': { target: 'pick-up-table1', plan: { steps: [{
                    says: 'pick up [table1]', suppliedBy: 'system', path: 'pick-up-table1',
                    items: [{ kind: 'intent', path: 'pick-up-table1.intent', says: 'pick up [table1]' }],
                }] } },
            })
        })

        it.each(Object.keys(consequencesCells))('%s renders, with every thing in its fixture\'s scene', async (id) => {
            const cell = consequencesCells[id]
            const text = await renderConsequences(cell, CONSEQUENCES_OPTIONS)
            expect(text).toContain(`\n\nThe step to expand: ${cell.inputs.target}\n\n`)
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.things, ...cell.inputs.plan.steps.flatMap(({ says, items }) => [says, ...items.map((item) => item.says)]).flatMap(namedHandles)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it('pins the inputs hashes, re-pinned when intents became `.intent` (batches 3 and 4 ran 869da3e1 and bfa18eab)', async () => {
            expect(textHash(await renderConsequences(consequencesCells['OC-30/2'], CONSEQUENCES_OPTIONS))).toBe('c639e8eb')
            expect(textHash(await renderConsequences(consequencesCells['OC-1'], CONSEQUENCES_OPTIONS))).toBe('030c1940')
        })

        it('pins the over-flagging cells\' inputs hashes, re-pinned when intents became `.intent` (batch 5 ran 5db10e38 and ef0c4cda)', async () => {
            expect(textHash(await renderConsequences(consequencesCells.cup, CONSEQUENCES_OPTIONS))).toBe('8bb8636c')
            expect(textHash(await renderConsequences(consequencesCells['OC-1/teapot1'], CONSEQUENCES_OPTIONS))).toBe('ad08de90')
        })

        it('the over-flagging cells: the cup lists its tea beside the saucer, and OC-1 narrowed lists the glued teapot alone', () => {
            expect(consequencesCells.cup.inputs.things).toEqual(['saucer1', 'tea1'])
            expect(consequencesCells['OC-1/teapot1'].inputs.things).toEqual(['teapot1'])
            expect(consequencesCells['OC-1/teapot1'].inputs.plan).toBe(consequencesCells['OC-1'].inputs.plan)
        })

        it('OC-30/2 lists the cup, which its intent names, beside the saucer, which it doesn\'t (user, 2026-11-11)', () => {
            expect(consequencesCells['OC-30/2'].inputs.things).toEqual(['saucer1', 'cup1'])
        })
    })

    it('prints a batch\'s merged plans for reading (`read-plans`)', () => {
        const slide = fenced({ changes: [{ add: 'consequence', thing: 'cup1', says: '[cup1] slides off with [saucer1]' }] })
        expect(consequencesPlansText([
            { cell: 'OC-30/2', lookFor: '', replies: [{ repeat: 1, reply: slide }, { repeat: 2, reply: fenced({ changes: [{ add: 'concern', to: 'tip', says: 'x' }] }) }] },
            { cell: 'OC-99', lookFor: '', replies: [{ repeat: 1, reply: slide }] },
        ])).toBe([
            '## OC-30/2, repeat 1\nStep tip-table1: tip [table1]\n  - intent tip-table1.intent: [teapot1] pours [tea2] into [cup1]\n  - consequence tip-table1.cup1-slides-saucer1: [cup1] slides off with [saucer1]',
            '## OC-30/2, repeat 2\nform: change 1: to "tip" is not the step being expanded, tip-table1',
            '## OC-99, repeat 1\nnot a consequences cell',
        ].join('\n\n'))
    })

    it('is registered, and runs through the probe: four cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages[0].content?.[0]?.text ?? ''
            const things = namedHandles(prompt.slice(prompt.lastIndexOf('The things to describe: ')))
            return { success: true as const, body: fenced({ changes: things.map((handle) => ({ add: 'consequence', thing: handle, says: `[${handle}] stays` })) }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'consequences', instructions: 'Say what happens.', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(12)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 12, formFails: 0, errors: 0 })
        expect(result.read.map(({ cell, replies }: { cell: string; replies: unknown[] }) => [cell, replies.length])).toEqual(
            Object.keys(consequencesCells).map((id) => [id, 3]),
        )
    })
})
