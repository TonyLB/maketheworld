/**
 * The OSA (restricted Damerau-Levenshtein) step: the cheapest way into one cell of an alignment
 * table of string a against string b. Shared by the aligners built on it
 * (`testing/sellersApproximateSubstringMatch`, `tokenAwareAlignment`), which differ in their
 * boundary rows, in how they read the table, and in what each step costs.
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

/** What a step into cell (i, j) costs, by its op. */
export type StepCost = (op: AlignmentOp, i: number, j: number) => number

/** A match is free and every edit costs 1. */
export const unitStepCost: StepCost = (op) => (op === 'match' ? 0 : 1)

/**
 * The cheapest step into cell (i, j), for i, j >= 1, where `costAt` gives the cost of each earlier
 * cell (i characters of a against j of b), as a step of the given op leaves it. Each step costs what `stepCost` says (every edit 1 by
 * default). On a tie the earlier candidate wins, in the order diagonal (`match` or `substitute`),
 * `delete`, `insert`, `transpose`.
 */
export function osaStep(
    costAt: (i: number, j: number, op: AlignmentOp) => number,
    a: string,
    b: string,
    i: number,
    j: number,
    stepCost: StepCost = unitStepCost
): OsaStep {
    const diagonal: AlignmentOp = a[i - 1] === b[j - 1] ? 'match' : 'substitute'
    const candidates: OsaStep[] = [
        { cost: costAt(i - 1, j - 1, diagonal) + stepCost(diagonal, i, j), op: diagonal, from: { i: i - 1, j: j - 1 } },
        { cost: costAt(i - 1, j, 'delete') + stepCost('delete', i, j), op: 'delete', from: { i: i - 1, j } },
        { cost: costAt(i, j - 1, 'insert') + stepCost('insert', i, j), op: 'insert', from: { i, j: j - 1 } },
        ...(i >= 2 && j >= 2 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
            ? [{ cost: costAt(i - 2, j - 2, 'transpose') + stepCost('transpose', i, j), op: 'transpose' as const, from: { i: i - 2, j: j - 2 } }]
            : []),
    ]
    return candidates.reduce((best, candidate) => (candidate.cost < best.cost ? candidate : best))
}
