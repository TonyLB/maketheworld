//
// The piece probe's run and tally for a read piece: one Bedrock call per (cell, repeat), each reply checked for form by the piece, then
// a form tally per cell and the replies grouped by cell, which is what the reader reads. Nothing here grades a reply's content.
//
import type { NovaModel } from '../../llm/novaModel'
import { runProbeCalls } from '../oracleLoop/runOracleProbe'
import { textHash } from '../sceneReasoning/runJudgeProbe'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'

/** A cell of a read piece ready to run: what a reader looks for, and its rendered inputs. */
export type PreparedReadCell = { cell: string; lookFor: string; rendered: string }

export type ReadCall = { cell: string; repeat: number; reply?: string; error?: string; problems?: string[] }

export type ReadTally = {
    cell: string
    lookFor: string
    n: number
    formPasses: number
    formFails: number
    /** Each form failure's reasons, with the repeat it came from. */
    failures: { repeat: number; problems: string[] }[]
    errors: number
    inputs: { hash: string }
}

export type ReadSummary = { calls: number; formFails: number; errors: number }

export type ReadGroup = { cell: string; lookFor: string; replies: { repeat: number; reply?: string; error?: string; problems?: string[] }[] }

export const runReadPiece = async ({ cells, instructions, check, repeats, model, invoke }: {
    cells: readonly PreparedReadCell[]
    instructions: string
    /** The piece's form check of one reply, given the cell's id. */
    check: (reply: string, cell: string) => string[]
    repeats: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<ReadCall[]> => (
    (await runProbeCalls({
        prompts: cells.map(({ cell, rendered }) => ({ id: cell, prompt: `${instructions}\n\n${rendered}` })),
        repeats,
        model,
        ...(invoke !== undefined ? { invoke } : {}),
    })).map(({ id, repeat, answer, error }): ReadCall => (
        answer !== undefined ? { cell: id, repeat, reply: answer, problems: check(answer, id) } : { cell: id, repeat, error }
    ))
)

export const tallyRead = (cells: readonly PreparedReadCell[], calls: readonly ReadCall[]): ReadTally[] => cells.map(({ cell, lookFor, rendered }) => {
    const mine = calls.filter((call) => call.cell === cell)
    const failures = mine.flatMap(({ repeat, problems }) => (problems !== undefined && problems.length > 0 ? [{ repeat, problems }] : []))
    const checked = mine.filter(({ problems }) => problems !== undefined).length
    return {
        cell,
        lookFor,
        n: mine.length,
        formPasses: checked - failures.length,
        formFails: failures.length,
        failures,
        errors: mine.length - checked,
        inputs: { hash: textHash(rendered) },
    }
})

export const summarizeRead = (tallies: readonly ReadTally[]): ReadSummary => tallies.reduce<ReadSummary>((summary, tally) => ({
    calls: summary.calls + tally.n,
    formFails: summary.formFails + tally.formFails,
    errors: summary.errors + tally.errors,
}), { calls: 0, formFails: 0, errors: 0 })

/** The replies grouped by cell in the order asked, each with its look-for, for reading. */
export const groupRead = (cells: readonly PreparedReadCell[], calls: readonly ReadCall[]): ReadGroup[] => cells.map(({ cell, lookFor }) => ({
    cell,
    lookFor,
    replies: calls.filter((call) => call.cell === cell).map(({ repeat, reply, error, problems }) => ({
        repeat,
        ...(reply !== undefined ? { reply, problems } : { error }),
    })),
}))
