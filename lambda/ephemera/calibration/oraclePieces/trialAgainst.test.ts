import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { pieces } from '../pieceProbe/pieces'
import { nonRuleCellCells, renderNonRuleCell } from './nonRuleCell'
import { checkTrialAgainst, trialAgainst, trialAgainstCells } from './trialAgainst'

const h7 = trialAgainstCells['OC-30/h7']
const fence = (json: unknown): string => ['The cup is on the floor.', '', '```json', JSON.stringify(json), '```'].join('\n')
const POUR = '[teapot1] pours [tea2] into [cup1]'
const check = (json: unknown) => checkTrialAgainst(fence(json), h7)

describe('trialAgainst', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('its cells', () => {
        it('are the non-rule cell\'s, with the same inputs, so they render the same', async () => {
            expect(Object.keys(trialAgainstCells)).toEqual(Object.keys(nonRuleCellCells))
            for (const [id, cell] of Object.entries(trialAgainstCells)) {
                expect(cell.inputs).toBe(nonRuleCellCells[id].inputs)
                expect(await trialAgainst.render(cell, { securing: 'shown' })).toBe(await renderNonRuleCell(nonRuleCellCells[id]))
            }
        })

        it('each carry their own lookFor, with no expected answer', () => {
            for (const cell of Object.values(trialAgainstCells)) {
                expect(cell.lookFor.trim()).not.toBe('')
                expect(cell).not.toHaveProperty('expected')
            }
        })
    })

    describe('the check', () => {
        it.each([
            [{ step: POUR, argument: 'The cup is on the floor, not under the spout.' }],
            [{ step: 'tip', argument: 'The cup slides away.', extra: 'ignored' }],
        ])('passes a block quoting any step, with an argument: %j', (json) => {
            expect(check(json)).toEqual([])
        })

        it.each([
            [{ argument: 'x' }, ['step: has no string "step"']],
            [{ step: 'the glue', argument: 'x' }, ['step: "the glue" quotes nothing given']],
            [{ step: POUR }, ['has no non-empty string "argument"']],
            [{ step: '', argument: ' ' }, ['step: has no string "step"', 'has no non-empty string "argument"']],
        ])('lists every form problem: %j', (json, problems) => {
            expect(check(json)).toEqual(problems)
        })

        it('flags a reply with no block', () => {
            expect(checkTrialAgainst('It cannot happen.', h7)).toEqual(['no JSON block'])
        })
    })

    describe('its options', () => {
        it.each([
            [undefined, { securing: 'shown' }],
            [{}, { securing: 'shown' }],
            [{ securing: 'omitted' }, { securing: 'omitted' }],
            [{ securing: 'hidden' }, "options must be { securing?: 'shown' | 'omitted' }"],
            [{ securing: 'omitted', formats: ['D'] }, "options must be { securing?: 'shown' | 'omitted' }"],
            ['omitted', "options must be { securing?: 'shown' | 'omitted' }"],
        ])('parses %j', (value, parsed) => {
            expect(trialAgainst.parseOptions(value)).toEqual(parsed)
        })

        it.each([
            ['OC-1', ['glued']],
            ['OC-20', ['chained', 'glued']],
        ])('leaves %s\'s securing out of the scene with securing omitted, and only that', async (id, words) => {
            const shown = await trialAgainst.render(trialAgainstCells[id], { securing: 'shown' })
            const omitted = await trialAgainst.render(trialAgainstCells[id], { securing: 'omitted' })
            // The fiction's securing sentences go, and each graph row loses its securing clause.
            const stripped = shown
                .split('\n')
                .filter((line) => !/^\[\S+\] is (glued|chained) to \[\S+\]\.$/.test(line))
                .map((line) => line.replace(/; \[\S+\] (glued|chained) to \[\S+\]$/, ''))
                .join('\n')
            expect(omitted).toBe(stripped)
            for (const word of words) {
                expect(shown).toContain(word)
                expect(omitted).not.toContain(word)
            }
        })

        it('renders a scene with no securing the same either way', async () => {
            const cell = trialAgainstCells['OC-9']
            expect(await trialAgainst.render(cell, { securing: 'omitted' })).toBe(await trialAgainst.render(cell, { securing: 'shown' }))
        })
    })

    it('is registered, and runs through the probe: every cell once, at the cap, each reply form-checked', async () => {
        // A stub that argues against the last step, quoted from the prompt's step lines.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const steps = [...prompt.matchAll(/^- \((?:intended|method)\) (.*)$/gm)].map(([, says]) => says)
            return { success: true as const, body: fence({ step: steps[steps.length - 1], argument: 'It cannot happen.' }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trialAgainst', instructions: 'Argue against it.', repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 400)).toBe(true)
        expect(JSON.parse(response.body).summary).toEqual({ calls: 11, formFails: 0, errors: 0 })
    })
})
