import { renderTriage, triageCells } from './triage'
import { gradeTriageBranch, renderTriageBranch, triageBranch, triageBranchCells, triageBranchContract } from './triageBranch'

const fenced = (object: unknown): string => `\`\`\`json\n${JSON.stringify(object)}\n\`\`\``
const shown = { input: triageCells['T-1'].inputs, rendered: '' }

describe('triage\'s branch alone', () => {
    it('reads the kind, in any case, and the reason on "No" alone', () => {
        expect(triageBranchContract.parse(fenced({ kind: 'yes' }), shown)).toEqual({ value: { kind: 'Yes' } })
        expect(triageBranchContract.parse(fenced({ kind: 'Defer', reason: 'dropped' }), shown)).toEqual({ value: { kind: 'Defer' } })
        expect(triageBranchContract.parse(fenced({ kind: 'No', reason: ' Far too heavy. ' }), shown)).toEqual({ value: { kind: 'No', reason: 'Far too heavy.' } })
    })

    it('refuses a "No" with no reason, an unknown kind, no block, and anything written beside the verdict', () => {
        expect(triageBranchContract.parse(fenced({ kind: 'No' }), shown)).toEqual({ problems: ['"No" has no non-empty string "reason"'] })
        expect(triageBranchContract.parse(fenced({ kind: 'Maybe' }), shown)).toEqual({ problems: ['kind "Maybe" is not one of No, Yes, Defer'] })
        expect(triageBranchContract.parse('Yes', shown)).toEqual({ problems: ['no JSON block'] })
        expect(triageBranchContract.parse(fenced({ says: 'lift [table1]', kind: 'Yes' }), shown)).toEqual({ problems: ['has "says", beside "kind" and "reason"'] })
    })

    it('grades the kind as given, or the form problems', () => {
        expect(gradeTriageBranch(fenced({ kind: 'Defer' }), triageBranchCells['T-9'], '')).toEqual({ answer: 'Defer' })
        expect(gradeTriageBranch(fenced({ kind: 'No' }), triageBranchCells['T-9'], '')).toEqual({ malformed: '"No" has no non-empty string "reason"' })
    })

    it('takes triage\'s cells and inputs, and no aspect, since the guard\'s kind and the grounding are the combination\'s', () => {
        expect(Object.keys(triageBranchCells)).toEqual(Object.keys(triageCells))
        expect(Object.values(triageBranchCells).filter((cell) => 'expectedAspects' in cell)).toEqual([])
        expect(Object.entries(triageBranchCells).map(([id, { inputs }]) => [id, inputs])).toEqual(Object.entries(triageCells).map(([id, { inputs }]) => [id, inputs]))
    })

    it('expects the branch alone: as shown, but "Yes" where the "Defer" is the guard\'s, on what the scene lacks, which thing is meant, or a securing', () => {
        const differs = Object.keys(triageCells).filter((id) => triageBranchCells[id].expected !== triageCells[id].expected)
        expect(differs).toEqual(['T-9', 'T-10', 'T-11', 'T-12', 'T-13', 'T-14', 'T-22', 'T-24', 'T-25', 'T-27'])
        expect(differs.map((id) => [triageCells[id].expected, triageBranchCells[id].expected])).toEqual(differs.map(() => ['Defer', 'Yes']))
    })

    describe('its wording', () => {
        beforeEach(() => {
            jest.spyOn(console, 'log').mockImplementation(() => {})
            jest.spyOn(console, 'info').mockImplementation(() => {})
        })
        afterEach(() => jest.restoreAllMocks())

        it('takes no options, or a scene arm of its own wording', () => {
            expect(triageBranch.parseOptions(undefined)).toEqual({ scene: 'conditions' })
            expect(triageBranch.parseOptions({ scene: 'carry' })).toEqual({ scene: 'carry' })
            expect(triageBranch.parseOptions({ scene: 'hostTakes' })).toEqual({ scene: 'hostTakes' })
            expect(triageBranch.parseOptions({ scene: 'judge' })).toBe("triageBranch's options must be { scene?: 'conditions' | 'carry' | 'hostTakes' }")
            expect(triageBranch.parseOptions({ scene: 'carry', more: 1 })).toBe("triageBranch's options must be { scene?: 'conditions' | 'carry' | 'hostTakes' }")
        })

        it('renders as triage by default, and under carry states what each securing lets things do, and nothing it forbids', async () => {
            const cell = triageBranchCells['T-12']
            expect(await renderTriageBranch(cell, { scene: 'conditions' })).toBe(await renderTriage(cell))
            const carried = await renderTriageBranch(cell, { scene: 'carry' })
            expect(carried).toContain('[table1] is chained to [wall1]. When [wall1] moves, [table1] goes with it.')
            expect(carried).toContain('[teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped.')
            expect(carried).not.toMatch(/violation|as usual|\(rule /)
        })

        it('under hostTakes states each securing on its taker\'s line, as what moving the taker does, with no fact word', async () => {
            const taken = await renderTriageBranch(triageBranchCells['T-12'], { scene: 'hostTakes' })
            expect(taken).toContain('[wall1] takes [table1] with it, however [wall1] is moved.')
            expect(taken).toContain('[table1] takes [teapot1] with it, however [table1] is moved.')
            expect(taken).not.toMatch(/glued|chained|bolted|wired|tied|violation|\(rule /)
        })
    })
})
