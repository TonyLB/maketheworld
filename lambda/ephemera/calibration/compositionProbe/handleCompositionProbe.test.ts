import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { PROBE_TIMEOUT_MS } from '../sceneReasoning/runSceneReasoningProbe'
import { registeredPlayByPlay } from '../imaginationPieces/playByPlay'
import { pieces as registry } from '../pieceProbe/pieces'
import { textHash } from '../textHash'
import { compositionCases } from './compositionCases'
import { CHAIN_HOP_CAP, handleCompositionProbe, LAMBDA_TIMEOUT_MS, type CompositionProbeDeps, type CompositionProbeEvent } from './handleCompositionProbe'

const fenced = (value: unknown): string => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

const POUR = 'pour [tea2] from [teapot1] into [cup1]'
const PLAY_BY_PLAY = 'the play-by-play draft'
const CONSEQUENCES = 'the consequences draft'
/** Batch 61b's first replies (draft 34a), and hand-written outcomes in draft 5's form, told apart by what their prompt shows. */
const EXPANDED: Record<string, string> = {
    'OC-6': fenced({ says: POUR, intent: POUR, steps: [
        { says: 'grip [teapot1] by its handle', intent: '[teapot1] is held firmly' },
        { says: 'tilt [teapot1] to pour [tea2] into [cup1]', intent: '[tea2] flows from [teapot1] into [cup1]' },
    ] }),
    'OC-20': fenced({ says: 'pick up [table1]', intent: 'pick up [table1]', steps: [
        { says: 'grip [table1] by its edge', intent: '[table1] is held firmly' }, { says: 'lift [table1] from its base', intent: '[table1] is lifted' },
    ] }),
}
const OUTCOME: Record<string, string> = {
    'OC-6': fenced({ changes: [{ add: 'consequence', thing: '[table1]', says: '[table1] tips with [teapot1]' }] }),
    'OC-20': fenced({ changes: [{ add: 'consequence', thing: '[cup1]', says: '[cup1] rises with [table1]' }] }),
}
const caseOf = (prompt: string): string => (prompt.includes('pick up [table1]') ? 'OC-20' : 'OC-6')

type Script = { playByPlay?: (id: string, nth: number) => string; consequences?: (id: string) => string }
const scripted = ({ playByPlay = (id) => EXPANDED[id], consequences = (id) => OUTCOME[id] }: Script = {}) => {
    const seen: Record<string, number> = {}
    return jest.fn(async ({ messages }: Parameters<ProbeInvoke>[0]) => {
        const prompt = messages[0].content?.[0].text ?? ''
        const id = caseOf(prompt)
        if (!prompt.startsWith(PLAY_BY_PLAY)) {
            return { success: true as const, body: consequences(id) }
        }
        seen[id] = (seen[id] ?? 0) + 1
        return { success: true as const, body: playByPlay(id, seen[id]) }
    }) as unknown as jest.MockedFunction<ProbeInvoke>
}

const EVENT: CompositionProbeEvent = {
    type: 'CompositionProbe',
    pieces: { playByPlay: { instructions: PLAY_BY_PLAY }, consequences: { instructions: CONSEQUENCES } },
    mocks: ['judge'],
}

const run = async (event: Partial<CompositionProbeEvent>, { script, ...deps }: { script?: Script } & Omit<CompositionProbeDeps, 'invoke'> = {}) => {
    const invoke = scripted(script)
    const { statusCode, body } = await handleCompositionProbe({ ...EVENT, ...event }, { ...deps, invoke })
    return { statusCode, body: JSON.parse(body), invoke }
}

describe('handleCompositionProbe', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('caps a chain at what fits the Lambda\'s timeout, were every hop live', () => {
        expect(CHAIN_HOP_CAP).toBe(7)
        expect(CHAIN_HOP_CAP * PROBE_TIMEOUT_MS).toBeLessThan(LAMBDA_TIMEOUT_MS)
    })

    describe('refuses before any call', () => {
        const LIVE = { playByPlay: { instructions: PLAY_BY_PLAY } }
        it.each<[string, Partial<CompositionProbeEvent>, RegExp]>([
            ['an unknown case', { cases: ['OC-1'] }, /^cases must be a non-empty list of case IDs: OC-6, OC-20$/],
            ['no cases', { cases: [] }, /^cases must be/],
            ['cases that are not a list', { cases: 'OC-6' }, /^cases must be/],
            ['a bad repeats', { repeats: 0 }, /^repeats must be/],
            ['an unknown model', { model: 'Nova' }, /^model must be/],
            ['no pieces', { pieces: undefined }, /^pieces must name at least one live piece/],
            ['an empty pieces', { pieces: {} }, /^pieces must name at least one live piece/],
            ['pieces as a list', { pieces: ['playByPlay'] }, /^pieces must name at least one live piece/],
            ['an unknown piece', { pieces: { nope: { instructions: 'x' } } }, /nope isn't a registered piece/],
            ['a name every object has', { pieces: { toString: { instructions: 'x' } } }, /toString isn't a registered piece/],
            ['a piece given as its text', { pieces: { playByPlay: 'x' } }, /playByPlay must be \{ instructions, options\? \}/],
            ['a misspelt key', { pieces: { playByPlay: { instructions: 'x', option: {} } } }, /playByPlay must be \{ instructions, options\? \}/],
            ['no instructions', { pieces: { playByPlay: { instructions: ' ' } } }, /playByPlay's instructions must be a draft/],
            ['an answered piece', { pieces: { ruleCell: { instructions: 'x' } } }, /ruleCell declares no part/],
            ['a family with no stage named', { pieces: { trial: { instructions: 'x' } } }, /trial is a family: options.stage must be one of/],
            ['a stage with no part', { pieces: { trial: { instructions: 'x', options: { stage: 'against' } } } }, /trial declares no part/],
            ['options the piece refuses', { pieces: { playByPlay: { instructions: 'x', options: { rules: 'none' } } } }, /playByPlay's options must be/],
            ['mocks that are not a list', { mocks: 'judge' }, /^mocks must be a list/],
            ['a mock the case doesn\'t have', { mocks: ['judge', 'consequences'], pieces: LIVE }, /^mocks: OC-6 has no mock of consequences$/],
            ['no judge', { mocks: [] }, /^the judge must be live or mocked/],
            ['a batch over the cap', { repeats: 4 }, /^2 cases x 4 repeats x 7 hops = 56, over the cap of 48/],
        ])('%s', async (_, event, error) => {
            const { statusCode, body, invoke } = await run(event)
            expect(statusCode).toBe(400)
            expect(body.error).toMatch(error)
            expect(invoke).not.toHaveBeenCalled()
        })

        it('a piece both live and mocked, and two pieces that answer one kind', async () => {
            const [judge] = compositionCases['OC-6'].mocks
            const start = compositionCases['OC-6'].start
            const cases = { both: { start, source: 'test', mocks: [judge, { piece: 'playByPlay', answers: [], entries: [] }] } }
            const { body: { error: both } } = await run({ mocks: ['judge', 'playByPlay'] }, { cases })
            expect(both).toBe('playByPlay is supplied twice')
            const { body: { error: twice }, invoke } = await run(
                { pieces: { playByPlay: { instructions: 'x' }, other: { instructions: 'y' } } },
                { pieces: { ...registry, other: registeredPlayByPlay } },
            )
            expect(twice).toBe('Two pieces answer a request for action: playByPlay, other')
            expect(invoke).not.toHaveBeenCalled()
        })
    })

    it('runs every case and repeat, chains on different fixtures side by side, each first live prompt its cell\'s', async () => {
        const { statusCode, body, invoke } = await run({ repeats: 2 })
        expect(statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(8)
        expect(body).toMatchObject({
            model: 'NovaMicro', repeats: 2, cap: 7, mocks: ['judge'],
            pieces: {
                playByPlay: { instructions: { hash: textHash(PLAY_BY_PLAY), chars: PLAY_BY_PLAY.length } },
                consequences: { instructions: { hash: textHash(CONSEQUENCES), chars: CONSEQUENCES.length }, options: { scene: 'explicit' } },
            },
            cases: [{ case: 'OC-6', n: 2, stops: { verdict: 2 }, short: [] }, { case: 'OC-20', n: 2, stops: { verdict: 2 }, short: [] }],
            summary: { chains: 4, liveCalls: 8, stops: { verdict: 4 } },
        })
        type Read = { case: string; source: string; chains: { repeat: number; hops: { inputs?: { hash: string } }[] }[] }
        expect((body.read as Read[]).map(({ case: id, source, chains }) => [id, source, chains.map(({ repeat, hops }) => [repeat, hops.length, hops[1].inputs?.hash])])).toEqual([
            ['OC-6', 'playByPlay cell OC-6', [[1, 5, '144e5e15'], [2, 5, '144e5e15']]],
            ['OC-20', 'playByPlay cell OC-20', [[1, 5, 'bfb8a376'], [2, 5, 'bfb8a376']]],
        ])
        expect(body.read[0].start).toEqual(compositionCases['OC-6'].start)
    })

    it('runs only the cases asked for, once each, with one repeat by default', async () => {
        const { body } = await run({ cases: ['OC-20', 'OC-20'] })
        expect(body.summary).toEqual({ chains: 1, liveCalls: 2, stops: { verdict: 1 } })
        expect(body.read.map(({ case: id }: { case: string }) => id)).toEqual(['OC-20'])
    })

    it('tallies chains that stop differently, and says where each one short of a verdict did', async () => {
        const { statusCode, body } = await run({ cases: ['OC-6'], repeats: 3 }, { script: { playByPlay: (id, nth) => (nth === 2 ? 'no block' : EXPANDED[id]) } })
        expect(statusCode).toBe(200)
        expect(body.cases).toEqual([{
            case: 'OC-6', n: 3, stops: { verdict: 2, formFault: 1 },
            short: [{ repeat: 2, hops: 2, reason: 'formFault', piece: 'playByPlay', problems: expect.any(Array) }],
        }])
        expect(body.summary).toEqual({ chains: 3, liveCalls: 5, stops: { verdict: 2, formFault: 1 } })
    })

    it('stops a chain at the cap, and counts no call for a hop whose render threw', async () => {
        const { body: capped } = await run({ cases: ['OC-6'] }, { script: { consequences: () => fenced({ changes: [] }) } })
        expect(capped.cases[0].short).toEqual([{ repeat: 1, hops: 7, reason: 'cap', cap: 7 }])
        expect(capped.summary.liveCalls).toBe(3)
        const improvised = fenced({ says: POUR, intent: POUR, steps: [{ says: 'take up [cloth1]' }, { says: 'tilt [teapot1] with [cloth1] under it' }] })
        const { body: threw } = await run({ cases: ['OC-6'] }, { script: { playByPlay: () => improvised } })
        expect(threw.cases[0].short).toMatchObject([{ reason: 'error', piece: 'consequences' }])
        expect(threw.summary.liveCalls).toBe(1)
    })

    it('runs with a generator missing: the chain stops where it is asked for', async () => {
        const { statusCode, body } = await run({ cases: ['OC-6'], pieces: { playByPlay: { instructions: PLAY_BY_PLAY } } })
        expect(statusCode).toBe(200)
        expect(body.cases[0].short).toMatchObject([{ repeat: 1, hops: 3, reason: 'nothingAnswers', request: { kind: 'consequences' } }])
    })
})
