//
// The piece probe's registration (a Prototype of the oracle loop plan's Slice 4.5): a piece of the oracle that makes one
// judgment per call, plugged into the probe with its cells and how to render a cell after the draft's instructions. A piece is
// either answered (a closed answer set, tallied by code against each cell's expected answer) or read (no answer set: code checks
// each reply's form, and a reader reads the replies against each cell's `lookFor`).
//
import type { PieceGrade } from './pieceAnswer'

/** The shared part of a cell: its inputs, where it was lifted from, and a note for the reader. */
type PieceCellBase<Inputs> = {
    inputs: Inputs
    /** The batch and reply the cell was lifted from, or `hand-written`. */
    source: string
    note?: string
}

/** One case an answered piece is graded on: its inputs, and the answer it should give. */
export type PieceCell<Inputs = unknown> = PieceCellBase<Inputs> & {
    /**
     * The answer as the piece's grade gives it: one of its `answers`, or its own canonical form where it has a `grade`. Graded given the
     * inputs, even where the inputs are wrong about the case. Absent for a cell whose answer is open: its calls are tallied, not graded.
     */
    expected?: string
    /** What a reader looks for in the parts of a reply code doesn't grade, written before the batch. Code doesn't read it. */
    lookFor?: string
}

/** A cell of a read piece: in place of an expected answer, what a reader looks for in its replies, written before the batch. */
export type ReadPieceCell<Inputs = unknown> = PieceCellBase<Inputs> & { lookFor: string }

/** An answered piece: a closed answer set, and an expected answer per cell. */
export type OraclePiece<Inputs = unknown, Options = unknown> = {
    kind?: 'answered'
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
    /**
     * The piece's own grade of one reply, given its cell, the cell's rendered text and the payload's options (as a read piece's `check`
     * has them), in place of `pieceAnswer` against `answers`: for answers with parameters, or a stage's contract parse.
     */
    grade?: (reply: string, cell: PieceCell<Inputs>, rendered: string, options: Options) => PieceGrade
    /** The output cap per call, where the piece's replies run longer than the judge probe's 512 tokens. */
    maxTokens?: number
}

/**
 * A read piece: no answer set. `check` gives the form problems of one reply, given its cell, the cell's rendered text (for a check
 * that matches quotes against what the prompt showed) and the payload's options (for a stage resolving its upstream input), and none
 * when the reply passes.
 */
export type ReadPiece<Inputs = unknown, Options = unknown> = {
    kind: 'read'
    name: string
    cells: Record<string, ReadPieceCell<Inputs>>
    check: (reply: string, cell: ReadPieceCell<Inputs>, rendered: string, options: Options) => string[]
    parseOptions: (value: unknown) => Options | string
    render: (cell: ReadPieceCell<Inputs>, options: Options) => Promise<string>
    /** The output cap per call, where the piece's replies run longer than the judge probe's 512 tokens. */
    maxTokens?: number
}

/** A registered piece, answered or read. */
export type RegisteredPiece = OraclePiece | ReadPiece

/**
 * A family of pieces under one name (the trial, AGENT.nonRuleCell.planning.md, Slice A; the user's idea, 2026-11-16): stages that share
 * their cells' inputs, each a piece of its own with its own render, check and cap. A payload names the stage in `options.stage`, and the
 * rest of its options are that stage's. Each payload runs exactly one stage: an earlier stage's part is a recorded value, never a live call.
 */
export type PieceFamily = { kind: 'family'; name: string; stages: Record<string, RegisteredPiece> }

/** What the probe registry holds: a piece, or a family of them. */
export type RegistryEntry = RegisteredPiece | PieceFamily

/** A family from its stages, each already registered, in their order. */
export const registerFamily = (name: string, stages: Record<string, RegisteredPiece>): PieceFamily => ({ kind: 'family', name, stages })

/** Erases a piece's own types for the registry, which only passes a piece's cells and options back to that same piece. */
export function registerPiece<Inputs, Options>(piece: OraclePiece<Inputs, Options>): OraclePiece
export function registerPiece<Inputs, Options>(piece: ReadPiece<Inputs, Options>): ReadPiece
export function registerPiece(piece: OraclePiece<any, any> | ReadPiece<any, any>): RegisteredPiece {
    return piece as unknown as RegisteredPiece
}
