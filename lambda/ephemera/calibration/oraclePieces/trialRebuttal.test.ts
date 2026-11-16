import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handlePieceProbe } from '../pieceProbe/handlePieceProbe'
import { pieces } from '../pieceProbe/pieces'
import { nonRuleCellCells, renderNonRuleCell } from './nonRuleCell'
import { checkTrialRebuttal, evidenceLines, parseRebuttal, quotesALine, renderTrialRebuttal, trialRebuttal, trialRebuttalCells } from './trialRebuttal'

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
        const reply = (rebuttal: unknown) => ({ rebuttal })
        const SMALL = "Incoming argues 'the table is too heavy', but the scene says '[table1] Table (a small round tea table), in the Parlour'."

        it('draws the evidence lines from the scene and the steps only, without markers or roles', async () => {
            const lines = evidenceLines(await renderTrialRebuttal(h7, GOLDEN))
            expect(lines).toContain('In the Parlour there is [table1] Table (a small round tea table).')
            expect(lines).toContain('[table1] Table (a small round tea table), in the Parlour')
            expect(lines).toContain('tip [table1]')
            expect(lines).toContain('[saucer1] and [cup1] slide off [table1] onto the floor')
            expect(lines.some((line) => /^(Scene:|Fiction:|Graph:|```)/.test(line))).toBe(false)
            expect(lines.some((line) => line.includes('The player\'s request') || line.includes('The question the argument') || line.includes('The argument against'))).toBe(false)
        })

        describe('parses the sentence into its summary and branch', () => {
            it.each([
                [SMALL, { summary: 'the table is too heavy', source: 'the scene says', quotes: [{ source: 'the scene says', quote: '[table1] Table (a small round tea table), in the Parlour' }] }],
                ['Incoming argues "the cup falls", but the steps say "tip [table1]"', { summary: 'the cup falls', source: 'the steps say', quotes: [{ source: 'the steps say', quote: 'tip [table1]' }] }],
                ["But the scene says 'In the Parlour there is [table1] Table (a small round tea table)', which implies it is light.", { source: 'the scene says', quotes: [{ source: 'the scene says', quote: 'In the Parlour there is [table1] Table (a small round tea table)' }] }],
                ["But the scene says 'In [teapot1] there is [tea2] Tea', and the steps say '(intended) pour [tea2] from [teapot1] into [cup1]', indicating it pours.", { source: 'the scene says', quotes: [
                    { source: 'the scene says', quote: 'In [teapot1] there is [tea2] Tea' },
                    { source: 'the steps say', quote: '(intended) pour [tea2] from [teapot1] into [cup1]' },
                ] }],
                ['incoming argues ‘the tea must move first’, but common sense indicates that ‘a teapot is what tea is poured from’ is actually true.', { summary: 'the tea must move first', source: 'common sense indicates', claim: 'a teapot is what tea is poured from' }],
                ["Incoming argues 'the table is glued to the floor', but the only facts the scene and the steps establish about [table1] are: 'a small round tea table', 'On [table1] there are [saucer1] Saucer and [teapot1] Teapot.', and 'tip [table1]'", {
                    summary: 'the table is glued to the floor', source: 'the only facts', handle: '[table1]', facts: ['a small round tea table', 'On [table1] there are [saucer1] Saucer and [teapot1] Teapot.', 'tip [table1]'],
                }],
                ["Incoming argues 'the table's legs are short' but the scene says 'the table's top', so it is light.", { summary: "the table's legs are short", source: 'the scene says', quotes: [{ source: 'the scene says', quote: "the table's top" }] }],
            ])('%s', (sentence, parsed) => {
                expect(parseRebuttal(sentence)).toEqual(parsed)
            })

            it.each([
                ['The table is light.', '"rebuttal" doesn\'t open "But" or "Incoming argues \'…\', but"'],
                ["Incoming argues '', but the scene says 'x'", '"rebuttal" doesn\'t open "But" or "Incoming argues \'…\', but"'],
                ["But the scene says 'x', and the steps say nothing", '"the scene says" is not followed by a quoted line'],
                ["Incoming argues 'it is heavy', but it is not.", '"rebuttal" continues with none of "the scene says", "the steps say", "common sense indicates", "the only facts"'],
                ["Incoming argues 'it is heavy', but the scene says it is small.", '"the scene says" is not followed by a quoted line'],
                ["Incoming argues 'it is heavy', but the only facts about [table1] are: none", '"the only facts" has no quoted list'],
            ])('refuses %s', (sentence, malformed) => {
                expect(parseRebuttal(sentence)).toEqual({ malformed })
            })
        })

        describe('reads a quote with the render\'s furniture as the line (TR-P11)', () => {
            const lines = ['In the Parlour there is [table1] Table (a small round tea table).', '[table1] Table (a small round tea table), in the Parlour', '[teapot1] Teapot, on [table1]', '[saucer1] and [cup1] slide off [table1] onto the floor']
            it.each([
                'Fiction: In the Parlour there is [table1] Table (a small round tea table).',
                'consequence : [saucer1] and [cup1] slide off [table1] onto the floor',
                '(consequence) [saucer1] and [cup1] slide off [table1] onto the floor',
                'Graph: Contents of the Parlour: - [table1] Table (a small round tea table), in the Parlour  - [teapot1] Teapot, on [table1]',
                'Contents of the Parlour:\n- [table1] Table (a small round tea table), in the Parlour\n- [teapot1] Teapot, on [table1]',
                'In the Parlour there is [table1] Table (a small round tea table). [saucer1] and [cup1] slide off [table1] onto the floor.',
            ])('passes %j', (quote) => {
                expect(quotesALine(quote, lines)).toBe(true)
            })

            it('refuses an elision, and a row that isn\'t there', () => {
                expect(quotesALine('Contents of the Parlour:... - [table1] Table (a small round tea table), in the Parlour', lines)).toBe(false)
                expect(quotesALine('[table1] Table (a small round tea table), in the Parlour - [cup1] Cup, glued down', lines)).toBe(false)
            })
        })

        it.each([
            ['a quoted scene line', reply(SMALL), oc1],
            ['a common-sense claim, unchecked', reply("Incoming argues 'it is too heavy', but common sense indicates that 'a tea table is light' is actually true"), oc1],
            ['the pivot alone, the summary left to the render (TR-P12)', reply("But the scene says 'In the Parlour there is [table1] Table (a small round tea table)', which implies it is light."), oc1],
            ['two joined sources', reply("But the scene says 'You are holding nothing.', and the steps say 'pick up [table1]'"), oc1],
            ['a consequence line from the steps', reply("Incoming argues 'the cup is gone', but the steps say '[saucer1] and [cup1] slide off [table1] onto the floor'"), h7],
            ['the facts about a handle, each quoting a line naming it', reply("Incoming argues 'it is heavy', but the only facts the scene establishes about [table1] are: 'In the Parlour there is [table1] Table (a small round tea table).', 'pick up [table1]'"), oc1],
        ])('passes %s', async (_, json, cell) => {
            expect(await check(json, cell)).toEqual([])
        })

        it.each([
            [reply("Incoming argues 'it is heavy', but the scene says '[table1] is huge'"), ['"[table1] is huge" quotes no line of the scene or the steps']],
            [reply("Incoming argues 'it is heavy', but the only facts about [lamp1] are: 'You are holding nothing.'"), [
                'the facts are about [lamp1], which is not in the scene',
                '"You are holding nothing." doesn\'t name [lamp1]',
            ]],
            [reply("Incoming argues 'it is heavy', but the only facts about [table1] are: 'You are holding nothing.', '[table1] is oak'"), [
                '"You are holding nothing." doesn\'t name [table1]',
                '"[table1] is oak" quotes no line of the scene or the steps',
            ]],
            [reply("But the scene says 'You are holding nothing.', and the steps say 'lift it'"), ['"lift it" quotes no line of the scene or the steps']],
            [reply("Incoming argues 'it is heavy', but it isn't"), ['"rebuttal" continues with none of "the scene says", "the steps say", "common sense indicates", "the only facts"']],
            [reply(''), ['has no non-empty string "rebuttal"']],
            [{ answerWrong: 'x' }, ['has no non-empty string "rebuttal"']],
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
        // A stub that restates the argument and answers it from common sense.
        const invoke = jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async ({ messages }) => {
            const prompt = messages.map(({ content }) => (content ?? []).map((block) => ('text' in block ? block.text ?? '' : '')).join('')).join('')
            const argument = prompt.slice(prompt.lastIndexOf('": ') + 3)
            return { success: true as const, body: fence({ rebuttal: `Incoming argues '${argument.trim()}', but common sense indicates that 'it is not so' is actually true.` }) }
        })
        const response = await handlePieceProbe({ type: 'PieceProbe', piece: 'trialRebuttal', instructions: 'Rebut it.', options: GOLDEN, repeats: 1 }, { invoke, pieces })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(11)
        expect(invoke.mock.calls.every(([{ maxTokens }]) => maxTokens === 600)).toBe(true)
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
