//
// The composition probe's loop (calibration AGENT.md, "Composition probe"): it runs what pieces register with it, one fresh call per hop, until
// `next` gives a reason to stop. It never changes what a piece is asked, shows or accepts: a piece builds its own inputs, renders through its
// own view, and its contract reads the reply.
//
import type { NovaModel } from '../../llm/novaModel'
import { runProbeCalls } from '../oracleLoop/runOracleProbe'
import { promptFor, type ReadPiece } from '../pieceProbe/oraclePiece'
import type { HopResult, PiecePart, PieceRequest, PieceState } from '../pieceProbe/piecePart'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { textHash } from '../textHash'
import { applyResult, startState, type Hop, type HopRecord, type LoopState } from './loopState'
import type { Mock } from './mocks'
import { castOf, next, type LoopCall, type StopReason } from './next'

/** A live piece as a run supplies it: its registration, its draft's instructions, and its options, parsed by the piece. */
export type LivePiece = { piece: ReadPiece; instructions: string; options?: unknown }

export type LoopRun = { case: string; start: PieceState; hops: readonly Hop[]; stop: StopReason }

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** A hop's record, and what it gave where it gave something. */
type Hopped = { record: HopRecord; result?: HopResult }

/** The request's fields the piece's inputs have no place for, with what they said. */
const unreadOf = ({ unread = [] }: PiecePart, request: PieceRequest | undefined): Pick<HopRecord, 'unread'> =>
    (request === undefined || unread.length === 0 ? {} : { unread: Object.fromEntries(unread.map((field) => [field, request[field]])) })

const partOf = ({ name, part }: ReadPiece): PiecePart => {
    if (part === undefined) {
        throw new Error(`${name} declares no part, so it can't be called in a loop`)
    }
    return part
}

/** A mocked hop: the entry's result. Its state and request are all it sees. */
const mockHop = ({ piece, request }: LoopCall, mock: NonNullable<LoopCall['mock']>, shared: PieceState): Hopped => {
    const record: HopRecord = { piece, ...(request === undefined ? {} : { request }), mocked: true, entry: mock.name }
    try {
        return { record, result: mock.give(shared, request) }
    } catch (error) {
        return { record: { ...record, error: errorText(error) } }
    }
}

/** A live hop: the piece's inputs, its render, one call, and its contract's read of the reply. A throw, at any of them, is the hop's error. */
const liveHop = async ({ piece: name, request }: LoopCall, { piece, instructions, options }: LivePiece, shared: PieceState, { model, invoke }: { model: NovaModel; invoke?: ProbeInvoke }): Promise<Hopped> => {
    const part = partOf(piece)
    const asked: HopRecord = { piece: name, ...(request === undefined ? {} : { request }), mocked: false, ...unreadOf(part, request) }
    const made = await (async (): Promise<{ inputs: unknown; rendered: string } | { error: string }> => {
        try {
            const parsedOptions = piece.parseOptions(options)
            if (typeof parsedOptions === 'string') {
                throw new Error(parsedOptions)
            }
            const inputs = part.inputs(shared, request)
            // A hop stands in for a cell: nothing grades it, so it has no look-for of its own.
            return { inputs, rendered: await piece.render({ inputs, source: 'a composition probe hop', lookFor: '' }, parsedOptions) }
        } catch (error) {
            return { error: errorText(error) }
        }
    })()
    if ('error' in made) {
        return { record: { ...asked, error: made.error } }
    }
    const { inputs, rendered } = made
    const shown: HopRecord = { ...asked, rendered, inputs: { hash: textHash(rendered) } }
    try {
        const [{ answer, error }] = await runProbeCalls({
            prompts: [{ id: name, ...promptFor(instructions, { rendered }) }],
            repeats: 1,
            model,
            ...(piece.maxTokens !== undefined ? { maxTokens: piece.maxTokens } : {}),
            ...(invoke !== undefined ? { invoke } : {}),
        })
        if (answer === undefined) {
            return { record: { ...shown, error: error ?? 'no reply' } }
        }
        const replied: HopRecord = { ...shown, reply: answer }
        try {
            const parsed = part.contract.parse(answer, { input: inputs, rendered })
            return 'problems' in parsed ? { record: { ...replied, problems: parsed.problems } } : { record: { ...replied, problems: [] }, result: part.result(parsed.value) }
        } catch (thrown) {
            return { record: { ...replied, error: errorText(thrown) } }
        }
    } catch (thrown) {
        return { record: { ...shown, error: errorText(thrown) } }
    }
}

/**
 * One chain: the case's start, its hops and why it stopped. `pieces` are the live ones, by name. A cast with a clash, or a live piece with no
 * part, is the caller's error and throws before any call; once a run has started, a throw is a hop's error and ends it.
 */
export const runLoop = async ({ caseId, start, judge, pieces, mocks, cap, model, invoke }: {
    caseId: string
    start: PieceState
    judge: string
    pieces: Record<string, LivePiece>
    mocks: readonly Mock[]
    /** The most hops a run may take, mocked ones included. */
    cap: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<LoopRun> => {
    const cast = castOf(judge, Object.entries(pieces).map(([piece, { piece: registered }]) => ({ piece, answers: partOf(registered).answers })), mocks)
    const run = async (state: LoopState): Promise<LoopRun> => {
        const step = next(state, cast, cap)
        if ('stop' in step) {
            return { case: caseId, start, hops: state.log, stop: step.stop }
        }
        const { call } = step
        const { record, result } = call.mock !== undefined
            ? mockHop(call, call.mock, state.shared)
            : await liveHop(call, pieces[call.piece], state.shared, { model, ...(invoke !== undefined ? { invoke } : {}) })
        return run(applyResult(state, record, result))
    }
    return run(startState(start))
}
