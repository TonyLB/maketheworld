//
// A piece's part in the composition probe (AGENT.compositionProbe.planning.md, "The idea"): what a piece declares, beside its view, to be
// called by a loop that chains calls. It says which requests the piece answers and what its result does to the state, never what comes
// after it: succession is the loop's alone (`compositionProbe/next.ts`), and nothing here assumes an order or that a piece runs once.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import type { StageContract } from '../../llm/stageContract'
import type { ActionPlan } from '../oracleLoop/actionPlan'

/** The kinds of request a judge can make (the non-rule cell plan's first kinds): more detail of the action, or of its consequences. */
export const REQUEST_KINDS = ['action', 'consequences'] as const
export type RequestKind = typeof REQUEST_KINDS[number]

/** A judge's request: its kind, the path of the step it turns on, and the detail that is missing. */
export type PieceRequest = { kind: RequestKind; target: string; missing: string }

/**
 * What a piece builds its inputs from, beside the request. The plan is the only part a hop changes; the rest is the case's, listed by hand
 * as the pieces' cells list theirs. It holds no log, so a hop can't read an earlier call's reasoning.
 */
export type PieceState = {
    fixture: string
    plan: ActionPlan
    /** The things to describe (`consequences`). */
    things: readonly SceneHandle[]
    /** The other things the scene shows (`playByPlay`). */
    alsoShown: readonly SceneHandle[]
}

/**
 * What a hop gives the state: a judge's verdict or request, or a generator's plan. The verdict and the request are a stand-in for a judge's
 * answer, not a design of one: the judges' own plans settle theirs, and this type follows them.
 */
export type HopResult = { verdict: 'allows' | 'blocks' } | { request: PieceRequest } | { plan: ActionPlan }

export type PiecePart<Inputs = unknown, Output = unknown> = {
    /** The request kinds it answers; none for a judge. */
    answers: readonly RequestKind[]
    /** Its inputs, from the state and the request. A judge is given no request. */
    inputs: (state: PieceState, request: PieceRequest | undefined) => Inputs
    /** Its contract, which a reply comes through. */
    contract: StageContract<Inputs, Output>
    /** What its contract's value does to the state. */
    result: (output: Output) => HopResult
    /** The request's fields its inputs have no place for, kept in the trace. */
    unread?: readonly (keyof PieceRequest)[]
}

/** Erases a part's output, for a registration: only the part's own `result` reads its contract's value. */
export const piecePart = <Inputs, Output>(part: PiecePart<Inputs, Output>): PiecePart<Inputs> => part as unknown as PiecePart<Inputs>

/** The request a generator answers: calling one without is the caller's error. */
export const requested = (piece: string, request: PieceRequest | undefined): PieceRequest => {
    if (request === undefined) {
        throw new Error(`${piece} answers a request, and was given none`)
    }
    return request
}
