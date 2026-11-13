import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { PieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import {
    gradeNonRuleCell, matchStep, nonRuleCell, nonRuleCellCells, normalizeStep, renderNonRuleCell, type NonRuleCellInputs,
} from './nonRuleCell'

const h7 = nonRuleCellCells['OC-30/h7']
const fence = (json: object): string => ['Tipping the table slides the saucer and cup off, so the pour misses.', '', '```json', JSON.stringify(json), '```'].join('\n')
const grade = (json: object, cell: PieceCell<NonRuleCellInputs> = h7) => gradeNonRuleCell(fence(json), cell)
const cellOf = (inputs: Partial<NonRuleCellInputs>): PieceCell<NonRuleCellInputs> => ({ ...h7, inputs: { ...h7.inputs, ...inputs } })

describe('nonRuleCell', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    describe('the render', () => {
        it('shows the whole scene with no Rules section, then the request, then each step with its role, unnumbered', async () => {
            const text = await renderNonRuleCell(h7)
            expect(text.startsWith('Scene: The Parlour\n\nFiction:\n')).toBe(true)
            expect(text).not.toContain('Rules:')
            expect(text).toContain('[saucer1]')
            expect(text.split('End of scene.\n\n')[1]).toBe([
                'The player\'s request: I want to pour tea from [teapot1] into [cup1].',
                '',
                'The steps, in order:',
                '- (method) tip [table1]',
                '- (consequence) tipping [table1] slides [saucer1] and [cup1] off',
                '- (intended) [teapot1] pours [tea2] into [cup1]',
            ].join('\n'))
        })

        it('shows things the steps don\'t name: the whole scene, not a sub-scene', async () => {
            const text = await renderNonRuleCell(nonRuleCellCells['OC-2'])
            expect(text).toContain('[teapot1]')
            expect(text).toContain('[table1]')
        })

        it.each([
            [{ steps: [] }, /No steps/],
            [{ request: '  ' }, /No request/],
            [{ steps: [{ says: 'pick up [kettle1]', role: 'intended' as const }] }, /names kettle1, not in teaTable's scene/],
            [{ steps: [{ says: 'tip [table1]', role: 'method' as const }, { says: 'Tip table1.', role: 'method' as const }] }, /Steps a quote can't tell apart: Tip table1\./],
        ])('throws on cell data that doesn\'t fit: %j', async (inputs, error) => {
            await expect(renderNonRuleCell(cellOf(inputs))).rejects.toThrow(error)
        })
    })

    describe('quote matching', () => {
        it('normalizes case, brackets, whitespace, surrounding quotes and end punctuation', () => {
            expect(normalizeStep('  "Tip  [Table1]."  ')).toBe('tip table1')
        })

        it.each([
            ['tip [table1]', { position: 1 }],
            ['Tip table1.', { position: 1 }],
            ['[teapot1] pours [tea2] into [cup1]', { position: 3 }],
            ['slides [saucer1] and [cup1] off', { position: 2 }],
            ['pours tea', { malformed: '"pours tea" quotes no step' }],
            ['tip', { position: 1 }],
            ['[table1]', { malformed: '"[table1]" quotes 2 steps' }],
            ['  ', { malformed: 'an empty quote' }],
        ])('%j', (quote, result) => {
            expect(matchStep(quote, h7.inputs.steps)).toEqual(result)
        })

        it('prefers a whole match over a quote falling inside another step', () => {
            const steps = [{ says: 'tip [table1]', role: 'method' as const }, { says: 'tip [table1] over', role: 'method' as const }]
            expect(matchStep('tip [table1]', steps)).toEqual({ position: 1 })
        })
    })

    describe('the grade', () => {
        it.each([
            [{ answer: 'allows' }, { answer: 'allows' }],
            [{ answer: ' Blocks ', step: '[teapot1] pours [tea2] into [cup1]', cause: 'tipping [table1] slides [saucer1] and [cup1] off', reason: 'The cup is on the floor.' }, { answer: 'blocks 3/2' }],
            [{ answer: 'blocks', step: 'tip [table1]', cause: 'tip [table1]', reason: 'Too heavy.' }, { answer: 'blocks 1/1' }],
            [{ answer: 'needs detail', of: 'Consequences', step: 'tip [table1]', missing: 'what the tip does to the saucer and cup' }, { answer: 'needs detail of consequences 1' }],
            [{ answer: 'needs detail', of: 'action', step: 'pours [tea2]', missing: 'how' }, { answer: 'needs detail of action 3' }],
            [{ answer: 'allows', note: 'a field no answer has' }, { answer: 'allows' }],
            [{ answer: 'maybe' }, { malformed: '"maybe" is not one of allows, blocks, needs detail' }],
            [{ verdict: 'allows' }, { malformed: 'the JSON block has no string "answer"' }],
            [{ answer: 'allows', reason: 'fine' }, { malformed: 'allows has another answer\'s fields: reason' }],
            [{ answer: 'blocks', step: 'tip [table1]', cause: 'tip [table1]', reason: 'x', missing: 'y' }, { malformed: 'blocks has another answer\'s fields: missing' }],
            [{ answer: 'blocks', step: 'tip [table1]', reason: 'x' }, { malformed: 'blocks needs non-empty string fields: cause' }],
            [{ answer: 'needs detail', of: 'action', step: 'tip [table1]', missing: ' ' }, { malformed: 'needs detail needs non-empty string fields: missing' }],
            [{ answer: 'needs detail', of: 'sizes', step: 'tip [table1]', missing: 'how big' }, { malformed: '"of" is "sizes", not one of action, consequences' }],
            [{ answer: 'blocks', step: 'pour the tea', cause: 'tip [table1]', reason: 'x' }, { malformed: 'step: "pour the tea" quotes no step' }],
            [{ answer: 'blocks', step: 'tip [table1]', cause: '[table1]', reason: 'x' }, { malformed: 'cause: "[table1]" quotes 2 steps' }],
        ])('%j', (json, result) => {
            expect(grade(json)).toEqual(result)
        })

        it('marks a reply with no block malformed', () => {
            expect(gradeNonRuleCell('Answer: allows', h7)).toEqual({ malformed: 'no JSON block' })
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(nonRuleCellCells))('%s renders, and its expected answer is canonical', async (id) => {
            const cell = nonRuleCellCells[id]
            await expect(renderNonRuleCell(cell)).resolves.toEqual(expect.any(String))
            const count = cell.inputs.steps.length
            const position = `[1-${count}]`
            expect(cell.expected ?? 'allows').toMatch(new RegExp(`^(allows|blocks ${position}/${position}|needs detail of (action|consequences) ${position})$`))
            expect(cell.lookFor).toEqual(expect.any(String))
        })

        it('has an intended step in every cell', () => {
            expect(Object.entries(nonRuleCellCells).filter(([, { inputs }]) => !inputs.steps.some(({ role }) => role === 'intended')).map(([id]) => id)).toEqual([])
        })

        it('leaves only OC-9 ungraded', () => {
            expect(Object.entries(nonRuleCellCells).filter(([, cell]) => cell.expected === undefined).map(([id]) => id)).toEqual(['OC-9'])
        })
    })

    it('takes no options', () => {
        expect(nonRuleCell.parseOptions(undefined)).toBeUndefined()
        expect(nonRuleCell.parseOptions({ rules: 'none' })).toBe('nonRuleCell takes no options')
    })

    it('is registered, and runs through the probe on its single-step cells, at the cap, graded by its own grade', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: true as const, body: fence({ answer: 'allows' }) }))
        const cells = ['OC-11', 'OC-18', 'OC-3', 'OC-1', 'OC-2', 'OC-20', 'OC-6', 'OC-9']
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'nonRuleCell', cells, instructions: 'Can each step happen?', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(24)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 24, right: 12, wrong: 9, malformed: 0, errors: 0, byCode: 0, ungraded: 3 })
        expect(result.cells.find(({ cell }: { cell: string }) => cell === 'OC-11')).toMatchObject({ expected: 'blocks 1/1', lookFor: expect.any(String), answers: { allows: 3 } })
    })
})
