import { renderSceneExplicit } from '../../../dataSource/actions/sceneProse/renderSceneExplicit'
import { withoutSecuring } from '../../../dataSource/actions/sceneProse/sceneRules'
import { fixtureScene } from '../../imaginationPieces/imaginationScene'
import type { ProbeInvoke } from '../../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../../pieceProbe/handlePieceProbe'
import { pieces } from '../../pieceProbe/pieces'
import { nonRuleCellCells } from '../nonRuleCell'
import { gradeTrialRuling, renderTrialRuling, rulingContract, trialRuling, trialRulingCells } from './ruling'
import { ARGUES_CAN, ARGUES_CANNOT } from './verdict'

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
        })

        it('renders every cell, its scene the explicit render of the fixture after `withoutSecuring`', async () => {
            for (const [id, cell] of Object.entries(trialRulingCells)) {
                const text = await renderTrialRuling(cell, GOLDEN)
                const scene = renderSceneExplicit(withoutSecuring(await fixtureScene(cell.inputs.fixture)))
                expect([id, text.startsWith(`${scene}\n\nThe player's request: `)]).toEqual([id, true])
                expect([id, text.endsWith(`\n\nThe question: ${cell.inputs.against.golden!.value.question}`)]).toEqual([id, true])
            }
        })

        it('refuses lifted, whose arguments have no question (the older contract)', async () => {
            await expect(renderTrialRuling(h7, { upstream: 'lifted' })).rejects.toThrow('the lifted value doesn\'t fit the current contract: it has no question')
        })

        it('refuses an argument whose step isn\'t one of the plan\'s', async () => {
            const { against } = h7.inputs
            const stray = { ...against, golden: { value: { ...against.golden!.value, step: 'juggle [table1]' } } }
            await expect(renderTrialRuling({ ...h7, inputs: { ...h7.inputs, against: stray } }, GOLDEN)).rejects.toThrow(/^The argument's step: /)
        })
    })

    describe('the grade', () => {
        it.each([
            [fence({ answer: 'yes' }), { answer: 'yes' }],
            [fence({ answer: ' No ' }), { answer: 'no' }],
            [fence({ answer: 'maybe' }), { malformed: '"maybe" is not one of yes, no' }],
            [fence({ ruling: 'yes' }), { malformed: 'has no string "answer"' }],
            ['The cup is on the floor.\nAnswer: no', { malformed: 'no JSON block' }],
        ])('reads the block\'s answer through the contract: %j', async (reply, grade) => {
            expect(gradeTrialRuling(reply, h7, await renderTrialRuling(h7, GOLDEN), GOLDEN)).toEqual(grade)
        })

        it('is the contract\'s parse', () => {
            expect(rulingContract.parse(fence({ answer: 'no' }), { input: {} as never, rendered: '' })).toEqual({ value: 'no' })
        })
    })

    describe('its cells', () => {
        it('are the non-rule cell\'s eleven, each with a look-for, and the expected answers of QS-1, h10 yes', () => {
            expect(Object.keys(trialRulingCells).sort()).toEqual(Object.keys(nonRuleCellCells).sort())
            expect(Object.fromEntries(Object.entries(trialRulingCells).map(([id, { expected }]) => [id, expected]))).toEqual({
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

    it('has the probe refuse a lifted payload before any call, and system delivery, since it has no parts', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>()
        const lifted = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Answer it.', options: { stage: 'ruling', upstream: 'lifted' } }, { invoke, pieces })
        expect(lifted.statusCode).toBe(400)
        expect(JSON.parse(lifted.body).error).toMatch(/the render failed \(the lifted value doesn't fit the current contract: it has no question\)/)
        const system = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Answer it.', options: { stage: 'ruling', ...GOLDEN }, delivery: 'system' }, { invoke, pieces })
        expect(system.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
        expect(trialRuling.parseOptions(undefined)).toMatch(/^options must be/)
    })
})
