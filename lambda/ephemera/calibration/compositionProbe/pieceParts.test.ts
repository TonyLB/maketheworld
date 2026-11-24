//
// The parts the registered pieces declare (calibration AGENT.md, "Composition probe"): a part builds exactly the inputs its piece's cells
// have, so a hop asks what a cell asks.
//
import { consequencesCells, consequencesContract, consequences } from '../imaginationPieces/consequences'
import { PLAY_BY_PLAY_OPTIONS, playByPlay, playByPlayCells, playByPlayContract, renderPlayByPlay } from '../imaginationPieces/playByPlay'
import type { ReadPiece } from '../pieceProbe/oraclePiece'
import type { PieceRequest, PieceState } from '../pieceProbe/piecePart'
import { pieces } from '../pieceProbe/pieces'
import { textHash } from '../textHash'
import { compositionCases, JUDGE } from './compositionCases'
import { castOf } from './next'

const registered: ReadPiece[] = Object.values(pieces).flatMap((entry) => (entry.kind === 'family' ? Object.values(entry.stages) : [entry]))
    .flatMap((piece) => (piece.kind === 'read' ? [piece] : []))

describe('the registered parts', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('are playByPlay\'s and consequences\', and no two pieces answer one kind', () => {
        const parts = registered.flatMap(({ name, part }) => (part === undefined ? [] : [{ piece: name, answers: part.answers }]))
        expect(castOf(JUDGE, parts, []).answers).toEqual({ action: 'playByPlay', consequences: 'consequences' })
    })

    it('name the contract the form check reads', () => {
        expect(playByPlay.part?.contract).toBe(playByPlayContract)
        expect(consequences.part?.contract).toBe(consequencesContract)
    })

    it.each(Object.entries(playByPlayCells))('playByPlay builds cell %s\'s inputs from the state and the request', (_id, { inputs }) => {
        const { fixture, plan, target, missing, alsoShown } = inputs
        expect(playByPlay.part?.inputs({ fixture, plan, alsoShown, things: ['cup1'] }, { kind: 'action', target, missing })).toEqual(inputs)
    })

    it.each(Object.entries(consequencesCells))('consequences builds cell %s\'s inputs from the state and the request', (_id, { inputs }) => {
        const { fixture, plan, target, things } = inputs
        expect(consequences.part?.inputs({ fixture, plan, things, alsoShown: ['wall1'] }, { kind: 'consequences', target, missing: 'what happens' })).toEqual(inputs)
    })

    it('throw when called with no request', () => {
        const state: PieceState = compositionCases['OC-6'].start
        expect(() => playByPlay.part?.inputs(state, undefined)).toThrow('playByPlay answers a request, and was given none')
        expect(() => consequences.part?.inputs(state, undefined)).toThrow('consequences answers a request, and was given none')
    })

    it.each([['OC-6', '144e5e15'], ['OC-20', 'bfb8a376']])('%s\'s first live prompt is its playByPlay cell\'s, byte for byte', async (id, hash) => {
        const { start, mocks: [judge] } = compositionCases[id]
        const given = judge.entries[0].give(start, undefined) as { request: PieceRequest }
        const inputs = playByPlay.part!.inputs(start, given.request)
        expect(textHash(await renderPlayByPlay({ inputs, source: '', lookFor: '' }, PLAY_BY_PLAY_OPTIONS))).toBe(hash)
    })
})
