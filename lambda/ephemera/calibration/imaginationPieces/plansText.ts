//
// A batch's replies for reading (`read-plans`), shared by the pieces whose contract merges into a plan (calibration
// AGENT.md, "The action plan"): a leaf module, so each piece builds its own from its cells and contract.
//
import type { StageContract } from '../../llm/stageContract'
import type { ReadGroup } from '../pieceProbe/readPiece'
import type { PieceCall } from '../pieceProbe/runPieceProbe'

/** What of a piece, read or answered, it takes to print its plans. */
type PlansPiece<Inputs, Options, Cell extends { inputs: Inputs }> = {
    name: string
    cells: Record<string, Cell>
    parseOptions: (value: unknown) => Options | string
    render: (cell: Cell, options: Options) => Promise<string>
}

/** A response's `read`: a read piece's groups, or an answered piece's calls, which are grouped by cell in the order they come. */
export type PlansRead = readonly ReadGroup[] | readonly PieceCall[]

const isGroup = (entry: ReadGroup | PieceCall): entry is ReadGroup => 'replies' in entry

const groupsOf = (read: PlansRead): Pick<ReadGroup, 'cell' | 'replies'>[] => {
    const entries: readonly (ReadGroup | PieceCall)[] = read
    const calls = entries.flatMap((entry) => (isGroup(entry) ? [] : [entry]))
    return [
        ...entries.filter(isGroup),
        ...[...new Set(calls.map(({ cell }) => cell))].map((cell) => ({
            cell, replies: calls.filter((call) => call.cell === cell).map(({ repeat, answer, error }) => ({ repeat, reply: answer, error })),
        })),
    ]
}

/**
 * Per cell and repeat, what the contract builds, as `text` prints it (the plan as a generator would read it), or why none. Each cell is rendered with the batch's
 * options, as the probe's check is, since the contract reads the prompt it was shown (the rule handles the scene tags, for one).
 */
export const plansText = <Inputs, Options, Output, Cell extends { inputs: Inputs }>(
    piece: PlansPiece<Inputs, Options, Cell>, contract: StageContract<Inputs, Output>, text: (value: Output, inputs: Inputs) => string | Promise<string>,
) =>
    async (read: PlansRead, options?: unknown): Promise<string> => {
        const parsedOptions = piece.parseOptions(options)
        if (typeof parsedOptions === 'string') {
            throw new Error(parsedOptions)
        }
        const texts = await Promise.all(groupsOf(read).map(async ({ cell, replies }) => {
            const known = piece.cells[cell]
            const rendered = known === undefined ? undefined : await piece.render(known, parsedOptions)
            return Promise.all(replies.map(async ({ repeat, reply, error }) => {
                const heading = `## ${cell}, repeat ${repeat}`
                if (known === undefined || rendered === undefined) {
                    return `${heading}\nnot a ${piece.name} cell`
                }
                if (reply === undefined) {
                    return `${heading}\nerror: ${error ?? 'no reply'}`
                }
                const parsed = contract.parse(reply, { input: known.inputs, rendered })
                return 'value' in parsed ? `${heading}\n${await text(parsed.value, known.inputs)}` : `${heading}\nform: ${parsed.problems.join('; ')}`
            }))
        }))
        return texts.flat().join('\n\n')
    }
