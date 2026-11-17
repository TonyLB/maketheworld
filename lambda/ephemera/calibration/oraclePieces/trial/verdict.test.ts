import type { ProbeInvoke } from '../../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../../pieceProbe/handlePieceProbe'
import { pieces } from '../../pieceProbe/pieces'
import { stageValueHash } from '../../pieceProbe/stageInput'
import { nonRuleCellCells } from '../nonRuleCell'
import { joinParts } from '../../pieceProbe/oraclePiece'
import { rebuttalContract, renderArguedParts, renderTrialRebuttal, trialRebuttalCells } from './rebuttal'
import { trialCases } from './trialCases'
import { gradeTrialVerdict, judgedPair, renderTrialVerdict, renderTrialVerdictParts, trialVerdict, trialVerdictCells, verdictContract } from './verdict'

const fence = (json: unknown): string => ['The scene says the table is small.', '', '```json', JSON.stringify(json), '```'].join('\n')

describe('the trial\'s verdict stage', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const LIFTED = { upstream: 'lifted' } as const
    const oc1 = trialVerdictCells['OC-1']

    describe('the records\' lifted rebuttals', () => {
        it('are batch 8\'s, one per cell, each recording the golden argument it answered', () => {
            for (const [id, { against, rebuttal }] of Object.entries(trialCases)) {
                expect(rebuttal.golden).toBeUndefined()
                expect(rebuttal.lifted?.source).toMatch(new RegExp(`^trialRebuttal batch 8 .*, repeat [12], cell ${id.replace('/', '\\/')}$`))
                expect(rebuttal.lifted?.consumed).toEqual({ upstream: 'golden', hash: stageValueHash(against.golden?.value) })
            }
        })

        it('each pass the rebuttal\'s full contract parse against the render they answered', async () => {
            for (const [id, { rebuttal }] of Object.entries(trialCases)) {
                const cell = trialRebuttalCells[id]
                const rendered = await renderTrialRebuttal(cell, { upstream: 'golden' })
                const parsed = rebuttalContract.parse(fence({ rebuttal: rebuttal.lifted?.value.rebuttal }), { input: { ...cell.inputs, argument: cell.inputs.against.golden!.value }, rendered })
                expect([id, parsed]).toEqual([id, { value: rebuttal.lifted?.value }])
            }
        })
    })

    describe('the render', () => {
        it('is the rebuttal\'s scene and question, then the argument the rebuttal answered and the rebuttal, each in its side\'s tag', async () => {
            const text = await renderTrialVerdict(oc1, LIFTED)
            const rebuttalRender = await renderTrialRebuttal(trialRebuttalCells['OC-1'], { upstream: 'golden' })
            const argumentLine = 'The argument against the plan, turning on the step "pick up [table1]": The table is too large and heavy to be picked up by a single person.'
            expect(rebuttalRender.endsWith(`\n\n${argumentLine}`)).toBe(true)
            expect(text).toBe([
                rebuttalRender.slice(0, -argumentLine.length),
                '<argues-plan-cannot-happen>\n', argumentLine, '\n</argues-plan-cannot-happen>\n',
                '<argues-plan-can-happen>\nThe rebuttal: ', trialCases['OC-1'].rebuttal.lifted?.value.rebuttal, '\n</argues-plan-can-happen>',
            ].join(''))
            expect(text).toContain('The question the argument answers: Is [table1] too large and heavy to be picked up by a single person?\n\n<argues-plan-cannot-happen>')
            expect(text).not.toContain('glued')
        })

        it('is its two parts joined, for every cell: the scene, request and steps as the system part, and the question onward as the user part', async () => {
            for (const [id, cell] of Object.entries(trialVerdictCells)) {
                const parts = await renderTrialVerdictParts(cell, LIFTED)
                const argued = await renderArguedParts(cell, judgedPair(cell, LIFTED).argument)
                expect([id, await renderTrialVerdict(cell, LIFTED)]).toEqual([id, joinParts(parts)])
                expect([id, parts.system]).toEqual([id, argued.scene])
                expect([id, parts.user.startsWith(`${argued.question}\n\n<argues-plan-cannot-happen>\n`)]).toEqual([id, true])
            }
            expect((await renderTrialVerdictParts(oc1, LIFTED)).user.startsWith('The question the argument answers: ')).toBe(true)
        })

        it('refuses golden, since no golden rebuttal is written yet', async () => {
            await expect(renderTrialVerdict(oc1, { upstream: 'golden' })).rejects.toThrow('no golden value for this cell')
        })

        it('breaks loudly when the argument the rebuttal answered was edited since', async () => {
            const { against } = oc1.inputs
            const edited = { ...against, golden: { value: { ...against.golden!.value, argument: 'The table is heavy.' } } }
            await expect(renderTrialVerdict({ ...oc1, inputs: { ...oc1.inputs, against: edited } }, LIFTED)).rejects.toThrow(/answered a different golden value/)
        })
    })

    describe('the grade', () => {
        it.each([
            [fence({ answer: 'argument' }), { answer: 'argument' }],
            [fence({ answer: ' Rebuttal ' }), { answer: 'rebuttal' }],
            [fence({ answer: 'both' }), { malformed: '"both" is not one of argument, rebuttal' }],
            [fence({ verdict: 'argument' }), { malformed: 'has no string "answer"' }],
            ['The rebuttal is right.\nAnswer: rebuttal', { malformed: 'no JSON block' }],
        ])('reads the block\'s answer through the contract: %j', async (reply, grade) => {
            expect(gradeTrialVerdict(reply, oc1, await renderTrialVerdict(oc1, LIFTED), LIFTED)).toEqual(grade)
        })

        it('is the contract\'s parse', () => {
            expect(verdictContract.parse(fence({ answer: 'argument' }), { input: {} as never, rendered: '' })).toEqual({ value: 'argument' })
        })
    })

    describe('its cells', () => {
        it('are the non-rule cell\'s eleven, each with both upstream stages, a look-for, and the expected answers of Slice B\'s design, h10 revised for verdict draft 2', () => {
            expect(Object.keys(trialVerdictCells).sort()).toEqual(Object.keys(nonRuleCellCells).sort())
            expect(Object.fromEntries(Object.entries(trialVerdictCells).map(([id, { expected }]) => [id, expected]))).toEqual({
                'OC-11': 'argument', 'OC-18': 'argument', 'OC-3': 'argument', 'OC-30/h7': 'argument', 'OC-30/h5': 'argument', 'OC-30/h10': 'argument',
                'OC-1': 'rebuttal', 'OC-2': 'rebuttal', 'OC-20': 'rebuttal', 'OC-6': 'rebuttal',
                'OC-9': undefined,
            })
            for (const cell of Object.values(trialVerdictCells)) {
                expect(cell.lookFor?.trim()).toBeTruthy()
            }
            expect(trialVerdictCells['OC-30/h5'].note).toMatch(/^Read apart/)
            expect(trialVerdictCells['OC-30/h10'].note).toMatch(/^Read apart/)
        })
    })

    it('is the trial\'s verdict stage, and runs through the probe on lifted pairs: every cell once, at the cap, graded and tallied', async () => {
        // A stub that sides with the rebuttal whenever it quotes "small round tea table".
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const rebuttal = prompt.slice(prompt.lastIndexOf('<argues-plan-can-happen>'))
            return { success: true as const, body: fence({ answer: rebuttal.includes('small round tea table') ? 'rebuttal' : 'argument' }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Judge it.', options: { stage: 'verdict', ...LIFTED }, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 400)).toBe(true)
        const result = JSON.parse(response.body)
        expect(result).toMatchObject({ piece: 'trial', stage: 'verdict', options: LIFTED })
        expect(result.summary).toMatchObject({ calls: 11, malformed: 0, ungraded: 1 })
        expect(result.summary.right + result.summary.wrong).toBe(10)
    })

    it('has the probe refuse a golden payload before any call', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>()
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trial', instructions: 'Judge it.', options: { stage: 'verdict', upstream: 'golden' } }, { invoke, pieces })
        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.body).error).toMatch(/the render failed \(no golden value for this cell\)/)
        expect(invoke).not.toHaveBeenCalled()
        expect(trialVerdict.parseOptions(undefined)).toMatch(/^options must be/)
    })
})
