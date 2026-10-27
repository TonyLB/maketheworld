import { osaStep } from './osaStep'

/** A cost table where every cell costs 9 except those listed, keyed `i,j`. */
const costs = (cells: Record<string, number>) => (i: number, j: number): number => cells[`${i},${j}`] ?? 9

describe('osaStep', () => {
    it('pairs equal characters as a match', () => {
        expect(osaStep(costs({ '0,0': 0 }), 'a', 'a', 1, 1)).toEqual({ cost: 0, op: 'match', from: { i: 0, j: 0 } })
    })

    it('pairs unequal characters as a substitution', () => {
        expect(osaStep(costs({ '0,0': 0 }), 'a', 'b', 1, 1)).toEqual({ cost: 1, op: 'substitute', from: { i: 0, j: 0 } })
    })

    it('takes a character of a alone as a delete', () => {
        expect(osaStep(costs({ '1,1': 0 }), 'ab', 'a', 2, 1)).toEqual({ cost: 1, op: 'delete', from: { i: 1, j: 1 } })
    })

    it('takes a character of b alone as an insert', () => {
        expect(osaStep(costs({ '1,1': 0 }), 'a', 'ab', 1, 2)).toEqual({ cost: 1, op: 'insert', from: { i: 1, j: 1 } })
    })

    it('pairs two swapped characters as a transposition', () => {
        expect(osaStep(costs({ '0,0': 0 }), 'ab', 'ba', 2, 2)).toEqual({ cost: 1, op: 'transpose', from: { i: 0, j: 0 } })
    })

    it('breaks a tie in the order diagonal, delete, insert, transpose', () => {
        expect(osaStep(costs({ '0,0': 0, '0,1': 0, '1,0': 0 }), 'a', 'b', 1, 1).op).toBe('substitute')
        expect(osaStep(costs({ '0,1': 0, '1,0': 0 }), 'a', 'b', 1, 1).op).toBe('delete')
        expect(osaStep(costs({ '0,0': 0, '1,1': 0 }), 'ab', 'ba', 2, 2).op).toBe('substitute')
    })

    it('prices each step as the step cost says', () => {
        const spacesCostHalf = (op: string) => (op === 'match' ? 0 : op === 'delete' ? 0.5 : 3)
        expect(osaStep(costs({ '0,0': 0, '1,1': 0 }), 'a ', 'a', 2, 1, spacesCostHalf)).toEqual({ cost: 0.5, op: 'delete', from: { i: 1, j: 1 } })
        expect(osaStep(costs({ '0,0': 0 }), 'a', 'b', 1, 1, spacesCostHalf).cost).toBe(3)
    })
})
