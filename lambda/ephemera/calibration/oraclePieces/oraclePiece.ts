//
// The piece probe's registration (a Prototype of the oracle loop plan's Slice 4.5): a piece of the oracle that makes one
// judgment per call, plugged into the probe with its cells, its closed answer set, and how to render a cell after the draft's instructions.
//

/** One case a piece is graded on: its inputs, the answer it should give, where it was lifted from, and a note for the reader. */
export type PieceCell<Inputs = unknown> = {
    inputs: Inputs
    /** One of the piece's `answers`. Graded given the inputs, even where the inputs are wrong about the case. */
    expected: string
    /** The batch and reply the cell was lifted from, or `hand-written`. */
    source: string
    note?: string
}

export type OraclePiece<Inputs = unknown, Options = unknown> = {
    name: string
    /** The closed answer set a reply's `Answer:` line is read against. */
    answers: readonly string[]
    cells: Record<string, PieceCell<Inputs>>
    /** Checks the event's `options` (absent as `undefined`), giving the piece's options or a refusal. */
    parseOptions: (value: unknown) => Options | string
    /** The prompt text after the instructions. Async, so it can build a fixture's scene. */
    render: (cell: PieceCell<Inputs>, options: Options) => Promise<string>
    /** An answer code gives without a call, such as for an empty window; `undefined` when the cell needs a call. */
    byCode?: (cell: PieceCell<Inputs>) => string | undefined
}

/** Erases a piece's own types for the registry, which only passes a piece's cells and options back to that same piece. */
export const registerPiece = <Inputs, Options>(piece: OraclePiece<Inputs, Options>): OraclePiece => piece as unknown as OraclePiece
