/**
 * Sellers-style approximate substring matching (step 1 of lexical relevance pipeline).
 *
 * Locates the best approximate embedding of pattern P in candidate text T using OSA
 * (restricted Damerau-Levenshtein). Downstream, lexicalMatchMetrics decomposes the
 * match span and flanks into per-factor relevance scores that lexicalRelevance multiplies.
 *
 * P = pattern span; T = catalog shortName (character-level, no tokenization).
 */

export type SellersMatchSpan = {
    /** Inclusive start index in T. */
    start: number
    /** Exclusive end index in T. */
    end: number
}

export type SellersApproximateSubstringMatch = {
    distance: number
    matchSpan: SellersMatchSpan
    leftFlank: string
    rightFlank: string
}

type OsaBackOp = 'match' | 'insert_t' | 'delete_p' | 'transpose'

type OsaBackpointer = {
    pi: number
    pj: number
    op: OsaBackOp
}

const INFINITY = Number.POSITIVE_INFINITY

const substitutionCost = (patternChar: string, textChar: string): number => (
    patternChar === textChar ? 0 : 1
)

const tracebackMatchStart = (
    back: Array<Array<OsaBackpointer | undefined>>,
    patternLength: number,
    endIndex: number
): number => {
    let i = patternLength
    let j = endIndex
    while (i > 0 && back[i][j] !== undefined) {
        const step = back[i][j]!
        i = step.pi
        j = step.pj
    }
    return j
}

/**
 * Sellers substring search with OSA distance and full span recovery via traceback.
 * Tie-break: minimum distance, then longest match span in T.
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
        }
    }

    if (n === 0) {
        return {
            distance: m,
            matchSpan: { start: 0, end: 0 },
            leftFlank: '',
            rightFlank: '',
        }
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(INFINITY))
    const back: Array<Array<OsaBackpointer | undefined>> = Array.from(
        { length: m + 1 },
        () => Array<OsaBackpointer | undefined>(n + 1).fill(undefined)
    )

    for (let j = 0; j <= n; j += 1) {
        dp[0][j] = 0
    }
    for (let i = 1; i <= m; i += 1) {
        dp[i][0] = i
        if (i === 1) {
            back[i][0] = { pi: i - 1, pj: 0, op: 'delete_p' }
        } else if (dp[i - 1][0] + 1 === dp[i][0]) {
            back[i][0] = { pi: i - 1, pj: 0, op: 'delete_p' }
        }
    }

    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            const subCost = substitutionCost(P[i - 1], T[j - 1])
            const diagCost = dp[i - 1][j - 1] + subCost
            if (diagCost < dp[i][j]) {
                dp[i][j] = diagCost
                back[i][j] = { pi: i - 1, pj: j - 1, op: 'match' }
            }

            const deleteCost = dp[i - 1][j] + 1
            if (deleteCost < dp[i][j]) {
                dp[i][j] = deleteCost
                back[i][j] = { pi: i - 1, pj: j, op: 'delete_p' }
            }

            const insertCost = dp[i][j - 1] + 1
            if (insertCost < dp[i][j]) {
                dp[i][j] = insertCost
                back[i][j] = { pi: i, pj: j - 1, op: 'insert_t' }
            }

            if (
                i >= 2
                && j >= 2
                && P[i - 1] === T[j - 2]
                && P[i - 2] === T[j - 1]
            ) {
                const transposeCost = dp[i - 2][j - 2] + 1
                if (transposeCost < dp[i][j]) {
                    dp[i][j] = transposeCost
                    back[i][j] = { pi: i - 2, pj: j - 2, op: 'transpose' }
                }
            }
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
        const start = tracebackMatchStart(back, m, j)
        const spanLength = j - start
        if (
            spanLength > bestSpanLength
            || (spanLength === bestSpanLength && j > bestEnd)
        ) {
            bestSpanLength = spanLength
            bestEnd = j
        }
    }

    const start = tracebackMatchStart(back, m, bestEnd)

    return {
        distance: bestDistance,
        matchSpan: { start, end: bestEnd },
        leftFlank: T.slice(0, start),
        rightFlank: T.slice(bestEnd),
    }
}
