import { calibrationJsonResponse } from '../calibrationResponse'
import { isNovaModel, type NovaModel } from '../../llm/novaModel'
import { MAX_DRAFT_CHARS, isDraftText } from '../sceneReasoning/handlers/runJudgeProbe'
import { textHash } from '../textHash'
import { PROBE_TEMPERATURE, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { joinParts, type Delivery, type RegisteredPiece, type RegistryEntry, type RenderedParts } from './oraclePiece'
import { pieceAnswer } from './pieceAnswer'
import { pieces as registeredPieces } from './pieces'
import { groupRead, runReadPiece, summarizeRead, tallyRead, type PreparedReadCell } from './readPiece'
import { runPieceProbe, summarizePiece, tallyPiece, type PreparedCell } from './runPieceProbe'

export type PieceProbeEvent = {
    type: 'PieceProbe'
    /** The registered piece's name, or a family's. */
    piece?: unknown
    /** Cell IDs of the piece; all of its cells by default. */
    cells?: unknown
    /** The draft's instructions, required: a piece has no built prompt. */
    instructions?: unknown
    repeats?: unknown
    model?: unknown
    /**
     * `user` (the default) or `system`: under `system`, the instructions and the render's system part go as system instructions and its
     * user part as the user message. Refused for a piece without `renderParts`.
     */
    delivery?: unknown
    /** Piece-specific, checked by the piece. A family's options name the stage in `stage`, and the rest are that stage's. */
    options?: unknown
}

export type PieceProbeDeps = { invoke?: ProbeInvoke; pieces?: Record<string, RegistryEntry> }

/**
 * The piece a payload runs: a plain piece as registered, or a family's stage named by `options.stage`, with the rest of the options for
 * that stage's `parseOptions`. A refusal when a family's stage is missing or isn't one of its stages.
 */
export const resolvePiece = (entry: RegistryEntry, options: unknown): { piece: RegisteredPiece; options: unknown; stage?: string } | string => {
    if (entry.kind !== 'family') {
        return { piece: entry, options }
    }
    const stages = Object.keys(entry.stages)
    const { stage, ...rest } = typeof options === 'object' && options !== null && !Array.isArray(options) ? options as Record<string, unknown> : {} as Record<string, unknown>
    if (typeof stage !== 'string' || !stages.includes(stage)) {
        return `${entry.name} is a family: options.stage must be one of: ${stages.join(', ')}`
    }
    return { piece: entry.stages[stage], options: rest, stage }
}

/** The piece probe's own cap (user): a piece's calls are short, and a sign of a piece too big is long calls, not a higher cap. */
export const PIECE_PROBE_CALL_CAP = 24

const refuse = (error: string) => calibrationJsonResponse(400, { error })

/**
 * A draft of one piece against its cells: each cell code doesn't answer is rendered after the instructions and called `repeats` times, and
 * each reply's `Answer:` is read against the piece's answer set and tallied against the cell's expected answer. Every refusal happens before
 * the first call. A piece with its own `grade` is graded by it in place of the `Answer:` read.
 */
export async function handlePieceProbe(event: PieceProbeEvent, deps: PieceProbeDeps = {}) {
    const pieces = deps.pieces ?? registeredPieces
    const names = Object.keys(pieces)
    const entry = typeof event.piece === 'string' ? pieces[event.piece] : undefined
    if (entry === undefined) {
        return refuse(`piece must be one of: ${names.length > 0 ? names.join(', ') : '(none registered)'}`)
    }
    const resolved = resolvePiece(entry, event.options)
    if (typeof resolved === 'string') {
        return refuse(resolved)
    }
    const { piece, stage } = resolved
    /** How the response names what ran: a family's name with its stage, or the piece's name. */
    const ran = stage === undefined ? { piece: piece.name } : { piece: entry.name, stage }
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
    const deliveryValue = event.delivery === undefined ? 'user' : event.delivery
    if (deliveryValue !== 'user' && deliveryValue !== 'system') {
        return refuse('delivery must be user or system')
    }
    const delivery: Delivery = deliveryValue
    if (delivery === 'system' && piece.renderParts === undefined) {
        return refuse(`delivery system needs a piece that renders its two parts: ${stage === undefined ? piece.name : `${entry.name}'s ${stage} stage`} has no renderParts`)
    }
    const options = piece.parseOptions(resolved.options)
    if (typeof options === 'string') {
        return refuse(options)
    }
    const byCode = new Map(asked.map((id) => [id, piece.kind === 'read' ? undefined : piece.byCode?.(piece.cells[id])]))
    const called = asked.filter((id) => byCode.get(id) === undefined).length
    if (called * repeats > PIECE_PROBE_CALL_CAP) {
        return refuse(`${called} called cells x ${repeats} repeats = ${called * repeats} calls, over the cap of ${PIECE_PROBE_CALL_CAP}; trim cells or repeats`)
    }
    /**
     * One cell's render: under system delivery, its two parts, built once, and their join as its text; otherwise its render. A piece
     * without `renderParts` was refused system delivery above.
     */
    const renderCell = async (id: string): Promise<{ text: string; parts?: RenderedParts }> => {
        if (delivery === 'system') {
            const parts = await (piece.kind === 'read' ? piece.renderParts!(piece.cells[id], options) : piece.renderParts!(piece.cells[id], options))
            return { text: joinParts(parts), parts }
        }
        return { text: await (piece.kind === 'read' ? piece.render(piece.cells[id], options) : piece.render(piece.cells[id], options)) }
    }
    const rendered = await Promise.all(asked.map(async (id): Promise<{ id: string; text?: string; parts?: RenderedParts; error?: string }> => {
        try {
            return { id, ...await renderCell(id) }
        } catch (error) {
            return { id, error: error instanceof Error ? error.message : String(error) }
        }
    }))
    const failed = rendered.find(({ error }) => error !== undefined)
    if (failed !== undefined) {
        return refuse(`cell ${failed.id}: the render failed (${failed.error}), a cell-data error`)
    }
    if (piece.kind === 'read') {
        const readCells = rendered.map(({ id, text = '', parts }): PreparedReadCell => ({ cell: id, lookFor: piece.cells[id].lookFor, rendered: text, ...(parts === undefined ? {} : { parts }) }))
        const readCalls = await runReadPiece({
            cells: readCells, instructions, repeats, model, check: (reply, id) => piece.check(reply, piece.cells[id], readCells.find(({ cell }) => cell === id)?.rendered ?? '', options),
            ...(piece.maxTokens !== undefined ? { maxTokens: piece.maxTokens } : {}),
            ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
        })
        const readTallies = tallyRead(readCells, readCalls)
        return calibrationJsonResponse(200, {
            ...ran,
            model,
            temperature: PROBE_TEMPERATURE,
            repeats,
            delivery,
            options,
            instructions: { hash: textHash(instructions), chars: instructions.length },
            cells: readTallies,
            summary: summarizeRead(readTallies),
            read: groupRead(readCells, readCalls),
        })
    }
    const prepared = rendered.map(({ id, text = '', parts }): PreparedCell => {
        const answer = byCode.get(id)
        const { expected, expectedAspects, lookFor } = piece.cells[id]
        return {
            cell: id,
            ...(expected === undefined ? {} : { expected }),
            ...(expectedAspects === undefined ? {} : { expectedAspects }),
            ...(lookFor === undefined ? {} : { lookFor }),
            rendered: text,
            ...(parts === undefined ? {} : { parts }),
            ...(answer === undefined ? {} : { byCode: answer }),
        }
    })
    const grade = (reply: string, id: string) => (piece.grade !== undefined ? piece.grade(reply, piece.cells[id], prepared.find(({ cell }) => cell === id)?.rendered ?? '', options) : pieceAnswer(reply, piece.answers))

    const calls = await runPieceProbe({
        cells: prepared, instructions, grade, repeats, model,
        ...(piece.maxTokens !== undefined ? { maxTokens: piece.maxTokens } : {}),
        ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
    })
    const tallies = tallyPiece(prepared, calls)
    return calibrationJsonResponse(200, {
        ...ran,
        model,
        temperature: PROBE_TEMPERATURE,
        repeats,
        delivery,
        options,
        instructions: { hash: textHash(instructions), chars: instructions.length },
        cells: tallies,
        summary: summarizePiece(tallies),
        read: calls,
    })
}
