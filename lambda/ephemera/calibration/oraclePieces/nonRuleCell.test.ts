import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import type { PieceCell } from '../pieceProbe/oraclePiece'
import { pieces } from '../pieceProbe/pieces'
import {
    gradeNonRuleCell, matchQuote, nonRuleCell, nonRuleCellCells, normalizeStep, quotables, renderNonRuleCell, type NonRuleCellInputs,
} from './nonRuleCell'

const h7 = nonRuleCellCells['OC-30/h7']
const fence = (json: object): string => ['Tipping the table slides the saucer and cup off, so the pour misses.', '', '```json', JSON.stringify(json), '```'].join('\n')
const TIP = 'tip [table1]'
const SLIDE = '[saucer1] and [cup1] slide off [table1] onto the floor'
const POUR = '[teapot1] pours [tea2] into [cup1]'
const works = (step: string) => ({ step, finding: 'works', establishes: 'it happened' })
const blocked = (step: string, cause: string) => ({ step, finding: 'blocked', cause, reason: 'x', establishes: 'nonsense' })
const detail = (step: string, of: string) => ({ step, finding: 'needs detail', of, missing: 'y', establishes: 'part of it' })
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
                '  - (consequence) [saucer1] and [cup1] slide off [table1] onto the floor',
                '- (intended) [teapot1] pours [tea2] into [cup1]',
            ].join('\n'))
        })

        it('renders a step with no consequence lines as one line', async () => {
            const text = await renderNonRuleCell(nonRuleCellCells['OC-30/h10'])
            expect(text.split('The steps, in order:\n')[1]).toBe(['- (method) pick up [saucer1]', '- (method) tip [table1]', '- (intended) [teapot1] pours [tea2] into [cup1]'].join('\n'))
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
            [{ steps: [{ says: 'tip [table1]', role: 'method' as const }, { says: 'Tip table1.', role: 'method' as const }] }, /Lines a quote can't tell apart: Tip table1\./],
            [{ steps: [{ says: 'tip [table1]', role: 'method' as const, consequences: ['[kettle1] falls'] }] }, /names kettle1, not in teaTable's scene/],
            [{ steps: [{ says: 'tip [table1]', role: 'method' as const, consequences: ['Tip [table1]'] }] }, /Lines a quote can't tell apart: Tip \[table1\]/],
        ])('throws on cell data that doesn\'t fit: %j', async (inputs, error) => {
            await expect(renderNonRuleCell(cellOf(inputs))).rejects.toThrow(error)
        })
    })

    describe('quote matching', () => {
        it('normalizes case, brackets, whitespace, surrounding quotes and end punctuation', () => {
            expect(normalizeStep('  "Tip  [Table1]."  ')).toBe('tip table1')
        })

        it('labels the steps by position and their lines under them', () => {
            expect(quotables(h7.inputs.steps, true).map(({ label }) => label)).toEqual(['1', '1c1', '2'])
            expect(quotables(h7.inputs.steps, false).map(({ label }) => label)).toEqual(['1', '2'])
        })

        it.each([
            [TIP, '1'],
            ['Tip table1.', '1'],
            [POUR, '2'],
            ['slide off [table1]', '1c1'],
            ['tip', '1'],
            ['[saucer1] and [cup1]', '1c1'],
        ])('%j quotes %s', (quote, label) => {
            const matched = matchQuote(quote, quotables(h7.inputs.steps, true))
            expect('quoted' in matched && matched.quoted.label).toBe(label)
        })

        it.each([
            ['pours tea', { malformed: '"pours tea" quotes nothing given' }],
            ['[table1]', { malformed: '"[table1]" quotes 2 things' }],
            ['  ', { malformed: 'an empty quote' }],
        ])('%j', (quote, result) => {
            expect(matchQuote(quote, quotables(h7.inputs.steps, true))).toEqual(result)
        })

        it('prefers a whole match over a quote falling inside another step', () => {
            const steps = [{ says: 'tip [table1]', role: 'method' as const }, { says: 'tip [table1] over', role: 'method' as const }]
            const matched = matchQuote('tip [table1]', quotables(steps, false))
            expect('quoted' in matched && matched.quoted.label).toBe('1')
        })
    })

    describe('the grade', () => {
        it.each([
            [[works(TIP), works(POUR)], { answer: 'allows' }],
            [[works(TIP), blocked(POUR, SLIDE)], { answer: 'blocks 2/1c1' }],
            [[works(TIP), blocked('pours [tea2]', 'slide off')], { answer: 'blocks 2/1c1' }],
            [[blocked(TIP, TIP), blocked(POUR, TIP)], { answer: 'blocks 1/1' }],
            [[works(TIP), blocked(POUR, TIP)], { answer: 'blocks 2/1' }],
            [[detail(TIP, 'Consequences'), works(POUR)], { answer: 'needs detail of consequences 1' }],
            [[works(TIP), detail(POUR, 'action')], { answer: 'needs detail of action 2' }],
            [[{ ...works(TIP), finding: ' Works ' }, { ...works(POUR), note: 'a field no finding has' }], { answer: 'allows' }],
            [[{ ...works(TIP), 'for and against': 'read by hand' }, { ...blocked(POUR, SLIDE), 'for and against': 'read by hand' }], { answer: 'blocks 2/1c1' }],
            [[{ ...works(TIP), factors: ['[table1] is light: For'] }, { ...blocked(POUR, SLIDE), factors: ['read by hand'] }], { answer: 'blocks 2/1c1' }],
        ])('takes the first step that doesn\'t work: %j', (steps, result) => {
            expect(grade({ steps })).toEqual(result)
        })

        it.each([
            ['absent', [works(TIP), { step: POUR, finding: 'blocked', reason: 'x', establishes: 'y' }], { answer: 'blocks 2/2' }],
            ['empty', [works(TIP), { ...blocked(POUR, TIP), cause: ' ' }], { answer: 'blocks 2/2' }],
            ['quoting the step itself', [works(TIP), blocked(POUR, POUR)], { answer: 'blocks 2/2' }],
            ['quoting nothing given (a reason or a scene fact)', [blocked(TIP, '[table1] is far larger than [cup1]'), works(POUR)], { answer: 'blocks 1/1' }],
        ])('reads a cause %s as the blocked step itself', (_, steps, result) => {
            expect(grade({ steps })).toEqual(result)
        })

        it.each([
            [{ answer: 'allows' }, 'the JSON block has no "steps" array'],
            [{ steps: [works(TIP)] }, '"steps" has 1 entries for 2 steps'],
            [{ steps: [works(POUR), works(TIP)] }, 'entry 1: step: quotes step 2, not step 1'],
            [{ steps: [works(TIP), works(SLIDE)] }, 'entry 2: step: "[saucer1] and [cup1] slide off [table1] onto the floor" quotes nothing given'],
            [{ steps: ['works', works(POUR)] }, 'entry 1: is not an object'],
            [{ steps: [{ step: TIP, establishes: 'x' }, works(POUR)] }, 'entry 1: has no string "finding"'],
            [{ steps: [{ ...works(TIP), finding: 'maybe' }, works(POUR)] }, 'entry 1: "maybe" is not one of works, blocked, needs detail'],
            [{ steps: [{ ...works(TIP), reason: 'fine' }, works(POUR)] }, 'entry 1: works has another finding\'s fields: reason'],
            [{ steps: [{ ...blocked(TIP, TIP), missing: 'y' }, works(POUR)] }, 'entry 1: blocked has another finding\'s fields: missing'],
            [{ steps: [{ step: TIP, finding: 'works' }, works(POUR)] }, 'entry 1: works needs non-empty string fields: establishes'],
            [{ steps: [{ ...works(TIP), cause: TIP }, works(POUR)] }, 'entry 1: works has another finding\'s fields: cause'],
            [{ steps: [detail(TIP, 'sizes'), works(POUR)] }, 'entry 1: "of" is "sizes", not one of action, consequences'],
            [{ steps: [blocked(TIP, POUR), works(POUR)] }, 'entry 1: cause: quotes 2, after the blocked step'],
            [{ steps: [works(TIP), blocked(POUR, '[table1]')] }, 'entry 2: cause: "[table1]" quotes 2 things'],
        ])('marks malformed: %j', (json, malformed) => {
            expect(grade(json)).toEqual({ malformed })
        })

        it('marks a reply with no block malformed', () => {
            expect(gradeNonRuleCell('Answer: allows', h7)).toEqual({ malformed: 'no JSON block' })
        })
    })

    describe('its cells', () => {
        it.each(Object.keys(nonRuleCellCells))('%s renders, and its expected answer is canonical', async (id) => {
            const cell = nonRuleCellCells[id]
            await expect(renderNonRuleCell(cell)).resolves.toEqual(expect.any(String))
            const labels = quotables(cell.inputs.steps, true)
            const [, step, cause] = /^blocks (\d+)\/(\S+)$/.exec(cell.expected ?? '') ?? []
            if (step !== undefined) {
                expect(labels.map(({ label }) => label)).toContain(cause)
                expect(labels.find(({ label }) => label === cause)?.step).toBeLessThanOrEqual(Number(step))
            }
            const position = `[1-${cell.inputs.steps.length}]`
            expect(cell.expected ?? 'allows').toMatch(new RegExp(`^(allows|blocks ${position}/${position}(c\\d+)?|needs detail of (action|consequences) ${position})$`))
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
        // A stub that finds every step works, quoting each from the prompt's step lines.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const steps = [...prompt.matchAll(/^- \((?:intended|method)\) (.*)$/gm)].map(([, says]) => works(says))
            return { success: true as const, body: fence({ steps }) }
        })
        const cells = ['OC-11', 'OC-18', 'OC-3', 'OC-1', 'OC-2', 'OC-20', 'OC-6', 'OC-9']
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'nonRuleCell', cells, instructions: 'Can each step happen?', repeats: 3 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(24)
        expect(invoke.mock.calls[0][0].maxTokens).toBe(1536)
        const result = JSON.parse(response.body)
        expect(result.summary).toEqual({ calls: 24, right: 12, wrong: 9, malformed: 0, errors: 0, byCode: 0, ungraded: 3 })
        expect(result.cells.find(({ cell }: { cell: string }) => cell === 'OC-11')).toMatchObject({ expected: 'blocks 1/1', lookFor: expect.any(String), answers: { allows: 3 } })
    })
})
