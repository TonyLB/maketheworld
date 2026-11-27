import type { MergeOptions, PlanView } from '../oracleLoop/actionPlan'
import { registerPiece, type RegisteredPiece } from './oraclePiece'
import { pieces } from './pieces'
import { PLATFORM_EXEMPT, PLATFORM_HOLDOUTS, type PlatformPart } from './platform'

/** Options for the pieces that take none by default, the minimum a payload must name. */
const NAMED_OPTIONS: Record<string, unknown> = {
    'trial/rebuttal': { upstream: 'lifted' },
    'trial/verdict': { upstream: 'lifted' },
    'trial/ruling': { upstream: 'golden' },
}

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

/** Whether a piece's reply merges into the plan in the change language as it is to be: without `concern`, which the merge admits by default. */
const inChangeLanguage = (merges: MergeOptions | undefined): boolean => merges?.adds !== undefined && !merges.adds.includes('concern')

/** The parts of the platform a piece lacks, computed from its registration and its first cell's render. */
const lacking = async (piece: RegisteredPiece, named?: unknown): Promise<PlatformPart[]> => [
    ...(await defaultRender(piece, named) === 'judge' ? ['explicit render' as const] : []),
    ...(Object.keys(piece.view.plan.reads).length === 0 ? ['plan read' as const] : []),
    ...(inChangeLanguage(piece.merges) ? [] : ['change language' as const]),
]

describe('the platform\'s holdouts (AGENT.md, "The platform\'s holdouts")', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each(registered.filter(([id]) => !PLATFORM_EXEMPT.includes(id)))('%s lacks exactly the parts listed for it', async (id, piece) => {
        expect({ id, lacks: await lacking(piece, NAMED_OPTIONS[id]) }).toEqual({ id, lacks: PLATFORM_HOLDOUTS[id] ?? [] })
    })

    it('lists only registered pieces, each lacking something, and none that is exempt', () => {
        const ids = registered.map(([id]) => id)
        expect([...Object.keys(PLATFORM_HOLDOUTS), ...PLATFORM_EXEMPT].filter((id) => !ids.includes(id))).toEqual([])
        expect(Object.entries(PLATFORM_HOLDOUTS).filter(([id, parts]) => parts.length === 0 || PLATFORM_EXEMPT.includes(id))).toEqual([])
    })

    it('has pieces wholly on it, so the list can empty', () => {
        expect(registered.map(([id]) => id).filter((id) => !(id in PLATFORM_HOLDOUTS) && !PLATFORM_EXEMPT.includes(id))).toEqual(['playByPlay', 'triage', 'triageGrounding'])
    })

    it.each<[string, string, PlanView['reads'], MergeOptions | undefined, PlatformPart[]]>([
        ['a piece wholly on it', 'The scene:\nThe things:\n- a table', { step: 'all' }, { author: 'triage', adds: ['steps', 'consequence'] }, []],
        ['a judge-render piece', 'Graph\nGraph:\n- a table', { step: 'all' }, { author: 'triage', adds: ['steps'] }, ['explicit render']],
        ['a piece that reads no plan', '\nThe things:\n- a table', {}, { author: 'triage', adds: ['steps'] }, ['plan read']],
        ['a piece that merges nothing', '\nThe things:\n- a table', { step: 'all' }, undefined, ['change language']],
        ['a piece that writes concern, named', '\nThe things:\n- a table', { step: 'all' }, { author: 'triage', adds: ['consequence', 'concern'] }, ['change language']],
        ['a piece that writes concern, by the merge\'s default', '\nThe things:\n- a table', { step: 'all' }, { author: 'triage' }, ['change language']],
    ])('computes what %s lacks', async (_, text, reads, merges, parts) => {
        const piece = registerPiece({
            name: 'toy', view: { plan: { reads }, scene: { shows: 'whole', securing: 'known' } }, ...(merges === undefined ? {} : { merges }),
            answers: ['yes'], cells: { A: { inputs: {}, source: 'hand-written' } }, parseOptions: () => undefined, render: async () => text,
        })
        expect(await lacking(piece)).toEqual(parts)
    })
})
