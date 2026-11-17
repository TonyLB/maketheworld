import { renderSceneExplicit } from '../../../dataSource/actions/sceneProse/renderSceneExplicit'
import { withoutSecuring } from '../../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene } from '../../imaginationPieces/imaginationScene'
import type { ProbeInvoke } from '../../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../../pieceProbe/handlePieceProbe'
import { pieces } from '../../pieceProbe/pieces'
import { nonRuleCellCells } from '../nonRuleCell'
import { gradeTrialRuling, renderTrialRuling, rulingContract, trialRuling, trialRulingCells } from './ruling'
import { ARGUES_CAN, ARGUES_CANNOT } from './verdict'
import { TRIAL_RULINGS, trialCases } from './trialCases'

const fence = (json: unknown): string => ['The scene says the table is small.', '', '```json', JSON.stringify(json), '```'].join('\n')

describe('the trial\'s ruling stage', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const GOLDEN = { upstream: 'golden' } as const
    const h7 = trialRulingCells['OC-30/h7']

    describe('the render', () => {
        it('is the explicit scene with the securing omitted, the request, the steps, then the question last, with nothing argued', async () => {
            const text = await renderTrialRuling(h7, GOLDEN)
            expect(text.startsWith('Scene: The Parlour\n\nFiction:\n')).toBe(true)
            expect(text).toContain('\n\nThe things:\n')
            expect(text).not.toContain('Graph:')
            expect(text).not.toContain('glued')
            expect(text).toContain('The player\'s request: I want to pour tea from [teapot1] into [cup1].')
            expect(text).toContain('- (method) tip [table1]\n  - (consequence) [saucer1] and [cup1] slide off [table1] onto the floor\n- (intended) [teapot1] pours [tea2] into [cup1]')
            expect(text.endsWith('\n\nThe question: By the time of "[teapot1] pours [tea2] into [cup1]", is [cup1] still where [teapot1] can pour into it?')).toBe(true)
            expect(text).not.toContain(ARGUES_CANNOT)
            expect(text).not.toContain(ARGUES_CAN)
            expect(text).not.toContain('The argument')
            expect(text).not.toContain(h7.inputs.against.golden!.value.argument)
            expect(text).not.toMatch(/blocking|blocks/)
        })

        it('renders every cell, its scene the explicit render of the fixture after `withoutSecuring`', async () => {
            for (const [id, cell] of Object.entries(trialRulingCells)) {
                const text = await renderTrialRuling(cell, GOLDEN)
                const scene = renderSceneExplicit(withoutSecuring(await fixtureScene(cell.inputs.fixture)))
                expect([id, text.startsWith(`${scene}\n\nThe player's request: `)]).toEqual([id, true])
                expect([id, text.endsWith(`\n\nThe question: ${cell.inputs.against.golden!.value.question}`)]).toEqual([id, true])
            }
        })

        it('refuses a lifted argument recorded under an older contract: no question, or no blocking answer', async () => {
            const { against } = h7.inputs
            const lifted = (value: object) => ({ ...h7, inputs: { ...h7.inputs, against: { ...against, lifted: { value: { step: 'tip [table1]', argument: 'It falls.', ...value }, source: 'older' } } } })
            await expect(renderTrialRuling(lifted({}), { upstream: 'lifted' })).rejects.toThrow('the lifted value doesn\'t fit the current contract: it has no question')
            await expect(renderTrialRuling(lifted({ question: 'q?' }), { upstream: 'lifted' })).rejects.toThrow('the lifted value doesn\'t fit the current contract: it names no blocking answer')
        })

        it('asks the lifted question, batch 26\'s, on every cell', async () => {
            for (const [id, cell] of Object.entries(trialRulingCells)) {
                const text = await renderTrialRuling(cell, { upstream: 'lifted' })
                expect([id, text.endsWith(`\n\nThe question: ${cell.inputs.against.lifted!.value.question}`)]).toEqual([id, true])
            }
        })

        it('refuses an argument whose step isn\'t one of the plan\'s', async () => {
            const { against } = h7.inputs
            const stray = { ...against, golden: { value: { ...against.golden!.value, step: 'juggle [table1]' } } }
            await expect(renderTrialRuling({ ...h7, inputs: { ...h7.inputs, against: stray } }, GOLDEN)).rejects.toThrow(/^The argument's step: /)
        })
    })

    describe('the grade', () => {
        it.each([
            [fence({ answer: 'yes' }), { answer: 'allows' }],
            [fence({ answer: ' No ' }), { answer: 'blocks' }],
            [fence({ answer: 'maybe' }), { malformed: '"maybe" is not one of yes, no' }],
            [fence({ ruling: 'yes' }), { malformed: 'has no string "answer"' }],
            ['The cup is on the floor.\nAnswer: no', { malformed: 'no JSON block' }],
        ])('reads the block\'s answer through the contract, then through h7\'s blocking answer (no) into the outcome: %j', async (reply, grade) => {
            expect(gradeTrialRuling(reply, h7, await renderTrialRuling(h7, GOLDEN), GOLDEN)).toEqual(grade)
        })

        it('grades a question of either polarity by the plan\'s outcome: the same answer blocks under one argument and allows under the other', async () => {
            const golden = h7.inputs.against.golden!.value
            const flipped = { ...h7, inputs: { ...h7.inputs, against: { golden: { value: { ...golden, question: 'Is [cup1] now out of [teapot1]\'s reach?', blocking: 'yes' as const } } } } }
            const yes = fence({ answer: 'yes' })
            expect(gradeTrialRuling(yes, h7, '', GOLDEN)).toEqual({ answer: 'allows' })
            expect(gradeTrialRuling(yes, flipped, '', GOLDEN)).toEqual({ answer: 'blocks' })
        })

        it('is the contract\'s parse', () => {
            expect(rulingContract.parse(fence({ answer: 'no' }), { input: {} as never, rendered: '' })).toEqual({ value: 'no' })
        })
    })

    describe('its cells', () => {
        it('are the non-rule cell\'s eleven, each with a look-for, and the expected outcomes: QS-1\'s answers (h10 yes) read through the golden blocking answers', () => {
            expect(Object.keys(trialRulingCells).sort()).toEqual(Object.keys(nonRuleCellCells).sort())
            expect(Object.fromEntries(Object.entries(trialRulingCells).map(([id, { expected }]) => [id, expected]))).toEqual({
                'OC-11': 'blocks', 'OC-18': 'blocks', 'OC-3': 'blocks',
                'OC-1': 'allows', 'OC-20': 'allows', 'OC-2': 'allows', 'OC-6': 'allows',
                'OC-30/h5': 'blocks', 'OC-30/h7': 'blocks', 'OC-30/h10': 'allows',
                'OC-9': undefined,
            })
            expect(Object.fromEntries(Object.entries(trialCases).map(([id, { expected }]) => [id, expected.ruling]))).toEqual({
                'OC-11': 'yes', 'OC-18': 'yes', 'OC-3': 'yes',
                'OC-1': 'no', 'OC-20': 'no', 'OC-2': 'no', 'OC-6': 'no',
                'OC-30/h5': 'no', 'OC-30/h7': 'no', 'OC-30/h10': 'yes',
                'OC-9': undefined,
            })
            for (const cell of Object.values(trialRulingCells)) {
                expect(cell.lookFor?.trim()).toBeTruthy()
            }
            expect(trialRulingCells['OC-30/h5'].note).toMatch(/^Read apart/)
            expect(trialRulingCells['OC-30/h10'].note).toMatch(/^Read apart/)
        })

        it('expect the non-rule cell\'s outcome wherever it expects allows or blocks; h5 alone differs, needs detail there, blocks in the scene shown (the glue omitted)', () => {
            const differ = Object.entries(trialRulingCells)
                .filter(([id, { expected }]) => expected !== undefined && !nonRuleCellCells[id].expected?.startsWith(expected))
                .map(([id]) => [id, nonRuleCellCells[id].expected])
            expect(differ).toEqual([['OC-30/h5', 'needs detail of consequences 1']])
        })

        it('grade the golden questions exactly as batches 22 and 23a did: the outcome is right when, and only when, the answer is QS-1\'s', () => {
            for (const [id, cell] of Object.entries(trialRulingCells)) {
                const expected = trialCases[id].expected.ruling
                for (const answer of TRIAL_RULINGS) {
                    const { answer: outcome } = gradeTrialRuling(fence({ answer }), cell, '', GOLDEN) as { answer: string }
                    expect([id, answer, cell.expected === undefined ? undefined : outcome === cell.expected]).toEqual([id, answer, expected === undefined ? undefined : answer === expected])
                }
            }
        })
    })

    it('is the trial\'s ruling stage, and runs through the probe on the golden questions: every cell once, at the cap, graded and tallied', async () => {
        // A stub that answers yes whenever the question asks about size.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const question = prompt.slice(prompt.lastIndexOf('The question: '))
            return { success: true as const, body: fence({ answer: question.includes('fit') ? 'yes' : 'no' }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Answer it.', options: { stage: 'ruling', ...GOLDEN }, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 400)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result).toMatchObject({ piece: 'trial', stage: 'ruling', options: GOLDEN, delivery: 'user' })
        expect(result.summary).toMatchObject({ calls: 11, malformed: 0, ungraded: 1, right: 9, wrong: 1 })
    })

    it('runs a lifted payload, graded by outcome through each lifted blocking answer', async () => {
        // Every lifted question blocks on no, so a stub answering no blocks everywhere: right on the five that block, wrong on the five that allow.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: true as const, body: fence({ answer: 'no' }) }))
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Answer it.', options: { stage: 'ruling', upstream: 'lifted' }, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(JSON.parse(response.body).summary).toMatchObject({ calls: 11, malformed: 0, ungraded: 1, right: 5, wrong: 5 })
    })

    it('has the probe refuse system delivery before any call, since it has no parts', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>()
        const system = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Answer it.', options: { stage: 'ruling', ...GOLDEN }, delivery: 'system' }, { invoke, pieces })
        expect(system.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
        expect(trialRuling.parseOptions(undefined)).toMatch(/^options must be/)
    })
})
