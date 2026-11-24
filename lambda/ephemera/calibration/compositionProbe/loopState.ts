//
// The composition probe's state (calibration AGENT.md, "Composition probe"): what the pieces share, the request being
// answered, and the log of hops, which is the trace.
//
import type { HopResult, PieceRequest, PieceState } from '../pieceProbe/piecePart'
import type { ReadCall } from '../pieceProbe/readPiece'
import type { ActionPlan } from '../oracleLoop/actionPlan'

/**
 * One hop: the piece probe's record of a call (the reply, and its form problems or its error), with what stands in for a cell. A mocked
 * hop has no rendered text and no reply. A hop with `error` and no rendered text never made its call: its inputs or its render threw.
 */
export type Hop = Pick<ReadCall, 'reply' | 'error' | 'problems'> & {
    piece: string
    /** The request it was given. */
    request?: PieceRequest
    mocked: boolean
    /** The mock's entry that answered, where one did. */
    entry?: string
    /** The prompt after the instructions, and its hash: equal hashes are repeats given identical inputs. */
    rendered?: string
    inputs?: { hash: string }
    /** What it gave, where that isn't a plan. */
    gave?: Exclude<HopResult, { plan: ActionPlan }>
    /** What the request said that the piece's inputs have no place for. */
    unread?: Partial<PieceRequest>
    /** The plan after the hop: the next hop's, and what is lifted into a piece's cell. */
    plan: ActionPlan
}

export type LoopState = { shared: PieceState; request?: PieceRequest; log: readonly Hop[] }

export const startState = (shared: PieceState): LoopState => ({ shared, log: [] })

/** A hop's own record, before what its result does: the plan after it is the state's. */
export type HopRecord = Omit<Hop, 'plan' | 'gave'>

/**
 * The state after a hop. A plan replaces the plan, and answers the request; a judge's request becomes the request; a verdict changes neither.
 * A hop with no result (a form fault, an error) is logged, and changes nothing else.
 */
export const applyResult = (state: LoopState, record: HopRecord, result?: HopResult): LoopState => {
    const { shared, request, log } = state
    if (result === undefined) {
        return { ...state, log: [...log, { ...record, plan: shared.plan }] }
    }
    if ('plan' in result) {
        return { shared: { ...shared, plan: result.plan }, log: [...log, { ...record, plan: result.plan }] }
    }
    const hop: Hop = { ...record, gave: result, plan: shared.plan }
    const asked = 'request' in result ? result.request : request
    return { shared, ...(asked === undefined ? {} : { request: asked }), log: [...log, hop] }
}
