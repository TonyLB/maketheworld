import type { RegisteredPiece } from './oraclePiece'
import { pieces } from './pieces'
import { JUDGE_RENDER_HOLDOUTS } from './sceneRenders'

/** Options for the pieces that take none by default, the minimum a payload must name. */
const NAMED_OPTIONS: Record<string, unknown> = {
    'trial/rebuttal': { upstream: 'lifted' },
    'trial/verdict': { upstream: 'lifted' },
    'trial/ruling': { upstream: 'golden' },
}

/** Pieces with no default render: every payload names one. `sceneReading` compares the two. */
const NO_DEFAULT_RENDER = ['sceneReading']

const registered: [string, RegisteredPiece][] = Object.entries(pieces).flatMap(([name, entry]): [string, RegisteredPiece][] => (
    entry.kind === 'family' ? Object.entries(entry.stages).map(([stage, piece]): [string, RegisteredPiece] => [`${name}/${stage}`, piece]) : [[name, entry]]
))

/** Which render a piece's first cell takes by default: the judge's (a Graph section), the explicit render's, or no scene. */
const defaultRender = async (piece: RegisteredPiece, named: unknown): Promise<'judge' | 'explicit' | 'none'> => {
    const options = piece.parseOptions(named)
    if (typeof options === 'string') {
        throw new Error(options)
    }
    const [cell] = Object.keys(piece.cells)
    const text: string = await (piece.render as (cell: unknown, options: unknown) => Promise<string>)(piece.cells[cell], options)
    return text.includes('\nGraph:\n') ? 'judge' : text.includes('\nThe things:\n- ') ? 'explicit' : 'none'
}

describe('the explicit render as every piece\'s default (AGENT.md, "Scene renders")', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each(registered.filter(([id]) => !NO_DEFAULT_RENDER.includes(id)))('%s renders explicitly by default, or is a listed holdout', async (id, piece) => {
        const render = await defaultRender(piece, NAMED_OPTIONS[id])
        expect({ id, holdout: JUDGE_RENDER_HOLDOUTS.includes(id) }).toEqual({ id, holdout: render === 'judge' })
    })

    it('lists only registered pieces', () => {
        const ids = registered.map(([id]) => id)
        expect(JUDGE_RENDER_HOLDOUTS.filter((id) => !ids.includes(id))).toEqual([])
    })
})
