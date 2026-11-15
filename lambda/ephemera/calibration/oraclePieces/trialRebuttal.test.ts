import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { pieces } from '../pieceProbe/pieces'
import { nonRuleCellCells, renderNonRuleCell } from './nonRuleCell'
import { checkTrialRebuttal, evidenceLines, renderTrialRebuttal, trialRebuttal, trialRebuttalCells } from './trialRebuttal'

const fence = (json: unknown): string => ['The scene says the table is small.', '', '```json', JSON.stringify(json), '```'].join('\n')

describe('trialRebuttal', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const GOLDEN = { upstream: 'golden' } as const

    describe('the render', () => {
        it('is the non-rule cell\'s with the securing omitted, then the question, then the argument naming its step', async () => {
            const text = await renderTrialRebuttal(trialRebuttalCells['OC-1'], GOLDEN)
            expect(text).toBe([
                await renderNonRuleCell(nonRuleCellCells['OC-1'], { securing: 'omitted' }),
                'The question the argument answers: Is [table1] too large and heavy to be picked up by a single person?',
                'The argument against the plan, turning on the step "pick up [table1]": The table is too large and heavy to be picked up by a single person.',
            ].join('\n\n'))
            expect(text).not.toContain('glued')
        })

        it('refuses a lifted argument, recorded under the older contract with no question', async () => {
            await expect(renderTrialRebuttal(trialRebuttalCells['OC-1'], { upstream: 'lifted' })).rejects.toThrow('the lifted value doesn\'t fit the current contract: it has no question')
        })

        it('refuses a cell with no value from the named source', async () => {
            const cell = trialRebuttalCells['OC-1']
            const { golden } = cell.inputs.against
            await expect(renderTrialRebuttal({ ...cell, inputs: { ...cell.inputs, against: { golden } } }, { upstream: 'lifted' })).rejects.toThrow('no lifted value for this cell')
        })

        it.each([
            [{ step: 'the glue', argument: 'x', question: 'q?' }, 'The argument\'s step: "the glue" quotes nothing given'],
            [{ step: 'pick up [table1]', argument: ' ', question: 'q?' }, 'No argument'],
        ])('refuses an argument that isn\'t fit to use: %j', async (value, message) => {
            const cell = trialRebuttalCells['OC-1']
            await expect(renderTrialRebuttal({ ...cell, inputs: { ...cell.inputs, against: { golden: { value } } } }, GOLDEN)).rejects.toThrow(message)
        })
    })

    describe('its cells', () => {
        it('are the non-rule cell\'s eleven, each golden argument the lifted one adopted verbatim with a question, and render', async () => {
            expect(Object.keys(trialRebuttalCells).sort()).toEqual(Object.keys(nonRuleCellCells).sort())
            for (const [id, cell] of Object.entries(trialRebuttalCells)) {
                const { golden, lifted } = cell.inputs.against
                expect(cell.inputs.steps).toBe(nonRuleCellCells[id].inputs.steps)
                expect(lifted?.source).toMatch(/^trialAgainst batch [12] /)
                expect(golden?.value).toEqual({ ...lifted?.value, question: expect.stringMatching(/\?$/) })
                expect(cell.lookFor.trim()).not.toBe('')
                await expect(trialRebuttal.render(cell, GOLDEN)).resolves.toContain(golden?.value.question)
            }
        })

        it('asks the hops about the state at the step that fails, the pour', () => {
            for (const id of ['OC-30/h5', 'OC-30/h7', 'OC-30/h10']) {
                expect(trialRebuttalCells[id].inputs.against.golden?.value.question).toMatch(/^By the time of "\[teapot1\] pours \[tea2\] into \[cup1\]", is /)
            }
        })

        it('marks the two consequences-dependent hops to be read apart', () => {
            expect(Object.entries(trialRebuttalCells).filter(([, { note }]) => note !== undefined).map(([id]) => id)).toEqual(['OC-30/h5', 'OC-30/h10'])
        })
    })

    describe('the check', () => {
        const oc1 = trialRebuttalCells['OC-1']
        const h7 = trialRebuttalCells['OC-30/h7']
        const check = async (json: unknown, cell = oc1) => checkTrialRebuttal(fence(json), cell, await renderTrialRebuttal(cell, GOLDEN))
        const reply = (fields: Record<string, unknown> = {}) => ({
            claim: 'too large and heavy', evidence: '[table1] Table (a small round tea table)', kind: 'wrong', rebuttal: 'The table is small.', ...fields,
        })

        it('draws the evidence lines from the scene and the steps only, without markers or roles', async () => {
            const lines = evidenceLines(await renderTrialRebuttal(h7, GOLDEN))
            expect(lines).toContain('In the Parlour there is [table1] Table (a small round tea table).')
            expect(lines).toContain('[table1] Table (a small round tea table), in the Parlour')
            expect(lines).toContain('tip [table1]')
            expect(lines).toContain('[saucer1] and [cup1] slide off [table1] onto the floor')
            expect(lines.some((line) => /^(Scene:|Fiction:|Graph:|```)/.test(line))).toBe(false)
            expect(lines.some((line) => line.includes('The player\'s request') || line.includes('The question the argument') || line.includes('The argument against'))).toBe(false)
        })

        it.each([
            ['a quoted claim and scene line', reply(), oc1],
            ['"none" as evidence, any case', reply({ evidence: ' None ', kind: 'invented' }), oc1],
            ['a part of a scene sentence, and the kind in another case', reply({ evidence: 'a small round tea table', kind: ' Not Established ' }), oc1],
            ['a consequence line as evidence', reply({ claim: 'cause the cup to fall off the table', evidence: '[saucer1] and [cup1] slide off [table1] onto the floor', kind: 'wrong' }), h7],
            ['a step as evidence', reply({ claim: 'The first step', evidence: 'tip [table1]' }), h7],
            ['a line quoted with its role label, as the prompt shows it (TR-P5)', reply({ claim: 'cause the cup to fall off the table', evidence: '(consequence) [saucer1] and [cup1] slide off [table1] onto the floor' }), h7],
            ['a step quoted with its marker and role', reply({ claim: 'The first step', evidence: '- (method) tip [table1]' }), h7],
        ])('passes %s', async (_, json, cell) => {
            expect(await check(json, cell)).toEqual([])
        })

        it.each([
            [reply({ claim: 'the glue holds it' }), ['"claim" "the glue holds it" is not quoted from the argument']],
            [reply({ evidence: '[table1] is huge' }), ['"evidence" "[table1] is huge" quotes no line of the scene or the steps']],
            [reply({ evidence: 'I want to pick up [table1].' }), ['"evidence" "I want to pick up [table1]." quotes no line of the scene or the steps']],
            [reply({ evidence: 'Is [table1] too large and heavy to be picked up by a single person?' }), ['"evidence" "Is [table1] too large and heavy to be picked up by a single person?" quotes no line of the scene or the steps']],
            [reply({ claim: undefined, evidence: '' }), ['has no non-empty string "claim"', 'has no non-empty string "evidence"']],
            [reply({ kind: 'concede' }), ['"kind" is "concede", not one of invented, not established, wrong']],
            [reply({ rebuttal: '' }), ['has no non-empty string "rebuttal"']],
        ])('lists every form problem: %j', async (json, problems) => {
            expect(await check(json)).toEqual(problems)
        })

        it('flags a reply with no block', async () => {
            expect(checkTrialRebuttal('It is wrong.', oc1, await renderTrialRebuttal(oc1, GOLDEN))).toEqual(['no JSON block'])
        })
    })

    it('takes the upstream option, named in every payload', () => {
        expect(trialRebuttal.parseOptions({ upstream: 'golden' })).toEqual({ upstream: 'golden' })
        expect(trialRebuttal.parseOptions(undefined)).toMatch(/^options must be/)
    })

    it('is registered, and runs through the probe: every cell once, at the cap, each reply form-checked', async () => {
        // A stub that claims the argument's first word and gives no evidence.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const argument = prompt.slice(prompt.lastIndexOf('": ') + 3)
            return { success: true as const, body: fence({ claim: argument.split(' ')[0], evidence: 'none', kind: 'invented', rebuttal: 'No.' }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trialRebuttal', instructions: 'Rebut it.', options: GOLDEN, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 400)).toBe(true)
        expect(JSON.parse(response.body).summary).toEqual({ calls: 11, formFails: 0, errors: 0 })
    })

    it('has the probe refuse a lifted payload before any call, since no lifted argument has a question yet', async () => {
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>()
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trialRebuttal', instructions: 'Rebut it.', options: { upstream: 'lifted' } }, { invoke, pieces })
        expect(response.statusCode).toBe(400)
        expect(JSON.parse(response.body).error).toMatch(/the render failed \(the lifted value doesn't fit the current contract: it has no question\)/)
        expect(invoke).not.toHaveBeenCalled()
    })
})
