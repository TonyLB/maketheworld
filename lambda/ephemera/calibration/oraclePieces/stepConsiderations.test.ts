import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { pieces } from '../pieceProbe/pieces'
import { nonRuleCellCells, renderNonRuleCell } from './nonRuleCell'
import { checkStepConsiderations, stepConsiderations, stepConsiderationsCells } from './stepConsiderations'

const h7 = stepConsiderationsCells['OC-30/h7']
const fence = (json: unknown): string => ['The tip slides the cup off.', '', '```json', JSON.stringify(json), '```'].join('\n')
const TIP = 'tip [table1]'
const POUR = '[teapot1] pours [tea2] into [cup1]'
const entry = (step: string, considering: unknown = ['where [cup1] is']) => ({ step, considering })
const check = (json: unknown) => checkStepConsiderations(fence(json), h7)

describe('stepConsiderations', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('its cells', () => {
        it('are the non-rule cell\'s, with the same inputs, so they render the same', async () => {
            expect(Object.keys(stepConsiderationsCells)).toEqual(Object.keys(nonRuleCellCells))
            for (const [id, cell] of Object.entries(stepConsiderationsCells)) {
                expect(cell.inputs).toBe(nonRuleCellCells[id].inputs)
                expect(await stepConsiderations.render(cell, undefined)).toBe(await renderNonRuleCell(nonRuleCellCells[id]))
            }
        })

        it('each carry their own lookFor, with no expected answer', () => {
            for (const cell of Object.values(stepConsiderationsCells)) {
                expect(cell.lookFor.trim()).not.toBe('')
                expect(cell).not.toHaveProperty('expected')
            }
        })
    })

    describe('the check', () => {
        it.each([
            [{ steps: [entry(TIP), entry(POUR)] }],
            [{ steps: [entry('tip'), entry('pours [tea2]', ['a', 'b'])], extra: 'ignored' }],
        ])('passes a block with an entry per step, each quoting its step, with a list of items: %j', (json) => {
            expect(check(json)).toEqual([])
        })

        it.each([
            [{ considering: [] }, ['the JSON block has no "steps" array']],
            [{ steps: [entry(TIP)] }, ['"steps" has 1 entries for 2 steps']],
            [{ steps: [entry(POUR), entry(TIP)] }, ['entry 1: step: quotes step 2, not step 1', 'entry 2: step: quotes step 1, not step 2']],
            [{ steps: ['tip', entry(POUR)] }, ['entry 1 is not an object']],
            [{ steps: [{ considering: ['x'] }, entry(POUR)] }, ['entry 1: step: has no string "step"']],
            [{ steps: [entry('the glue'), entry(POUR)] }, ['entry 1: step: "the glue" quotes nothing given']],
            [{ steps: [entry(TIP, []), entry(POUR, 'one item')] }, [
                'entry 1: "considering" is not a non-empty list of non-empty strings',
                'entry 2: "considering" is not a non-empty list of non-empty strings',
            ]],
            [{ steps: [entry(TIP, ['ok', ' ']), entry(POUR, [{ item: 'x' }])] }, [
                'entry 1: "considering" is not a non-empty list of non-empty strings',
                'entry 2: "considering" is not a non-empty list of non-empty strings',
            ]],
        ])('lists every form problem: %j', (json, problems) => {
            expect(check(json)).toEqual(problems)
        })

        it('flags a reply with no block', () => {
            expect(checkStepConsiderations('Consider the cup.', h7)).toEqual(['no JSON block'])
        })
    })

    it('takes no options', () => {
        expect(stepConsiderations.parseOptions(undefined)).toBeUndefined()
        expect(stepConsiderations.parseOptions({ formats: ['D'] })).toBe('stepConsiderations takes no options')
    })

    it('is registered, and runs through the probe: every cell once, at the cap, each reply form-checked', async () => {
        // A stub that considers one thing per step, quoting each from the prompt's step lines.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const steps = [...prompt.matchAll(/^- \((?:intended|method)\) (.*)$/gm)].map(([, says]) => entry(says))
            return { success: true as const, body: fence({ steps }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'stepConsiderations', instructions: 'What should be considered?', repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 1024)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 11, formFails: 0, errors: 0 })
    })
})
