//
// The composition probe's event (AGENT.compositionProbe.planning.md, step 2): chains of the live pieces a payload names, with its drafts, on
// the composition cases, `repeats` times each. Every refusal happens before the first call. Once a chain runs, however it stops is a result.
//
import { isNovaModel, type NovaModel } from '../../llm/novaModel'
import { calibrationJsonResponse } from '../calibrationResponse'
import { resolvePiece } from '../pieceProbe/handlePieceProbe'
import type { RegistryEntry } from '../pieceProbe/oraclePiece'
import { pieces as registeredPieces } from '../pieceProbe/pieces'
import { MAX_DRAFT_CHARS, isDraftText } from '../sceneReasoning/handlers/runJudgeProbe'
import { PROBE_TEMPERATURE, PROBE_TIMEOUT_MS, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { textHash } from '../textHash'
import { compositionCases, JUDGE, type CompositionCase } from './compositionCases'
import { castOf, type StopReason } from './next'
import { runLoop, type LivePiece, type LoopRun } from './runLoop'

export type CompositionProbeEvent = {
    type: 'CompositionProbe'
    /** Composition case IDs; all of them by default. */
    cases?: unknown
    repeats?: unknown
    model?: unknown
    /** The live pieces by registered name, each `{ instructions, options? }`: its draft, and its options, checked by the piece. */
    pieces?: unknown
    /** The pieces each case's own mock stands in for, by name. */
    mocks?: unknown
}

export type CompositionProbeDeps = { invoke?: ProbeInvoke; pieces?: Record<string, RegistryEntry>; cases?: Record<string, CompositionCase> }

/** `EphemeraFunction`'s timeout in `template.yaml`, and what of it is kept for building scenes and the cold start. */
export const LAMBDA_TIMEOUT_MS = 120_000
const OVERHEAD_MS = 15_000

/** A chain's cap: its calls run one after another, so this is the most hops that fit the Lambda's timeout were every one of them live. */
export const CHAIN_HOP_CAP = Math.floor((LAMBDA_TIMEOUT_MS - OVERHEAD_MS) / PROBE_TIMEOUT_MS)

/** A batch's cap, over whole chains: chains x the chain's cap. Mocked hops count, as they do there. */
export const COMPOSITION_PROBE_HOP_CAP = 48

/** A live piece ready to run, with its options as the piece parsed them, for the response. */
type PreparedPiece = LivePiece & { parsedOptions: unknown }

export type PreparedCompositionProbe = { cases: string[]; repeats: number; model: NovaModel; pieces: Record<string, PreparedPiece>; mocks: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string')

/** The case's mocks for the pieces the payload mocks. */
const mocksOf = ({ mocks }: CompositionCase, named: readonly string[]) => mocks.filter(({ piece }) => named.includes(piece))

/** One live piece of a payload, or a refusal. */
const preparePiece = (name: string, value: unknown, registry: Record<string, RegistryEntry>): PreparedPiece | string => {
    const entry = Object.keys(registry).includes(name) ? registry[name] : undefined
    if (entry === undefined) {
        return `pieces: ${name} isn't a registered piece; a piece must be one of: ${Object.keys(registry).join(', ')}`
    }
    if (!isRecord(value) || Object.keys(value).some((key) => key !== 'instructions' && key !== 'options')) {
        return `pieces: ${name} must be { instructions, options? }`
    }
    const { instructions } = value
    if (!isDraftText(instructions)) {
        return `pieces: ${name}'s instructions must be a draft: a non-empty string of at most ${MAX_DRAFT_CHARS} characters`
    }
    const resolved = resolvePiece(entry, value.options)
    if (typeof resolved === 'string') {
        return `pieces: ${resolved}`
    }
    const { piece, options } = resolved
    if (piece.kind !== 'read' || piece.part === undefined) {
        return `pieces: ${name} declares no part, so it can't be called in a chain`
    }
    const parsedOptions = piece.parseOptions(options)
    return typeof parsedOptions === 'string' ? `pieces: ${name}'s ${parsedOptions}` : { piece, instructions, options, parsedOptions }
}

/** What a payload runs, or a refusal. Makes no call, so the payload script checks a payload with it before it is written. */
export const prepareCompositionProbe = (event: CompositionProbeEvent, deps: CompositionProbeDeps = {}): PreparedCompositionProbe | string => {
    const allCases = deps.cases ?? compositionCases
    const registry = deps.pieces ?? registeredPieces
    const caseIds = Object.keys(allCases)
    const { cases: askedCases = caseIds, repeats = 1, mocks: askedMocks = [], model = 'NovaMicro' } = event
    if (!isStrings(askedCases) || askedCases.length === 0 || !askedCases.every((id) => caseIds.includes(id))) {
        return `cases must be a non-empty list of case IDs: ${caseIds.join(', ')}`
    }
    if (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 1) {
        return 'repeats must be an integer of at least 1'
    }
    if (!isNovaModel(model)) {
        return 'model must be a NovaModel (NovaMicro or Nova2Lite)'
    }
    if (!isRecord(event.pieces) || Object.keys(event.pieces).length === 0) {
        return 'pieces must name at least one live piece: { <piece>: { instructions, options? } }'
    }
    const prepared = Object.entries(event.pieces).map(([name, value]) => [name, preparePiece(name, value, registry)] as const)
    const refused = prepared.flatMap(([, piece]) => (typeof piece === 'string' ? [piece] : []))
    if (refused.length > 0) {
        return refused[0]
    }
    const pieces = Object.fromEntries(prepared.flatMap(([name, piece]) => (typeof piece === 'string' ? [] : [[name, piece]])))
    if (!isStrings(askedMocks)) {
        return 'mocks must be a list of the pieces to mock'
    }
    const cases = [...new Set(askedCases)]
    const mocks = [...new Set(askedMocks)]
    const mockless = cases.flatMap((id) => mocks.filter((name) => !allCases[id].mocks.some(({ piece }) => piece === name)).map((name) => `mocks: ${id} has no mock of ${name}`))
    if (mockless.length > 0) {
        return mockless[0]
    }
    if (!mocks.includes(JUDGE) && pieces[JUDGE] === undefined) {
        return `the ${JUDGE} must be live or mocked, since every chain starts with it`
    }
    try {
        cases.forEach((id) => castOf(JUDGE, Object.entries(pieces).map(([piece, { piece: { part } }]) => ({ piece, answers: part?.answers ?? [] })), mocksOf(allCases[id], mocks)))
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    const hops = cases.length * repeats * CHAIN_HOP_CAP
    return hops > COMPOSITION_PROBE_HOP_CAP
        ? `${cases.length} cases x ${repeats} repeats x ${CHAIN_HOP_CAP} hops = ${hops}, over the cap of ${COMPOSITION_PROBE_HOP_CAP}; trim cases or repeats`
        : { cases, repeats, model, pieces, mocks }
}

type Chain = LoopRun & { repeat: number }

const countStops = (chains: readonly Chain[]): Partial<Record<StopReason['reason'], number>> =>
    chains.reduce<Partial<Record<StopReason['reason'], number>>>((counts, { stop: { reason } }) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {})

/** The live calls a chain made: a live hop with no rendered text never made its call. */
const liveCalls = (chains: readonly Chain[]): number => chains.flatMap(({ hops }) => hops).filter(({ mocked, rendered }) => !mocked && rendered !== undefined).length

/** A case's tally, read first: its chains by why they stopped, and where each one that reached no verdict did. */
const tallyCase = (id: string, chains: readonly Chain[]) => ({
    case: id,
    n: chains.length,
    stops: countStops(chains),
    short: chains.filter(({ stop: { reason } }) => reason !== 'verdict').map(({ repeat, hops, stop }) => ({ repeat, hops: hops.length, ...stop })),
})

export async function handleCompositionProbe(event: CompositionProbeEvent, deps: CompositionProbeDeps = {}) {
    const prepared = prepareCompositionProbe(event, deps)
    if (typeof prepared === 'string') {
        return calibrationJsonResponse(400, { error: prepared })
    }
    const { cases, repeats, model, pieces, mocks } = prepared
    const allCases = deps.cases ?? compositionCases
    const asked = cases.flatMap((id) => Array.from({ length: repeats }, (_, repeat) => ({ id, repeat: repeat + 1 })))
    const chains = await Promise.all(asked.map(async ({ id, repeat }): Promise<Chain> => ({
        ...await runLoop({
            caseId: id, start: allCases[id].start, judge: JUDGE, pieces, mocks: mocksOf(allCases[id], mocks), cap: CHAIN_HOP_CAP, model,
            ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
        }),
        repeat,
    })))
    const ofCase = (id: string) => chains.filter((chain) => chain.case === id)
    return calibrationJsonResponse(200, {
        model,
        temperature: PROBE_TEMPERATURE,
        repeats,
        cap: CHAIN_HOP_CAP,
        mocks,
        pieces: Object.fromEntries(Object.entries(pieces).map(([name, { instructions, parsedOptions }]) => [
            name, { instructions: { hash: textHash(instructions), chars: instructions.length }, options: parsedOptions },
        ])),
        cases: cases.map((id) => tallyCase(id, ofCase(id))),
        summary: { chains: chains.length, liveCalls: liveCalls(chains), stops: countStops(chains) },
        read: cases.map((id) => ({ case: id, source: allCases[id].source, start: allCases[id].start, chains: ofCase(id).map(({ repeat, hops, stop }) => ({ repeat, hops, stop })) })),
    })
}
