/**
 * The token-aware alignment of a span against a catalog shortName: a two-level generalization of
 * Sellers' approximate substring search (`testing/sellersApproximateSubstringMatch.ts`). The outer
 * level is an overlap (ends-free) alignment over tokens (the lexemes of each string, `lexemesOf`),
 * finding the run of tokens that matches most cheaply; the inner level is OSA over characters
 * (`osaStep.ts`), pricing how closely a group of tokens matches a group on the other side.
 *
 * How it departs from Sellers:
 * - Both strings may be cut short, not just the longer, and what lies outside the match is priced
 *   by side: a span token costs its characters at the span's skip cost (the span is explained
 *   unless its words are surplus), a name token is free (the catalog side's forgiveness). Inside
 *   the match a whole token may be skipped too, priced the same way (`rusty ax` against
 *   "rusty old ax"). Rewarding aligned characters is the same lever: every span character is
 *   paired or priced.
 * - The first and last pairs of the match may leave part of their words outside it: a span
 *   character at the span's skip cost, a name character at a lower one (`ax` against "axle" keeps
 *   `le`).
 * - A group joins up to `LEX_ALIGN_MAX_MERGE` tokens against one on the other side, merged or split
 *   across their boundaries at a boundary cost each (`coupon` against "cup on"). Span tokens merged
 *   into one pair are paired whole, so a span word is merged or cut, never both (`hold of the cup`
 *   against "cloth" cannot pair `of th` with "oth").
 * - A pair whose edits exceed `LEX_ALIGN_PAIR_MAX_RELATIVE_EDITS` of its length is no pair: its
 *   tokens are each their side's surplus (`up` against "in"). So a wholly wrong pair never costs
 *   what leaving its words out would, and coincidental letters cannot smear a name over a span.
 * - A span boundary at a cut another complete reading makes (`cuts`, character positions in the
 *   span) costs `cutBoundary` rather than `boundary`, so a name is not smeared across a cut
 *   (`pig in a blanket` against "pig iron"); words paired one for one across a cut cost nothing.
 */

import { lexemesOf } from '../../../deterministicTemplate/granuleTokens'

import { osaStep, type AlignmentOp, type OsaStep } from './osaStep'
import {
    LEX_ALIGN_BOUNDARY_COST,
    LEX_ALIGN_CUT_BOUNDARY_COST,
    LEX_ALIGN_MAX_MERGE,
    LEX_ALIGN_NAME_PARTIAL_COST,
    LEX_ALIGN_PAIR_MAX_RELATIVE_EDITS,
    LEX_ALIGN_SPAN_SKIP_COST,
} from './thresholds'
import type { TextRange } from './types'

/** The alignment's costs, in edits (an edit costs 1). */
export type AlignmentCosts = {
    /** A span character left out of a pair, or in a span token skipped. */
    spanSkip: number
    /** A character, outside the match, of the name's word its edge cuts into. */
    namePartial: number
    /** A boundary merged or split inside a group. */
    boundary: number
    /** A boundary of merged span words at a cut another complete reading makes (`cuts`). */
    cutBoundary: number
    /** The most tokens a group joins against one. */
    maxMerge: number
    /** The most edits a pair may hold, relative to its length. */
    pairMaxRelativeEdits: number
}

export const ALIGNMENT_COSTS: AlignmentCosts = {
    spanSkip: LEX_ALIGN_SPAN_SKIP_COST,
    namePartial: LEX_ALIGN_NAME_PARTIAL_COST,
    boundary: LEX_ALIGN_BOUNDARY_COST,
    cutBoundary: LEX_ALIGN_CUT_BOUNDARY_COST,
    maxMerge: LEX_ALIGN_MAX_MERGE,
    pairMaxRelativeEdits: LEX_ALIGN_PAIR_MAX_RELATIVE_EDITS,
}

/** A group of span tokens paired with a group of name tokens: the characters of each the pair covers. */
export type WordPair = {
    span: TextRange
    name: TextRange
}

export type TokenAwareAlignment = {
    /** The match in the span. */
    span: TextRange
    /** The match in the name. */
    name: TextRange
    /** Each pair's character alignment, in order; a skipped token is a delete or an insert per character. */
    ops: AlignmentOp[]
    /** Character edits inside the pairs. */
    edits: number
    /** Boundaries merged or split inside the pairs. */
    boundaries: number
    pairs: WordPair[]
    /** Whole tokens inside the match paired with nothing, on each side. */
    skipped: { span: TextRange[]; name: TextRange[] }
}

type Token = TextRange & { text: string }

const tokensOf = (text: string): Token[] => (
    lexemesOf(text).map(({ start, text: token }) => ({ start, end: start + token.length, text: token }))
)

const isPair = (op: AlignmentOp): boolean => op === 'match' || op === 'substitute' || op === 'transpose'

/** Whether each end of a group pair may leave characters outside the match. */
type Ends = { left: boolean; right: boolean }

type GroupComparison = {
    /** Edits, plus the price of the characters left outside. */
    cost: number
    edits: number
    /** The longer side's characters in the pair, spaces between merged tokens aside. */
    length: number
    ops: AlignmentOp[]
    /** The characters paired, as offsets in each string. */
    span: TextRange
    name: TextRange
}

type InnerStep = OsaStep & { fromStart: boolean }

/**
 * The inner level: OSA of two groups of tokens, each joined without its spaces. A free end may
 * leave part of its outermost token on either side outside the pair, at that side's price; a fixed
 * end aligns the groups to their edges.
 */
const compareGroups = (spanTokens: Token[], nameTokens: Token[], ends: Ends, costs: AlignmentCosts): GroupComparison | undefined => {
    const a = spanTokens.map(({ text }) => text).join('')
    const b = nameTokens.map(({ text }) => text).join('')
    const offsetsOf = (tokens: Token[]) => tokens.flatMap(({ start, text }) => [...text].map((_, index) => start + index))
    const spanOffsets = offsetsOf(spanTokens)
    const nameOffsets = offsetsOf(nameTokens)
    const m = a.length
    const n = b.length
    const [firstSpan, lastSpan] = [spanTokens[0].text.length, spanTokens[spanTokens.length - 1].text.length]
    const [firstName, lastName] = [nameTokens[0].text.length, nameTokens[nameTokens.length - 1].text.length]

    // Span tokens merged into one pair are paired whole: the span's words are merged or cut, not both.
    const spanCut = spanTokens.length === 1
    const startCost = (i: number, j: number): number => {
        if (!ends.left) {
            return i === 0 && j === 0 ? 0 : Number.POSITIVE_INFINITY
        }
        return (spanCut ? i < firstSpan : i === 0) && j < firstName ? costs.spanSkip * i + costs.namePartial * j : Number.POSITIVE_INFINITY
    }
    const endCost = (i: number, j: number): number => {
        if (!ends.right) {
            return i === m && j === n ? 0 : Number.POSITIVE_INFINITY
        }
        return (spanCut ? m - i < lastSpan : i === m) && n - j < lastName ? costs.spanSkip * (m - i) + costs.namePartial * (n - j) : Number.POSITIVE_INFINITY
    }

    // Two costs per cell: of starting the pair there, and of a pair ending there (the cheapest step
    // into it). At a free end the pair neither starts nor ends on a delete or insert, and a step
    // follows an earlier step rather than a start on a tie, so the pair is as long as it can be.
    const cost: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(Number.POSITIVE_INFINITY))
    const back: Array<Array<InnerStep | undefined>> = Array.from({ length: m + 1 }, () => Array<InnerStep | undefined>(n + 1).fill(undefined))
    const fromStartAllowed = (op: AlignmentOp): boolean => isPair(op) || !ends.left
    const costAt = (i: number, j: number, op: AlignmentOp): number => (
        fromStartAllowed(op) ? Math.min(cost[i][j], startCost(i, j)) : cost[i][j]
    )
    const record = (i: number, j: number, step: OsaStep) => {
        cost[i][j] = step.cost
        back[i][j] = { ...step, fromStart: fromStartAllowed(step.op) && startCost(step.from.i, step.from.j) < cost[step.from.i][step.from.j] }
    }
    for (let i = 0; i <= m; i += 1) {
        for (let j = 0; j <= n; j += 1) {
            if (i > 0 && j > 0) {
                record(i, j, osaStep(costAt, a, b, i, j))
            } else if (i > 0) {
                record(i, j, { cost: costAt(i - 1, 0, 'delete') + 1, op: 'delete', from: { i: i - 1, j: 0 } })
            } else if (j > 0) {
                record(i, j, { cost: costAt(0, j - 1, 'insert') + 1, op: 'insert', from: { i: 0, j: j - 1 } })
            }
        }
    }

    const ends_ = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => ({ i, j })))
        .flat()
        .filter(({ i, j }) => back[i][j] !== undefined && Number.isFinite(cost[i][j] + endCost(i, j)) && (!ends.right || isPair(back[i][j]!.op)))
    if (ends_.length === 0) {
        return undefined
    }
    const traced = ends_.map(({ i, j }) => {
        const steps: Array<InnerStep & { to: { i: number; j: number } }> = []
        let cell = { i, j }
        for (;;) {
            const step = back[cell.i][cell.j]!
            steps.push({ ...step, to: cell })
            if (step.fromStart || (step.from.i === 0 && step.from.j === 0)) {
                break
            }
            cell = step.from
        }
        steps.reverse()
        return { steps, total: cost[i][j] + endCost(i, j), start: steps[0].from, end: { i, j } }
    })
    const best = traced.reduce((leader, candidate) => {
        if (candidate.total !== leader.total) {
            return candidate.total < leader.total ? candidate : leader
        }
        const length = ({ start, end }: typeof leader) => [end.j - start.j, end.i - start.i]
        const [leaderName, leaderSpan] = length(leader)
        const [candidateName, candidateSpan] = length(candidate)
        return candidateName > leaderName || (candidateName === leaderName && candidateSpan > leaderSpan) ? candidate : leader
    })
    // a character offset just past the last paired one
    const rangeIn = (offsets: number[], start: number, end: number): TextRange => (
        end > start ? { start: offsets[start], end: offsets[end - 1] + 1 } : { start: offsets[Math.min(start, offsets.length - 1)], end: offsets[Math.min(start, offsets.length - 1)] }
    )
    return {
        cost: best.total,
        edits: best.steps.filter(({ op }) => op !== 'match').length,
        length: Math.max(best.end.i - best.start.i, best.end.j - best.start.j),
        ops: best.steps.map(({ op }) => op),
        span: rangeIn(spanOffsets, best.start.i, best.end.i),
        name: rangeIn(nameOffsets, best.start.j, best.end.j),
    }
}

type OuterStep = {
    cost: number
    from: { i: number; j: number }
    fromStart: boolean
    pair?: GroupComparison & { boundaries: number }
    skipped?: 'span' | 'name'
}

/**
 * The cheapest token-aware alignment of a span against a name, both normalized and non-empty, or
 * `undefined` when no pair of their tokens is close enough to be one. `cuts` are positions in the
 * span where another complete reading cuts it. Tie-break: the lowest cost,
 * then the longest match in the name, then in the span.
 */
export function alignSpanToName(
    span: string,
    name: string,
    costs: AlignmentCosts = ALIGNMENT_COSTS,
    cuts: readonly number[] = []
): TokenAwareAlignment | undefined {
    const spanTokens = tokensOf(span)
    const nameTokens = tokensOf(name)
    const p = spanTokens.length
    const q = nameTokens.length
    const spanCost = (from: number, to: number): number => (
        spanTokens.slice(from, to).reduce((total, { text }) => total + costs.spanSkip * text.length, 0)
    )

    const comparisons = new Map<string, GroupComparison | undefined>()
    /** The admitted pair of span tokens [i - a, i) against name tokens [j - b, j), or `undefined`. */
    const pairOf = (i: number, j: number, a: number, b: number, ends: Ends): (GroupComparison & { boundaries: number }) | undefined => {
        const key = `${i},${j},${a},${b},${ends.left},${ends.right}`
        if (!comparisons.has(key)) {
            const compared = compareGroups(spanTokens.slice(i - a, i), nameTokens.slice(j - b, j), ends, costs)
            comparisons.set(key, compared && compared.edits <= costs.pairMaxRelativeEdits * compared.length ? compared : undefined)
        }
        const admitted = comparisons.get(key)
        if (!admitted) {
            return undefined
        }
        // The a - 1 boundaries between merged span tokens, each priced by whether a cut falls on it.
        const spanBoundaryCost = spanTokens.slice(i - a, i - 1).reduce((total, token, offset) => (
            total + (cuts.some((cut) => cut >= token.end && cut <= spanTokens[i - a + offset + 1].start) ? costs.cutBoundary : costs.boundary)
        ), 0)
        return { ...admitted, boundaries: a - 1 + b - 1, cost: admitted.cost + spanBoundaryCost + costs.boundary * (b - 1) }
    }
    const groupShapes = Array.from({ length: costs.maxMerge }, (_, index) => index + 1)
        .flatMap((k) => (k === 1 ? [[1, 1]] : [[k, 1], [1, k]]))

    // The outer level: the cheapest match ending just past span token i and name token j, its last
    // step a pair or a skip inside the match. A match starts free of name tokens and pays for the
    // span tokens before it; its first pair may leave part of its words outside.
    const startCost = (i: number): number => spanCost(0, i)
    const cost: number[][] = Array.from({ length: p + 1 }, () => Array<number>(q + 1).fill(Number.POSITIVE_INFINITY))
    const back: Array<Array<OuterStep | undefined>> = Array.from({ length: p + 1 }, () => Array<OuterStep | undefined>(q + 1).fill(undefined))
    const pairSteps = (i: number, j: number, right: boolean): OuterStep[] => (
        groupShapes
            .filter(([a, b]) => a <= i && b <= j)
            .flatMap(([a, b]) => {
                const from = { i: i - a, j: j - b }
                return [
                    ...(Number.isFinite(cost[from.i][from.j]) ? [{ left: false, base: cost[from.i][from.j], fromStart: false }] : []),
                    { left: true, base: startCost(from.i), fromStart: true },
                ].flatMap(({ left, base, fromStart }) => {
                    const pair = pairOf(i, j, a, b, { left, right })
                    return pair ? [{ cost: base + pair.cost, from, fromStart, pair }] : []
                })
            })
    )
    const cheapest = (steps: OuterStep[]): OuterStep | undefined => (
        // a step after an earlier step wins a tie with a start, so the match is as long as it can be
        steps.reduce<OuterStep | undefined>((best, step) => (
            best === undefined || step.cost < best.cost || (step.cost === best.cost && best.fromStart && !step.fromStart) ? step : best
        ), undefined)
    )
    for (let i = 1; i <= p; i += 1) {
        for (let j = 1; j <= q; j += 1) {
            const step = cheapest([
                ...pairSteps(i, j, false),
                ...(Number.isFinite(cost[i - 1][j]) ? [{ cost: cost[i - 1][j] + spanCost(i - 1, i), from: { i: i - 1, j }, fromStart: false, skipped: 'span' as const }] : []),
                ...(Number.isFinite(cost[i][j - 1]) ? [{ cost: cost[i][j - 1], from: { i, j: j - 1 }, fromStart: false, skipped: 'name' as const }] : []),
            ])
            if (step) {
                cost[i][j] = step.cost
                back[i][j] = step
            }
        }
    }

    // The match ends on a pair, which may leave part of its words outside; the span tokens after it are paid for.
    const finals = Array.from({ length: p }, (_, row) => Array.from({ length: q }, (_, column) => ({ i: row + 1, j: column + 1 })))
        .flat()
        .flatMap(({ i, j }) => pairSteps(i, j, true).map((last) => ({ last, end: { i, j }, total: last.cost + spanCost(i, p) })))
    if (finals.length === 0) {
        return undefined
    }
    const traced = finals.map((final) => {
        const steps: OuterStep[] = [final.last]
        let step = final.last
        while (!step.fromStart) {
            step = back[step.from.i][step.from.j]!
            steps.push(step)
        }
        steps.reverse()
        const pairs = steps.flatMap(({ pair }) => (pair ? [pair] : []))
        return {
            ...final,
            steps,
            span: { start: pairs[0].span.start, end: pairs[pairs.length - 1].span.end },
            name: { start: pairs[0].name.start, end: pairs[pairs.length - 1].name.end },
        }
    })
    const best = traced.reduce((leader, candidate) => {
        if (candidate.total !== leader.total) {
            return candidate.total < leader.total ? candidate : leader
        }
        const length = ({ span: spanMatch, name: nameMatch }: typeof leader) => [nameMatch.end - nameMatch.start, spanMatch.end - spanMatch.start]
        const [leaderName, leaderSpan] = length(leader)
        const [candidateName, candidateSpan] = length(candidate)
        return candidateName > leaderName || (candidateName === leaderName && candidateSpan > leaderSpan) ? candidate : leader
    })

    const skippedOn = (side: 'span' | 'name'): TextRange[] => best.steps
        .filter(({ skipped }) => skipped === side)
        .map(({ from }) => {
            const token = side === 'span' ? spanTokens[from.i] : nameTokens[from.j]
            return { start: token.start, end: token.end }
        })
    const pairs = best.steps.flatMap(({ pair }) => (pair ? [pair] : []))
    return {
        span: best.span,
        name: best.name,
        ops: best.steps.flatMap(({ pair, skipped, from }) => {
            if (pair) {
                return pair.ops
            }
            const token = skipped === 'span' ? spanTokens[from.i] : nameTokens[from.j]
            return Array<AlignmentOp>(token.text.length).fill(skipped === 'span' ? 'delete' : 'insert')
        }),
        edits: pairs.reduce((total, { edits }) => total + edits, 0),
        boundaries: pairs.reduce((total, { boundaries }) => total + boundaries, 0),
        pairs: pairs.map(({ span: spanRange, name: nameRange }) => ({ span: spanRange, name: nameRange })),
        skipped: { span: skippedOn('span'), name: skippedOn('name') },
    }
}
