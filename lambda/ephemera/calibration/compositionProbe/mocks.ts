//
// Mocks for the composition probe (calibration AGENT.md, "Composition probe"): they stand in for pieces that don't exist. A mock gives a
// result, not a reply, which the loop applies as it does a live piece's; a mocked generator makes its plan through the real merge. An entry
// matches on the state the pieces share and the request, and is never shown the log, so it can't turn on how many hops have run. It finds
// its step in the state, since a step restated in new words has a path minted afresh.
//
import type { HopResult, PieceRequest, PieceState, RequestKind } from '../pieceProbe/piecePart'

export type MockEntry = {
    /** Names the entry in the trace. */
    name: string
    when: (state: PieceState, request: PieceRequest | undefined) => boolean
    give: (state: PieceState, request: PieceRequest | undefined) => HopResult
}

/** A mocked piece: its name, the request kinds it answers (none for a judge), and its entries, the first that matches answering. */
export type Mock = { piece: string; answers: readonly RequestKind[]; entries: readonly MockEntry[] }

export const matchMock = ({ entries }: Mock, state: PieceState, request: PieceRequest | undefined): MockEntry | undefined => entries.find(({ when }) => when(state, request))
