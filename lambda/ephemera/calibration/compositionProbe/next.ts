//
// The composition probe's one choice (calibration AGENT.md, "Composition probe"): given the state, a call or a reason to stop. It
// is code, and pure: where an LLM's response makes a choice (a judge's request), this turns it into a call. A piece never names its successor.
//
import type { PieceRequest, RequestKind } from '../pieceProbe/piecePart'
import type { Hop, LoopState } from './loopState'
import { matchMock, type Mock, type MockEntry } from './mocks'

export type StopReason =
    | { reason: 'verdict'; verdict: 'allows' | 'blocks' }
    | { reason: 'formFault'; piece: string; problems: string[] }
    /** A call that failed, or a piece whose inputs, render or contract threw. */
    | { reason: 'error'; piece: string; error: string }
    /** No piece or mock answers: the piece asked for, with the request it was to answer, or no piece when nothing answers the request's kind. */
    | { reason: 'nothingAnswers'; piece?: string; request?: PieceRequest }
    | { reason: 'cap'; cap: number }

/** A call: the piece, the request it answers, and the mock's entry where it is mocked. */
export type LoopCall = { piece: string; request?: PieceRequest; mock?: MockEntry }

/** Who takes part in a run: the judge's name, the live pieces' names, the mocks, and who answers each kind of request. */
export type Cast = { judge: string; live: readonly string[]; mocks: readonly Mock[]; answers: Partial<Record<RequestKind, string>> }

/** A run's cast. Refuses a piece both live and mocked, and a request kind two pieces answer, since the choice between them has no rule. */
export const castOf = (judge: string, live: readonly { piece: string; answers: readonly RequestKind[] }[], mocks: readonly Mock[]): Cast => {
    const all = [...live, ...mocks]
    const twice = all.find(({ piece }, index) => all.findIndex((other) => other.piece === piece) !== index)
    if (twice !== undefined) {
        throw new Error(`${twice.piece} is supplied twice`)
    }
    return {
        judge,
        live: live.map(({ piece }) => piece),
        mocks,
        answers: all.reduce<Cast['answers']>((answers, { piece, answers: kinds }) => kinds.reduce((built, kind) => {
            if (built[kind] !== undefined) {
                throw new Error(`Two pieces answer a request for ${kind}: ${built[kind]}, ${piece}`)
            }
            return { ...built, [kind]: piece }
        }, answers), {}),
    }
}

/** Why the last hop ends the run, where it does. */
const endedBy = ({ log }: LoopState): StopReason | undefined => {
    const last: Hop | undefined = log[log.length - 1]
    if (last === undefined) {
        return undefined
    }
    const { piece, error, problems = [], gave } = last
    if (error !== undefined) {
        return { reason: 'error', piece, error }
    }
    if (problems.length > 0) {
        return { reason: 'formFault', piece, problems }
    }
    return gave !== undefined && 'verdict' in gave ? { reason: 'verdict', verdict: gave.verdict } : undefined
}

/**
 * The next call, or why there is none. With no request to answer (the start, or after a plan) it is the judge's; otherwise the piece's that
 * answers that kind. The cap counts every hop, mocked ones included, and stops only a call that would be made.
 */
export const next = (state: LoopState, { judge, live, mocks, answers }: Cast, cap: number): { call: LoopCall } | { stop: StopReason } => {
    const ended = endedBy(state)
    if (ended !== undefined) {
        return { stop: ended }
    }
    const { shared, request, log } = state
    const piece = request === undefined ? judge : answers[request.kind]
    const asked = { ...(piece === undefined ? {} : { piece }), ...(request === undefined ? {} : { request }) }
    const mocked = mocks.find((mock) => mock.piece === piece)
    const mock = mocked === undefined ? undefined : matchMock(mocked, shared, request)
    if (piece === undefined || (mock === undefined && !live.includes(piece))) {
        return { stop: { reason: 'nothingAnswers', ...asked } }
    }
    return log.length >= cap ? { stop: { reason: 'cap', cap } } : { call: { piece, ...(request === undefined ? {} : { request }), ...(mock === undefined ? {} : { mock }) } }
}
