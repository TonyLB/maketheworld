import { calibrationJsonResponse } from '../calibrationResponse'
import { isNovaModel, type NovaModel } from '../../llm/novaModel'
import { MAX_DRAFT_CHARS, isDraftText } from '../sceneReasoning/handlers/runJudgeProbe'
import { textHash } from '../sceneReasoning/runJudgeProbe'
import { PROBE_TEMPERATURE, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import type { OraclePiece } from './oraclePiece'
import { oraclePieces } from './pieces'
import { runPieceProbe, summarizePiece, tallyPiece, type PreparedCell } from './runPieceProbe'

export type PieceProbeEvent = {
    type: 'PieceProbe'
    /** The registered piece's name. */
    piece?: unknown
    /** Cell IDs of the piece; all of its cells by default. */
    cells?: unknown
    /** The draft's instructions, required: a piece has no built prompt. */
    instructions?: unknown
    repeats?: unknown
    model?: unknown
    /** Piece-specific, checked by the piece. */
    options?: unknown
}

export type PieceProbeDeps = { invoke?: ProbeInvoke; pieces?: Record<string, OraclePiece> }

/** The piece probe's own cap (user): a piece's calls are short, and a sign of a piece too big is long calls, not a higher cap. */
export const PIECE_PROBE_CALL_CAP = 24

const refuse = (error: string) => calibrationJsonResponse(400, { error })

/**
 * A draft of one piece against its cells: each cell code doesn't answer is rendered after the instructions and called `repeats` times, and
 * each reply's `Answer:` is read against the piece's answer set and tallied against the cell's expected answer. Every refusal happens before
 * the first call.
 */
export async function handlePieceProbe(event: PieceProbeEvent, deps: PieceProbeDeps = {}) {
    const pieces = deps.pieces ?? oraclePieces
    const names = Object.keys(pieces)
    const piece = typeof event.piece === 'string' ? pieces[event.piece] : undefined
    if (piece === undefined) {
        return refuse(`piece must be one of: ${names.length > 0 ? names.join(', ') : '(none registered)'}`)
    }
    const cellIds = Object.keys(piece.cells)
    const { cells = cellIds } = event
    if (!Array.isArray(cells) || cells.length === 0 || !cells.every((id) => typeof id === 'string' && cellIds.includes(id))) {
        return refuse(`cells must be a non-empty list of ${piece.name}'s cell IDs: ${cellIds.join(', ')}`)
    }
    const asked = [...new Set<string>(cells)]
    if (!isDraftText(event.instructions)) {
        return refuse(`instructions must be a draft: a non-empty string of at most ${MAX_DRAFT_CHARS} characters`)
    }
    const { instructions } = event
    const repeats = event.repeats === undefined ? 1 : event.repeats
    if (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 1) {
        return refuse('repeats must be an integer of at least 1')
    }
    const model: NovaModel = event.model === undefined ? 'NovaMicro' : event.model as NovaModel
    if (!isNovaModel(model)) {
        return refuse('model must be a NovaModel (NovaMicro or Nova2Lite)')
    }
    const options = piece.parseOptions(event.options)
    if (typeof options === 'string') {
        return refuse(options)
    }
    const byCode = new Map(asked.map((id) => [id, piece.byCode?.(piece.cells[id])]))
    const called = asked.filter((id) => byCode.get(id) === undefined).length
    if (called * repeats > PIECE_PROBE_CALL_CAP) {
        return refuse(`${called} called cells x ${repeats} repeats = ${called * repeats} calls, over the cap of ${PIECE_PROBE_CALL_CAP}; trim cells or repeats`)
    }
    const rendered = await Promise.all(asked.map(async (id) => {
        try {
            return { id, text: await piece.render(piece.cells[id], options) }
        } catch (error) {
            return { id, error: error instanceof Error ? error.message : String(error) }
        }
    }))
    const failed = rendered.find(({ error }) => error !== undefined)
    if (failed !== undefined) {
        return refuse(`cell ${failed.id}: the render failed (${failed.error}), a cell-data error`)
    }
    const prepared = rendered.map(({ id, text = '' }): PreparedCell => {
        const answer = byCode.get(id)
        return { cell: id, expected: piece.cells[id].expected, rendered: text, ...(answer === undefined ? {} : { byCode: answer }) }
    })

    const calls = await runPieceProbe({
        cells: prepared, instructions, answers: piece.answers, repeats, model, ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
    })
    const tallies = tallyPiece(prepared, calls)
    return calibrationJsonResponse(200, {
        piece: piece.name,
        model,
        temperature: PROBE_TEMPERATURE,
        repeats,
        options,
        instructions: { hash: textHash(instructions), chars: instructions.length },
        cells: tallies,
        summary: summarizePiece(tallies),
        read: calls,
    })
}
