import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import { CONSEQUENCES_OPTIONS, checkConsequences, consequences, consequencesCells, renderConsequences, type ConsequencesInputs } from './consequences'
import { fixtureScene, namedHandles } from './imaginationScene'
import { textHash } from '../textHash'

const cellOf = (inputs: Partial<ConsequencesInputs>): ReadPieceCell<ConsequencesInputs> => ({
    inputs: { fixture: 'teaTable', actions: ['pick up [table1]'], intent: 'I want to pick up [table1].', things: ['saucer1', 'cup1'], ...inputs },
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
        it('gives the sub-scene, then each action in order, then the intent, then the listed things last', async () => {
            const text = await renderConsequences(cellOf({}), CONSEQUENCES_OPTIONS)
            expect(text.startsWith('Scene: ')).toBe(true)
            expect(text.split('\n\n').slice(-4)).toEqual([
                'End of scene.',
                'Action 1: pick up [table1]',
                'The intent: I want to pick up [table1].',
                'The things: [saucer1], [cup1]',
            ])
        })

        it('shows the listed things and the things the actions name in the scene', async () => {
            const text = await renderConsequences(cellOf({}), CONSEQUENCES_OPTIONS)
            const scene = text.slice(0, text.indexOf('End of scene.'))
            expect(['saucer1', 'cup1', 'table1'].filter((handle) => !scene.includes(`[${handle}]`))).toEqual([])
        })

        it('shows the rules as fact and consequence with rules: consequence, and no rules by default', async () => {
            const cell = cellOf({ things: ['teapot1'] })
            expect(await renderConsequences(cell, CONSEQUENCES_OPTIONS)).not.toContain('Rules:')
            expect(await renderConsequences(cell, { rules: 'consequence' })).toContain('[teapot1] is glued to [table1].')
        })

        it.each([
            [{ actions: [] }, /No actions/],
            [{ things: [] }, /No things to describe/],
            [{ things: ['cup1', 'saucer1', 'cup1'] }, /Things listed twice: cup1/],
            [{ intent: ' ' }, /No intent/],
            [{ actions: ['pick up [kettle1]'] }, /The actions name kettle1, not in teaTable's scene/],
            [{ things: ['kettle1'] }, /Unknown scene handle\(s\) kettle1/],
        ])('throws on %j', async (inputs, error) => {
            await expect(renderConsequences(cellOf(inputs), CONSEQUENCES_OPTIONS)).rejects.toThrow(error)
        })
    })

    describe('its options', () => {
        it('defaults to no rules, and refuses another shape', () => {
            expect(consequences.parseOptions(undefined)).toEqual({ rules: 'none' })
            expect(consequences.parseOptions({ rules: 'consequence' })).toEqual({ rules: 'consequence' })
            expect(consequences.parseOptions({ rules: 'v45' })).toBe("options must be { rules?: 'none' | 'consequence', scene?: 'judge' | 'explicit' }")
        })

        it('takes a scene render, and refuses the explicit render with rules: consequence (AGENT.actionPlan.planning.md, step 4a)', () => {
            expect(consequences.parseOptions({ scene: 'explicit' })).toEqual({ rules: 'none', scene: 'explicit' })
            expect(consequences.parseOptions({ scene: 'judge', rules: 'consequence' })).toEqual({ rules: 'consequence', scene: 'judge' })
            expect(consequences.parseOptions({ scene: 'prose' })).toBe("options must be { rules?: 'none' | 'consequence', scene?: 'judge' | 'explicit' }")
            expect(consequences.parseOptions({ scene: 'explicit', rules: 'consequence' })).toMatch(/takes no rules: 'consequence'/)
        })
    })

    describe('the explicit render (AGENT.actionPlan.planning.md, step 4a)', () => {
        it('leaves the default render as batch 1 had it: the inputs hashes hold', async () => {
            expect(textHash(await renderConsequences(consequencesCells['OC-30/2'], CONSEQUENCES_OPTIONS))).toBe('d1d07973')
            expect(textHash(await renderConsequences(consequencesCells['OC-1'], CONSEQUENCES_OPTIONS))).toBe('b96b6792')
        })

        it.each(Object.keys(consequencesCells))('%s gives the explicit sub-scene in place of the Fiction and Graph, then the actions, the intent and the things to describe', async (id) => {
            const cell = consequencesCells[id]
            const text = await renderConsequences(cell, { rules: 'none', scene: 'explicit' })
            const judged = await renderConsequences(cell, CONSEQUENCES_OPTIONS)
            expect(text.split('\n\n')[0]).toBe(judged.split('\n\n')[0])
            expect(text).toContain('\n\nThe things:\n- ')
            expect(text).not.toContain('Graph')
            expect(text).not.toContain('Reading the scene')
            expect(text.split('\n\n').slice(-(cell.inputs.actions.length + 3))).toEqual([
                'End of scene.',
                ...cell.inputs.actions.map((says, index) => `Action ${index + 1}: ${says}`),
                `The intent: ${cell.inputs.intent}`,
                `The things to describe: ${cell.inputs.things.map((handle) => `[${handle}]`).join(', ')}`,
            ])
        })

        it('states the securing as a carry line, with no Rules section', async () => {
            const text = await renderConsequences(cellOf({ things: ['teapot1'] }), { rules: 'none', scene: 'explicit' })
            expect(text).not.toContain('Rules:')
            expect(text).toContain('[teapot1] is glued to [table1]')
        })
    })

    describe('the check', () => {
        const cell = cellOf({})

        it('passes a line for some of the listed things, a silent one staying in its frame', () => {
            expect(checkConsequences(fenced({ actions: [{ saucer1: 'rises with [table1]' }], problems: [] }), cell)).toEqual([])
        })

        it.each([
            ['no block', 'The saucer rises.', ['no JSON block']],
            ['the wrong count', fenced({ actions: [] }), ['expected 1 actions, got 0']],
            ['a named thing not listed', fenced({ actions: [{ saucer1: 'rises', table1: 'rises' }] }), ['action 1: table1 is not a listed thing']],
            ['an empty line', fenced({ actions: [{ '[cup1]': ' ' }] }), ["action 1: cup1's line is empty"]],
        ])('reports %s', (_, reply, problems) => {
            expect(checkConsequences(reply, cell)).toEqual(problems)
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(consequencesCells))('%s renders, with its case\'s request as the intent, and every thing in its fixture\'s scene', async (id) => {
            const cell = consequencesCells[id]
            const text = await renderConsequences(cell, CONSEQUENCES_OPTIONS)
            expect(text).toContain(`\n\nThe intent: ${cell.inputs.intent}\n\n`)
            const scene = await fixtureScene(cell.inputs.fixture)
            const named = [...cell.inputs.things, ...cell.inputs.actions.flatMap(namedHandles)]
            expect(named.filter((handle) => scene.things[handle] === undefined)).toEqual([])
        })

        it('OC-30/2 lists the cup, which its action names, beside the saucer, which it doesn\'t (user, 2026-11-11)', () => {
            expect(consequencesCells['OC-30/2'].inputs.things).toEqual(['saucer1', 'cup1'])
            expect(consequencesCells['OC-30/2'].inputs.actions.flatMap(namedHandles)).toContain('cup1')
        })
    })

    it('is registered, and runs through the probe: two cells x 3, each reply form-checked and grouped by cell', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages[0].content?.[0]?.text ?? ''
            const things = namedHandles(prompt.slice(prompt.lastIndexOf('The things: ')))
            const actions = prompt.split('\n\n').filter((part) => part.startsWith('Action ')).length
            return { success: true as const, body: fenced({ actions: Array(actions).fill(Object.fromEntries(things.map((handle) => [handle, 'stays']))), problems: [] }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'consequences', instructions: 'Say what happens.', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(6)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 6, formFails: 0, errors: 0 })
        expect(result.read.map(({ cell, replies }: { cell: string; replies: unknown[] }) => [cell, replies.length])).toEqual(
            Object.keys(consequencesCells).map((id) => [id, 3]),
        )
    })
})
