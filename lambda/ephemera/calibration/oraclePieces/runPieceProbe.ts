//
// The piece probe's run and tally: one Bedrock call per (cell, repeat) for each cell code doesn't answer, each graded by `pieceAnswer`,
// then a tally per cell against its expected answer, which is what the reader reads first.
//
import type { NovaModel } from '../../llm/novaModel'
import { runProbeCalls } from '../oracleLoop/runOracleProbe'
import { textHash } from '../sceneReasoning/runJudgeProbe'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { pieceAnswer, type PieceGrade } from './pieceAnswer'

/** A cell ready to run: its rendered inputs, or the answer code gave in place of a call. */
export type PreparedCell = { cell: string; expected: string; rendered: string; byCode?: string }

export type PieceCall = { cell: string; repeat: number; answer?: string; error?: string; grade?: PieceGrade }

export type PieceTally = {
    cell: string
    expected: string
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

export type PieceSummary = { calls: number; right: number; wrong: number; malformed: number; errors: number; byCode: number }

export const runPieceProbe = async ({ cells, instructions, answers, repeats, model, invoke }: {
    cells: readonly PreparedCell[]
    instructions: string
    answers: readonly string[]
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
        answer !== undefined ? { cell: id, repeat, answer, grade: pieceAnswer(answer, answers) } : { cell: id, repeat, error }
    ))
)

export const tallyPiece = (cells: readonly PreparedCell[], calls: readonly PieceCall[]): PieceTally[] => cells.map(({ cell, expected, rendered, byCode }) => {
    const graded = calls.filter((call) => call.cell === cell).map(({ grade }) => grade)
    const given = graded.flatMap((grade) => (grade !== undefined && 'answer' in grade ? [grade.answer] : []))
    return {
        cell,
        expected,
        n: graded.length,
        right: given.filter((answer) => answer === expected).length,
        wrong: given.filter((answer) => answer !== expected).length,
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
}), { calls: 0, right: 0, wrong: 0, malformed: 0, errors: 0, byCode: 0 })
