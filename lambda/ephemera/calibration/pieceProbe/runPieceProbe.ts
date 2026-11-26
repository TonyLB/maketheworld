//
// The piece probe's run and tally: one Bedrock call per (cell, repeat) for each cell code doesn't answer, each graded by the piece's grade
// (`pieceAnswer` against its answer set, or its own), then a tally per cell against its expected answer, which is what the reader reads first.
// A cell with no expected answer is tallied and not graded. A grade's aspects are tallied beside its answer, each apart.
//
import type { NovaModel } from '../../llm/novaModel'
import { runProbeCalls } from '../oracleLoop/runOracleProbe'
import { textHash } from '../textHash'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { promptFor, type RenderedParts } from './oraclePiece'
import type { PieceGrade } from './pieceAnswer'

/**
 * A cell ready to run: its rendered inputs, or the answer code gave in place of a call. Under system delivery it carries the render's two
 * `parts` too, and `rendered` is their join.
 */
export type PreparedCell = { cell: string; expected?: string; expectedAspects?: Readonly<Record<string, readonly string[]>>; lookFor?: string; rendered: string; parts?: RenderedParts; byCode?: string }

export type PieceCall = { cell: string; repeat: number; answer?: string; error?: string; grade?: PieceGrade }

/** One aspect's tally: how often each value was given, and against the cell's accepted ones, where it has them (0 and 0 where it has none). */
export type AspectTally = { expected?: readonly string[]; right: number; wrong: number; given: Record<string, number> }

export type PieceTally = {
    cell: string
    /** Absent for a cell whose answer is open: its `right` and `wrong` are 0. */
    expected?: string
    lookFor?: string
    n: number
    right: number
    wrong: number
    malformed: number
    errors: number
    /** How often each answer was given. */
    answers: Record<string, number>
    /** The grade's aspects, where it or the cell has any. */
    aspects?: Record<string, AspectTally>
    /** The answer code gave, where the cell made no call. */
    byCode?: { answer: string; right: boolean }
    inputs: { hash: string }
}

export type PieceSummary = { calls: number; right: number; wrong: number; malformed: number; errors: number; byCode: number; ungraded: number; aspects?: Record<string, { right: number; wrong: number; ungraded: number }> }

export const runPieceProbe = async ({ cells, instructions, grade, repeats, model, maxTokens, invoke }: {
    cells: readonly PreparedCell[]
    instructions: string
    /** The piece's grade of one reply, given the cell's id. */
    grade: (reply: string, cell: string) => PieceGrade | Promise<PieceGrade>
    repeats: number
    model: NovaModel
    /** The output cap per call, where the piece sets one. */
    maxTokens?: number
    invoke?: ProbeInvoke
}): Promise<PieceCall[]> => Promise.all(
    (await runProbeCalls({
        prompts: cells.filter(({ byCode }) => byCode === undefined).map((cell) => ({ id: cell.cell, ...promptFor(instructions, cell) })),
        repeats,
        model,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
        ...(invoke !== undefined ? { invoke } : {}),
    })).map(async ({ id, repeat, answer, error }): Promise<PieceCall> => (
        answer !== undefined ? { cell: id, repeat, answer, grade: await grade(answer, id) } : { cell: id, repeat, error }
    ))
)

const countsOf = (values: readonly string[]): Record<string, number> => values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})

/** The aspects the cell expects or its grades give, each tallied; `undefined` where there are none. */
const tallyAspects = (expected: PreparedCell['expectedAspects'] = {}, grades: readonly (PieceGrade | undefined)[]): Record<string, AspectTally> | undefined => {
    const readings = grades.flatMap((grade) => (grade !== undefined && 'answer' in grade && grade.aspects !== undefined ? [grade.aspects] : []))
    const names = [...new Set([...Object.keys(expected), ...readings.flatMap((aspects) => Object.keys(aspects))])]
    return names.length === 0 ? undefined : Object.fromEntries(names.map((name): [string, AspectTally] => {
        const given = readings.flatMap((aspects) => (name in aspects ? [aspects[name]] : []))
        const accepted = expected[name]
        const right = given.filter((value) => accepted?.includes(value) ?? false).length
        return [name, { ...(accepted === undefined ? {} : { expected: accepted }), right, wrong: accepted === undefined ? 0 : given.length - right, given: countsOf(given) }]
    }))
}

export const tallyPiece = (cells: readonly PreparedCell[], calls: readonly PieceCall[]): PieceTally[] => cells.map(({ cell, expected, expectedAspects, lookFor, rendered, byCode }) => {
    const graded = calls.filter((call) => call.cell === cell).map(({ grade }) => grade)
    const given = graded.flatMap((grade) => (grade !== undefined && 'answer' in grade ? [grade.answer] : []))
    const right = expected === undefined ? 0 : given.filter((answer) => answer === expected).length
    const aspects = tallyAspects(expectedAspects, graded)
    return {
        cell,
        ...(expected === undefined ? {} : { expected }),
        ...(lookFor === undefined ? {} : { lookFor }),
        n: graded.length,
        right,
        wrong: expected === undefined ? 0 : given.length - right,
        malformed: graded.filter((grade) => grade !== undefined && 'malformed' in grade).length,
        errors: graded.filter((grade) => grade === undefined).length,
        answers: countsOf(given),
        ...(aspects === undefined ? {} : { aspects }),
        ...(byCode === undefined ? {} : { byCode: { answer: byCode, right: byCode === expected } }),
        inputs: { hash: textHash(rendered) },
    }
})

/** Each aspect's right, wrong and ungraded over every cell; `undefined` where no cell has any. */
const summarizeAspects = (tallies: readonly PieceTally[]): PieceSummary['aspects'] => {
    const entries = tallies.flatMap(({ aspects = {} }) => Object.entries(aspects))
    return entries.length === 0 ? undefined : entries.reduce<NonNullable<PieceSummary['aspects']>>((summary, [name, { expected, right, wrong, given }]) => {
        const { right: rightSoFar, wrong: wrongSoFar, ungraded } = summary[name] ?? { right: 0, wrong: 0, ungraded: 0 }
        const open = expected === undefined ? Object.values(given).reduce((total, count) => total + count, 0) : 0
        return { ...summary, [name]: { right: rightSoFar + right, wrong: wrongSoFar + wrong, ungraded: ungraded + open } }
    }, {})
}

export const summarizePiece = (tallies: readonly PieceTally[]): PieceSummary => {
    const aspects = summarizeAspects(tallies)
    const summary = tallies.reduce<PieceSummary>((totals, tally) => ({
        calls: totals.calls + tally.n,
        right: totals.right + tally.right,
        wrong: totals.wrong + tally.wrong,
        malformed: totals.malformed + tally.malformed,
        errors: totals.errors + tally.errors,
        byCode: totals.byCode + (tally.byCode === undefined ? 0 : 1),
        ungraded: totals.ungraded + (tally.expected === undefined ? tally.n : 0),
    }), { calls: 0, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 0, ungraded: 0 })
    return { ...summary, ...(aspects === undefined ? {} : { aspects }) }
}
