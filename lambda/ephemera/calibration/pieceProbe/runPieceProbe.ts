//
// The piece probe's run and tally: one Bedrock call per (cell, repeat) for each cell code doesn't answer, each graded by the piece's grade
// (`pieceAnswer` against its answer set, or its own), then a tally per cell against its expected answer, which is what the reader reads first.
// A cell with no expected answer is tallied and not graded.
//
import type { NovaModel } from '../../llm/novaModel'
import { runProbeCalls } from '../oracleLoop/runOracleProbe'
import { textHash } from '../textHash'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import type { PieceGrade } from './pieceAnswer'

/** A cell ready to run: its rendered inputs, or the answer code gave in place of a call. */
export type PreparedCell = { cell: string; expected?: string; lookFor?: string; rendered: string; byCode?: string }

export type PieceCall = { cell: string; repeat: number; answer?: string; error?: string; grade?: PieceGrade }

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
    /** The answer code gave, where the cell made no call. */
    byCode?: { answer: string; right: boolean }
    inputs: { hash: string }
}

export type PieceSummary = { calls: number; right: number; wrong: number; malformed: number; errors: number; byCode: number; ungraded: number }

export const runPieceProbe = async ({ cells, instructions, grade, repeats, model, invoke }: {
    cells: readonly PreparedCell[]
    instructions: string
    /** The piece's grade of one reply, given the cell's id. */
    grade: (reply: string, cell: string) => PieceGrade
    repeats: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<PieceCall[]> => (
    (await runProbeCalls({
        prompts: cells.filter(({ byCode }) => byCode === undefined).map(({ cell, rendered }) => ({ id: cell, prompt: `${instructions}\n\n${rendered}` })),
        repeats,
        model,
        ...(invoke !== undefined ? { invoke } : {}),
    })).map(({ id, repeat, answer, error }): PieceCall => (
        answer !== undefined ? { cell: id, repeat, answer, grade: grade(answer, id) } : { cell: id, repeat, error }
    ))
)

export const tallyPiece = (cells: readonly PreparedCell[], calls: readonly PieceCall[]): PieceTally[] => cells.map(({ cell, expected, lookFor, rendered, byCode }) => {
    const graded = calls.filter((call) => call.cell === cell).map(({ grade }) => grade)
    const given = graded.flatMap((grade) => (grade !== undefined && 'answer' in grade ? [grade.answer] : []))
    const right = expected === undefined ? 0 : given.filter((answer) => answer === expected).length
    return {
        cell,
        ...(expected === undefined ? {} : { expected }),
        ...(lookFor === undefined ? {} : { lookFor }),
        n: graded.length,
        right,
        wrong: expected === undefined ? 0 : given.length - right,
        malformed: graded.filter((grade) => grade !== undefined && 'malformed' in grade).length,
        errors: graded.filter((grade) => grade === undefined).length,
        answers: given.reduce<Record<string, number>>((counts, answer) => ({ ...counts, [answer]: (counts[answer] ?? 0) + 1 }), {}),
        ...(byCode === undefined ? {} : { byCode: { answer: byCode, right: byCode === expected } }),
        inputs: { hash: textHash(rendered) },
    }
})

export const summarizePiece = (tallies: readonly PieceTally[]): PieceSummary => tallies.reduce<PieceSummary>((summary, tally) => ({
    calls: summary.calls + tally.n,
    right: summary.right + tally.right,
    wrong: summary.wrong + tally.wrong,
    malformed: summary.malformed + tally.malformed,
    errors: summary.errors + tally.errors,
    byCode: summary.byCode + (tally.byCode === undefined ? 0 : 1),
    ungraded: summary.ungraded + (tally.expected === undefined ? tally.n : 0),
}), { calls: 0, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 0, ungraded: 0 })
