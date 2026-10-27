/**
 * Sellers' approximate substring search (step 1 of the lexical relevance pipeline): the region of
 * T that pattern P aligns to most cheaply, under OSA distance (`osaStep.ts`), with the region
 * recovered by traceback. Gaps in T before and after the region are free; P is aligned whole.
 *
 * P is the shorter normalized string and T the longer, whichever side each came from:
 * `lexicalDiff` swaps the span and the catalog shortName by length.
 * Character-level, no tokenization.
 */

import { osaStep, type AlignmentOp, type OsaStep } from './osaStep'
import type { TextRange } from './types'

export type SellersApproximateSubstringMatch = {
    distance: number
    matchSpan: TextRange
    leftFlank: string
    rightFlank: string
    /** The alignment of P against T's match span; its edits sum to `distance`. */
    ops: AlignmentOp[]
}

const INFINITY = Number.POSITIVE_INFINITY

const traceback = (
    back: Array<Array<OsaStep | undefined>>,
    patternLength: number,
    endIndex: number
): { start: number; ops: AlignmentOp[] } => {
    let i = patternLength
    let j = endIndex
    const ops: AlignmentOp[] = []
    while (i > 0 && back[i][j] !== undefined) {
        const step = back[i][j]!
        ops.push(step.op)
        i = step.from.i
        j = step.from.j
    }
    return { start: j, ops: ops.reverse() }
}

/**
 * Sellers substring search with OSA distance and full span recovery via traceback.
 * Tie-break: minimum distance, then longest match span in T, then the latest end.
 */
export function sellersApproximateSubstringMatch(
    pattern: string,
    candidateText: string
): SellersApproximateSubstringMatch {
    const P = pattern
    const T = candidateText
    const m = P.length
    const n = T.length

    if (m === 0) {
        return {
            distance: 0,
            matchSpan: { start: 0, end: 0 },
            leftFlank: T,
            rightFlank: '',
            ops: [],
        }
    }

    if (n === 0) {
        return {
            distance: m,
            matchSpan: { start: 0, end: 0 },
            leftFlank: '',
            rightFlank: '',
            ops: Array<AlignmentOp>(m).fill('delete'),
        }
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(INFINITY))
    const back: Array<Array<OsaStep | undefined>> = Array.from(
        { length: m + 1 },
        () => Array<OsaStep | undefined>(n + 1).fill(undefined)
    )

    // Boundary rows: T's characters before the region are free; P's characters are each a delete.
    for (let j = 0; j <= n; j += 1) {
        dp[0][j] = 0
    }
    for (let i = 1; i <= m; i += 1) {
        dp[i][0] = i
        back[i][0] = { cost: i, op: 'delete', from: { i: i - 1, j: 0 } }
    }

    const costAt = (i: number, j: number): number => dp[i][j]
    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            const step = osaStep(costAt, P, T, i, j)
            dp[i][j] = step.cost
            back[i][j] = step
        }
    }

    let bestDistance = dp[m][0]
    for (let j = 1; j <= n; j += 1) {
        if (dp[m][j] < bestDistance) {
            bestDistance = dp[m][j]
        }
    }

    let bestEnd = 0
    let bestSpanLength = -1

    for (let j = 0; j <= n; j += 1) {
        if (dp[m][j] !== bestDistance) {
            continue
        }
        const { start } = traceback(back, m, j)
        const spanLength = j - start
        if (
            spanLength > bestSpanLength
            || (spanLength === bestSpanLength && j > bestEnd)
        ) {
            bestSpanLength = spanLength
            bestEnd = j
        }
    }

    const { start, ops } = traceback(back, m, bestEnd)

    return {
        distance: bestDistance,
        matchSpan: { start, end: bestEnd },
        leftFlank: T.slice(0, start),
        rightFlank: T.slice(bestEnd),
        ops,
    }
}
