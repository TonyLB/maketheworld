import type { PieceCall } from '../pieceProbe/runPieceProbe'
import { triageCells } from './triage'
import { combinedSummary, combinedText, combineTriage, ownDefer } from './triageCombine'

const fenced = (object: unknown): string => `\`\`\`json\n${JSON.stringify(object)}\n\`\`\``
const call = (cell: string, object: unknown, repeat = 1): PieceCall => ({ cell, repeat, answer: fenced(object) })

describe('the split, graded from two batches', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('counts as the branch\'s own defers the rows whose branch alone is "Defer": what the act sets off, or what it rests on', () => {
        expect(Object.keys(triageCells).filter(ownDefer)).toEqual(['T-16', 'T-20', 'T-26'])
    })

    it('runs the guard on the branch\'s kind and the grounding\'s plan, the grounding call\'s own kind set aside', async () => {
        const pairs = await combineTriage(
            [call('T-9', { kind: 'Yes' }), call('T-1', { kind: 'Yes' }), call('T-5', { kind: 'No', reason: 'Far too big.' }), call('T-2', { kind: 'Defer' })],
            [
                call('T-9', { says: 'pick up [teapot1]', kind: 'Yes' }),
                call('T-1', { says: 'pick up [cup1]', kind: 'Yes' }),
                call('T-5', { says: 'put [table1] in [cup1]', kind: 'Yes' }),
                call('T-2', { says: 'pick up [table1]', kind: 'Yes' }),
            ],
        )
        expect(pairs.map(({ cell, after }) => [cell, after])).toEqual([['T-9', 'Defer'], ['T-1', 'Yes'], ['T-5', 'No'], ['T-2', 'Defer']])
        expect(combinedSummary(pairs)).toMatchObject({
            pairs: 4,
            rightAlone: { n: 3, of: 4, cells: ['T-9', 'T-1', 'T-5'] },
            rightAsShown: { n: 2, of: 4, cells: ['T-1', 'T-5'] },
            rightAfterGuard: { n: 3, of: 4, cells: ['T-9', 'T-1', 'T-5'] },
            wrongYesAfterGuard: { n: 0 },
            wrongNo: { n: 0 },
            needlessDefers: { n: 1, of: 4, cells: ['T-2'] },
            ownDefers: { n: 0, of: 0 },
            groundingRight: { n: 3, of: 3 },
            disagreements: { n: 2, of: 4, cells: ['T-5', 'T-2'] },
        })
        expect(combinedText(pairs).split('\n')[0]).toBe('T-9, repeat 1 [Defer, alone Yes]: branch Yes; grounding teapot1 (its own kind Yes); after the guard Defer')
    })

    it('grades the branch alone where it differs from the branch as shown, and prints both', async () => {
        const pairs = await combineTriage([call('T-14', { kind: 'Yes' }), call('T-27', { kind: 'Defer' })], [
            call('T-14', { improvise: [{ handle: '[cloth1]', gloss: 'a cloth' }], says: 'wipe [table1] with [cloth1]', kind: 'Defer' }),
            call('T-27', { says: 'cut [rope1]', kind: 'Defer' }),
        ])
        expect(pairs.map(({ cell, after }) => [cell, after])).toEqual([['T-14', 'Defer'], ['T-27', 'Defer']])
        expect(combinedSummary(pairs)).toMatchObject({
            rightAlone: { n: 1, cells: ['T-14'] }, rightAsShown: { n: 1, cells: ['T-27'] }, rightAfterGuard: { n: 2 }, needlessDefers: { n: 1, of: 2, cells: ['T-27'] },
        })
        expect(combinedText(pairs).split('\n')[0]).toBe('T-14, repeat 1 [Defer, alone Yes]: branch Yes; grounding table1, improvised (its own kind Defer); after the guard Defer')
    })

    it('pairs by cell and repeat, and gives a pair with no grounding, or a refused side, no kind after the guard', async () => {
        const pairs = await combineTriage([call('T-1', { kind: 'Yes' }, 2), call('T-2', { kind: 'Sure' })], [call('T-1', { says: 'pick up [cup1]', kind: 'Yes' }), call('T-2', { says: 'pick up [table1]', kind: 'Yes' })])
        expect(pairs.map(({ after }) => after)).toEqual([undefined, undefined])
        expect(pairs[0].grounding).toEqual({ problems: ['no grounding call of this cell and repeat'] })
        expect(combinedSummary(pairs)).toMatchObject({ branchRefused: { n: 1, cells: ['T-2'] }, groundingRefused: { n: 1, cells: ['T-1'] } })
    })
})
