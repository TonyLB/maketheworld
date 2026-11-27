import { renderTriage, triageCells } from './triage'
import { triageCorpus } from './triageCorpus'
import {
    gradeTriageGrounding, renderTriageGrounding, triageGrounding, triageGroundingCells, triageGroundingContract,
} from './triageGrounding'

const fenced = (object: unknown): string => `Named: [table1].\nNeeds: only named items.\n\n\`\`\`json\n${JSON.stringify(object)}\n\`\`\``

describe('triage\'s grounding alone', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const shownOf = async (id: string) => ({ input: triageGroundingCells[id].inputs, rendered: await renderTriageGrounding(triageGroundingCells[id]) })

    describe('its contract', () => {
        it('reads what the act matched and the step record, merged as triage merges them, with no verdict', async () => {
            const parsed = triageGroundingContract.parse(fenced({ matched: ['[cup1 | cup2]'], says: 'pick up [cup1 | cup2]' }), await shownOf('T-24'))
            expect(parsed).toMatchObject({ value: { involved: ['[cup1 | cup2]'], plan: { steps: [{ says: 'pick up [cup1 | cup2]' }] } } })
        })

        it('refuses a verdict leaking back, a "kind" or a "reason", as any key the record doesn\'t take', async () => {
            const shown = await shownOf('T-2')
            expect(triageGroundingContract.parse(fenced({ says: 'pick up [table1]', kind: 'Yes' }), shown)).toEqual({ problems: [expect.stringContaining('"kind"')] })
            expect(triageGroundingContract.parse(fenced({ says: 'pick up [table1]', reason: 'it is light' }), shown)).toEqual({ problems: [expect.stringContaining('"reason"')] })
        })

        it('refuses a handle the scene doesn\'t have and nothing improvised', async () => {
            expect(triageGroundingContract.parse(fenced({ says: 'wipe [table1] with [cloth1]' }), await shownOf('T-14'))).toEqual({ problems: ['[cloth1] is not in the scene, and not improvised'] })
        })
    })

    describe('its one shape, flat', () => {
        it('reads the lists beside "says", "matched" read as triage reads a match\'s "inScene"', async () => {
            const read = triageGroundingContract.parse(fenced({ matched: ['[table1]'], improvised: [{ handle: '[cloth1]', gloss: 'a cloth' }], assumes: ['it is dry'], says: 'wipe [table1] with [cloth1]' }), await shownOf('T-14'))
            expect(read).toMatchObject({ value: { involved: ['[table1]', '[cloth1]'], assumes: ['it is dry'], plan: { improvised: [{ handle: 'cloth1' }] } } })
        })

        it('reads a block with no lists as the record alone, nothing involved', async () => {
            expect(triageGroundingContract.parse(fenced({ says: 'pick up [table1]' }), await shownOf('T-2'))).toMatchObject({ value: { plan: { steps: [{ says: 'pick up [table1]' }] } } })
            expect(triageGroundingContract.parse(fenced({ says: 'pick up [table1]' }), await shownOf('T-2'))).not.toHaveProperty('value.involved')
        })

        it('refuses a second shape or name for one thing: a nested "match", an "inScene", or the record\'s own "improvise"', async () => {
            const shown = await shownOf('T-14')
            expect(triageGroundingContract.parse(fenced({ match: { inScene: ['[table1]'] }, says: 'wipe [table1]' }), shown)).toEqual({ problems: ['the block is flat: no "match"; "matched", "improvised" and "assumes" go beside "says"'] })
            expect(triageGroundingContract.parse(fenced({ inScene: ['[table1]'], says: 'wipe [table1]' }), shown)).toEqual({ problems: ['the things the act matches in the scene go in "matched"'] })
            expect(triageGroundingContract.parse(fenced({ matched: ['[table1]'], improvise: [{ handle: '[cloth1]', gloss: 'a cloth' }], says: 'wipe [table1] with [cloth1]' }), shown)).toEqual({ problems: ['improvised things go in "improvised"'] })
        })
    })

    describe('its grade', () => {
        it('gives the grounding as the answer, with what the match found and the words added beside it', async () => {
            const { rendered } = await shownOf('T-28')
            const grade = gradeTriageGrounding(fenced({ matched: ['[coffee1]', '[spoon1]'], says: 'stir [coffee1] with [spoon1]' }), triageGroundingCells['T-28'], rendered)
            expect(grade).toMatchObject({ answer: 'coffee1, spoon1', aspects: { matched: 'coffee1, spoon1', added: 'none' } })
        })

        it('tallies what the match assumes, joined and trimmed, or none, beside a grounding graded as before', async () => {
            const { rendered } = await shownOf('T-22')
            const assuming = gradeTriageGrounding(fenced({ matched: ['[candle1]', '[hammer1]'], assumes: [' [hammer1] has a sharp end ', 'the wick is long'], says: 'trim the wick of [candle1] with [hammer1]' }), triageGroundingCells['T-22'], rendered)
            expect(assuming).toMatchObject({ answer: 'candle1, hammer1', aspects: { assumes: '[hammer1] has a sharp end; the wick is long' } })
            const bare = gradeTriageGrounding(fenced({ matched: ['[candle1]'], says: 'trim the wick of [candle1]' }), triageGroundingCells['T-22'], rendered)
            expect(bare).toMatchObject({ aspects: { assumes: 'none' } })
            const empty = gradeTriageGrounding(fenced({ matched: ['[candle1]'], assumes: [], says: 'trim the wick of [candle1]' }), triageGroundingCells['T-22'], rendered)
            expect(empty).toMatchObject({ aspects: { assumes: 'none' } })
        })

        it('grades every row right on each of its own accepted groundings', async () => {
            const wrong = (await Promise.all(Object.entries(triageCorpus).flatMap(([id, { grounded }]) => grounded.map(async ({ says, improvise }) => {
                const { rendered } = await shownOf(id)
                const grade = gradeTriageGrounding(fenced({ says, ...(improvise === undefined ? {} : { improvised: improvise }) }), triageGroundingCells[id], rendered)
                const expected = triageGroundingCells[id].expected
                return 'answer' in grade && Array.isArray(expected) && expected.includes(grade.answer) ? [] : [`${id}: ${says}`]
            })))).flat()
            expect(wrong).toEqual([])
        })

        it('grades an over-named stir wrong, and the cutlery joined', async () => {
            const { rendered } = await shownOf('T-28')
            const answerOf = (says: string) => {
                const grade = gradeTriageGrounding(fenced({ says }), triageGroundingCells['T-28'], rendered)
                return 'answer' in grade ? grade.answer : grade.malformed
            }
            const accepted = triageGroundingCells['T-28'].expected
            expect(accepted).toEqual(['coffee1, spoon1'])
            expect([answerOf('stir [coffee1] in [mug1] with [spoon1]'), answerOf('stir [coffee1] with [fork1 | knife1 | spoon1]')]).toEqual(['coffee1, mug1, spoon1', 'coffee1, fork1|knife1|spoon1'])
        })
    })

    describe('its cells', () => {
        it('are triage\'s, each expecting the row\'s accepted groundings, on every row, "No" and open ones too, and no aspect', () => {
            expect(Object.keys(triageGroundingCells)).toEqual(Object.keys(triageCells))
            expect(Object.entries(triageGroundingCells).map(([id, { inputs }]) => [id, inputs])).toEqual(Object.entries(triageCells).map(([id, { inputs }]) => [id, inputs]))
            expect(Object.values(triageGroundingCells).filter((cell) => cell.expected === undefined || 'expectedAspects' in cell)).toEqual([])
            expect(triageGroundingCells['T-5'].expected).toEqual(['cup1, table1'])
            expect(triageGroundingCells['T-7'].expected).toEqual(['cup1, table1', 'cup1, table1, improvised'])
            expect(triageGroundingCells['T-21'].expected).toEqual(['candle1, improvised', 'candle1'])
            expect(triageGroundingCells['T-25'].expected).toEqual(['cup1, tea2, teapot1', 'tea2, teapot1', 'tea1|tea2'])
        })
    })

    describe('its view', () => {
        it('shows the scene without its securing, and is triage\'s render where the scene has none', async () => {
            const chained = await renderTriageGrounding(triageGroundingCells['T-12'])
            expect(chained).not.toMatch(/glued|chained|rule|cannot/)
            expect(chained).toContain('[teapot1] Teapot is on [table1].')
            expect(await renderTriageGrounding(triageGroundingCells['T-28'])).toBe(await renderTriage(triageCells['T-28']))
        })

        it('takes no options', () => {
            expect(triageGrounding.parseOptions(undefined)).toBeUndefined()
            expect(triageGrounding.parseOptions({ block: 'flat' })).toBe('triageGrounding takes no options')
        })
    })
})
