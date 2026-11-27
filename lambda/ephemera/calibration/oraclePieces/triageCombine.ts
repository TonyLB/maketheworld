//
// The split, graded from two batches (AGENT.triage.planning.md, step 5, the branch-only arm): each call of the branch alone
// (`triageBranch.ts`) paired by cell and repeat with a grounding call: the grounding alone (`triageGrounding.ts`), or a whole triage reply,
// read for its grounding only, its own kind set aside.
// The guard (`triageGuard.ts`) runs on the branch's kind and the grounding's plan and match, as a split would join them. It reads the saved
// responses, so no call is made again; each cell is rendered as the batch was, since the contract reads the prompt it was shown.
//
import { fixtureScene } from '../imaginationPieces/imaginationScene'
import type { PieceCall } from '../pieceProbe/runPieceProbe'
import { acceptedGroundings, groundingOf, renderTriage, triageCells, triageContract, type TriageAnswer, type TriageKind, type TriageVerdict } from './triage'
import { triageBranchContract } from './triageBranch'
import { renderTriageGrounding, triageGroundingContract, type TriageGrounding } from './triageGrounding'
import { triageCorpus } from './triageCorpus'
import { guarded } from './triageGuard'

/** The piece a grounding call is from: the grounding alone, or a whole triage reply, whose own kind is set aside. */
export type GroundingPiece = 'triage' | 'triageGrounding'

/** One pair: the branch's verdict and the grounding call's answer, or why either has none, and what the guard made of the two. */
export type CombinedPair = {
    cell: string
    repeat: number
    branch: TriageVerdict | { problems: string[] }
    /** The grounding's plan and match; a whole triage reply's carries its own kind too. */
    grounding: TriageAnswer | TriageGrounding | { problems: string[] }
    /** The guard's kind on the branch's verdict and the grounding's plan; absent where either has none. */
    after?: TriageKind
}

const verdictOf = (reply: string | undefined, error: string | undefined, read: (reply: string) => { value: TriageVerdict } | { problems: string[] }): TriageVerdict | { problems: string[] } => {
    if (reply === undefined) {
        return { problems: [`error: ${error ?? 'no reply'}`] }
    }
    const parsed = read(reply)
    return 'value' in parsed ? parsed.value : parsed
}

/** How a grounding call of each piece is read: as its own batch rendered it, by its own contract. */
const GROUNDING_READ: Record<GroundingPiece, { render: typeof renderTriage; parse: (reply: string, shown: Parameters<typeof triageContract.parse>[1]) => { value: TriageAnswer | TriageGrounding } | { problems: string[] } }> = {
    triage: { render: renderTriage, parse: (reply, shown) => triageContract.parse(reply, shown) },
    triageGrounding: { render: renderTriageGrounding, parse: (reply, shown) => triageGroundingContract.parse(reply, shown) },
}

/**
 * Every branch call, with the grounding call of the same cell and repeat (or a problem, where there is none), and the guard's kind on the
 * two. A grounding call with no branch call beside it is left out.
 */
export const combineTriage = async (branchCalls: readonly PieceCall[], groundingCalls: readonly PieceCall[], groundingPiece: GroundingPiece = 'triage'): Promise<CombinedPair[]> => Promise.all(
    branchCalls.map(async ({ cell, repeat, answer, error }): Promise<CombinedPair> => {
        const known = triageCells[cell]
        if (known === undefined) {
            return { cell, repeat, branch: { problems: ['not a triage cell'] }, grounding: { problems: ['not a triage cell'] } }
        }
        const rendered = await renderTriage(known)
        const shown = { input: known.inputs, rendered }
        const branch = verdictOf(answer, error, (reply) => triageBranchContract.parse(reply, shown))
        const partner = groundingCalls.find((call) => call.cell === cell && call.repeat === repeat)
        const read = GROUNDING_READ[groundingPiece]
        const groundingShown = { input: known.inputs, rendered: groundingPiece === 'triage' ? rendered : await read.render(known) }
        const grounding = partner === undefined
            ? { problems: ['no grounding call of this cell and repeat'] }
            : partner.answer === undefined
                ? { problems: [`error: ${partner.error ?? 'no reply'}`] }
                : ((parsed) => ('value' in parsed ? parsed.value : parsed))(read.parse(partner.answer, groundingShown))
        if ('problems' in branch || 'problems' in grounding) {
            return { cell, repeat, branch, grounding }
        }
        const joined = { ...branch, plan: grounding.plan, ...(grounding.involved === undefined ? {} : { involved: grounding.involved }) } as TriageAnswer
        return { cell, repeat, branch, grounding, after: guarded(joined, await fixtureScene(known.inputs.fixture)).kind }
    }),
)

/**
 * A row's settled kinds, as triage's cells have them, and the branch alone (the corpus's `alone`, or else as shown); open rows
 * have none.
 */
const settled = (cell: string): { shown: TriageKind; after: TriageKind; alone: TriageKind } | undefined => {
    const { expected, expectedAspects } = triageCells[cell] ?? {}
    const after = expectedAspects?.afterGuard?.[0]
    return expected === undefined || after === undefined ? undefined : {
        shown: expected as TriageKind, after: after as TriageKind, alone: triageCorpus[cell]?.branch?.alone ?? expected as TriageKind,
    }
}

/**
 * Whether a "Defer" row is the branch's own: its branch alone is "Defer", so no rule of the guard's makes it, only the act (what it sets
 * off, or what it rests on: strength, skill or luck).
 */
export const ownDefer = (cell: string): boolean => settled(cell)?.alone === 'Defer'

const kindOf = (part: TriageVerdict | TriageAnswer | TriageGrounding | { problems: string[] }): TriageKind | undefined => ('problems' in part || !('kind' in part) ? undefined : part.kind)

/** A count over the pairs it applies to, and the cells it fell on, each as often as it did. */
export type CombinedCount = { n: number; of: number; cells: string[] }

const count = (pairs: readonly CombinedPair[], applies: (pair: CombinedPair) => boolean, holds: (pair: CombinedPair) => boolean): CombinedCount => {
    const applied = pairs.filter(applies)
    const held = applied.filter(holds)
    return { n: held.length, of: applied.length, cells: held.map(({ cell }) => cell) }
}

/**
 * The bar's counts on the combination: the branch right alone (its graded answer) and as shown (a single call's answer, for comparison), the
 * guard's kind right, a wrong "Yes" after the guard, a wrong "No", the needless defers (a "Defer" where the branch alone is "Yes" or "No")
 * and the branch's own defers, each over the settled rows it applies to; the grounding right, on every row, as the grounding arm grades it
 * (the user, 2026-11-27); the replies refused on either side; and, for a whole triage reply, where the branch and its own kind disagree.
 */
export const combinedSummary = (pairs: readonly CombinedPair[]) => {
    const isSettled = ({ cell }: CombinedPair) => settled(cell) !== undefined
    const branchKind = (pair: CombinedPair) => kindOf(pair.branch)
    return {
        pairs: pairs.length,
        branchRefused: count(pairs, () => true, ({ branch }) => 'problems' in branch),
        groundingRefused: count(pairs, () => true, ({ grounding }) => 'problems' in grounding),
        rightAlone: count(pairs, isSettled, (pair) => branchKind(pair) === settled(pair.cell)?.alone),
        rightAsShown: count(pairs, isSettled, (pair) => branchKind(pair) === settled(pair.cell)?.shown),
        rightAfterGuard: count(pairs, isSettled, ({ cell, after }) => after === settled(cell)?.after),
        wrongYesAfterGuard: count(pairs, isSettled, ({ cell, after }) => after === 'Yes' && settled(cell)?.after !== 'Yes'),
        wrongNo: count(pairs, isSettled, (pair) => branchKind(pair) === 'No' && settled(pair.cell)?.alone !== 'No'),
        needlessDefers: count(pairs, ({ cell }) => settled(cell)?.alone === 'Yes' || settled(cell)?.alone === 'No', (pair) => branchKind(pair) === 'Defer'),
        ownDefers: count(pairs, ({ cell }) => ownDefer(cell), (pair) => branchKind(pair) === 'Defer'),
        groundingRight: count(pairs, ({ cell }) => triageCorpus[cell] !== undefined, ({ cell, grounding }) => (
            !('problems' in grounding) && acceptedGroundings(triageCorpus[cell]).includes(groundingOf(grounding.plan))
        )),
        disagreements: count(pairs, ({ branch, grounding }) => !('problems' in branch) && kindOf(grounding) !== undefined, (pair) => branchKind(pair) !== kindOf(pair.grounding)),
    }
}

const kindText = (part: TriageVerdict | { problems: string[] }): string => ('problems' in part ? `refused (${part.problems.join('; ')})` : part.kind === 'No' ? `No: ${part.reason}` : part.kind)

/** The pairs for reading, one line each: the row's kinds, the branch, the grounding with its own kind, and the guard's kind on the two. */
export const combinedText = (pairs: readonly CombinedPair[]): string => pairs.map(({ cell, repeat, branch, grounding, after }) => {
    const row = settled(cell)
    const expected = row === undefined ? 'open' : [row.shown, ...(row.alone === row.shown ? [] : [`alone ${row.alone}`]), ...(row.after === row.shown ? [] : [`after the guard ${row.after}`])].join(', ')
    const groundingText = 'problems' in grounding
        ? `refused (${grounding.problems.join('; ')})`
        : `${groundingOf(grounding.plan)}${'kind' in grounding ? ` (its own kind ${grounding.kind})` : ''}`
    return `${cell}, repeat ${repeat} [${expected}]: branch ${kindText(branch)}; grounding ${groundingText}; after the guard ${after ?? '-'}`
}).join('\n')

