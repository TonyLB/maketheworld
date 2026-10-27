/**
 * The OSA (restricted Damerau-Levenshtein) step: the cheapest way into one cell of an alignment
 * table of string a against string b. Shared by the aligners built on it
 * (`sellersApproximateSubstringMatch`), which differ only in their boundary rows and in how they
 * read the table's last row.
 */

/**
 * One step of the alignment, left to right: `match` and `substitute` pair a character of a with
 * one of b, `insert` is a character of b only, `delete` a character of a only, and `transpose`
 * pairs two characters of each, swapped.
 */
export type AlignmentOp = 'match' | 'substitute' | 'insert' | 'delete' | 'transpose'

/** The cheapest step into a cell: its total cost, its op, and the cell it came from. */
export type OsaStep = {
    cost: number
    op: AlignmentOp
    from: { i: number; j: number }
}

/**
 * The cheapest step into cell (i, j), for i, j >= 1, where `costAt` gives the cost of each earlier
 * cell (i characters of a against j of b). Every edit costs 1. On a tie the earlier candidate
 * wins, in the order diagonal (`match` or `substitute`), `delete`, `insert`, `transpose`.
 */
export function osaStep(costAt: (i: number, j: number) => number, a: string, b: string, i: number, j: number): OsaStep {
    const same = a[i - 1] === b[j - 1]
    const candidates: OsaStep[] = [
        { cost: costAt(i - 1, j - 1) + (same ? 0 : 1), op: same ? 'match' : 'substitute', from: { i: i - 1, j: j - 1 } },
        { cost: costAt(i - 1, j) + 1, op: 'delete', from: { i: i - 1, j } },
        { cost: costAt(i, j - 1) + 1, op: 'insert', from: { i, j: j - 1 } },
        ...(i >= 2 && j >= 2 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
            ? [{ cost: costAt(i - 2, j - 2) + 1, op: 'transpose' as const, from: { i: i - 2, j: j - 2 } }]
            : []),
    ]
    return candidates.reduce((best, candidate) => (candidate.cost < best.cost ? candidate : best))
}
