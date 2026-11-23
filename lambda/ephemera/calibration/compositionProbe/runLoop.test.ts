import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { consequences, registeredConsequences } from '../imaginationPieces/consequences'
import { registeredPlayByPlay } from '../imaginationPieces/playByPlay'
import { planSteps, renderPlanForGenerator } from '../oracleLoop/actionPlan'
import type { ReadPieceCell } from '../pieceProbe/oraclePiece'
import { pieces as registry } from '../pieceProbe/pieces'
import { textHash } from '../textHash'
import { compositionCases, JUDGE } from './compositionCases'
import type { Mock } from './mocks'
import { runLoop, type LivePiece } from './runLoop'

const fenced = (value: unknown): string => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

const POUR = 'pour [tea2] from [teapot1] into [cup1]'
/** Batch 61b, OC-6 repeat 1 (draft 34a). */
const OC6_REPLY = fenced({ says: POUR, intent: POUR, steps: [
    { says: 'grip [teapot1] by its handle', intent: '[teapot1] is held firmly' },
    { says: 'tilt [teapot1] to pour [tea2] into [cup1]', intent: '[tea2] flows from [teapot1] into [cup1]', consequences: [{ says: '[tea2] is poured from [teapot1] into [cup1]', thing: '[tea2]' }] },
] })
/** Batch 61b, OC-20 repeat 1 (draft 34a). */
const OC20_REPLY = fenced({ says: 'pick up [table1]', intent: 'pick up [table1]', steps: [
    { says: 'grip [table1] by its edge', intent: '[table1] is held firmly' }, { says: 'lift [table1] from its base', intent: '[table1] is lifted' },
] })
/** Batch 62, OC-20 repeat 3 (draft 34b): a form failure. */
const OC20_FAULT = fenced({ says: 'pick up [table1]', intent: 'pick up [table1]', steps: [{ says: 'grip [table1] by its edge', intent: '[table1] is held firmly', consequences: [
    { says: '[table1] is lifted with a firm grip', thing: '[table1]', intent: '[table1] is lifted' },
] }] })
/** Hand-written, in draft 5's form: no batch reply of consequences' on these cases was kept. */
const OC6_OUTCOME = fenced({ changes: [{ add: 'consequence', thing: '[table1]', says: '[table1] tips with [teapot1]' }] })
const OC20_OUTCOME = fenced({ changes: [{ add: 'consequence', thing: '[cup1]', says: '[cup1] rises with [table1]' }] })

const PLAY_BY_PLAY = 'the play-by-play draft'
const CONSEQUENCES = 'the consequences draft'
const LIVE: Record<string, LivePiece> = {
    playByPlay: { piece: registeredPlayByPlay, instructions: PLAY_BY_PLAY },
    consequences: { piece: registeredConsequences, instructions: CONSEQUENCES },
}

const success = (body: string) => ({ success: true as const, body, returnValue: {}, durationMs: 1 })
/** Each piece's calls scripted, told apart by their instructions. */
const scripted = (script: { playByPlay?: string; consequences?: string }) => {
    const prompts: string[] = []
    const invoke = jest.fn(async ({ messages }: Parameters<ProbeInvoke>[0]) => {
        const prompt = messages[0].content?.[0].text ?? ''
        prompts.push(prompt)
        const reply = prompt.startsWith(PLAY_BY_PLAY) ? script.playByPlay : script.consequences
        return reply === undefined ? { success: false as const, errorMessage: 'timed out' } : success(reply)
    }) as unknown as jest.MockedFunction<ProbeInvoke>
    return { invoke, prompts }
}

const run = (id: string, script: Parameters<typeof scripted>[0], { pieces = LIVE, mocks = compositionCases[id].mocks, cap = 10 }: { pieces?: Record<string, LivePiece>; mocks?: readonly Mock[]; cap?: number } = {}) => {
    const { invoke, prompts } = scripted(script)
    return runLoop({ caseId: id, start: compositionCases[id].start, judge: JUDGE, pieces, mocks, cap, model: 'NovaMicro', invoke }).then((result) => ({ result, prompts, invoke }))
}

describe('runLoop', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it.each([
        ['OC-6', OC6_REPLY, OC6_OUTCOME, '144e5e15'],
        ['OC-20', OC20_REPLY, OC20_OUTCOME, 'bfb8a376'],
    ])('runs the first chain on %s to a verdict, and consequences reads the plan playByPlay wrote', async (id, playByPlay, outcome, hash) => {
        const { result: { case: ran, start, hops, stop }, prompts } = await run(id, { playByPlay, consequences: outcome })
        expect(ran).toBe(id)
        expect(start).toBe(compositionCases[id].start)
        expect(stop).toEqual({ reason: 'verdict', verdict: 'allows' })
        expect(hops.map(({ piece, mocked, entry, problems }) => [piece, mocked, entry, problems])).toEqual([
            [JUDGE, true, 'needs detail of the action', undefined],
            ['playByPlay', false, undefined, []],
            [JUDGE, true, 'needs detail of the consequences', undefined],
            ['consequences', false, undefined, []],
            [JUDGE, true, 'allows', undefined],
        ])
        // The first live prompt is the cell's, after the instructions.
        expect(hops[1].inputs).toEqual({ hash })
        expect(prompts).toEqual([`${PLAY_BY_PLAY}\n\n${hops[1].rendered}`, `${CONSEQUENCES}\n\n${hops[3].rendered}`])
        // Each generator is given the judge's request, and the request as the next hop has it.
        expect(hops[0].gave).toEqual({ request: hops[1].request })
        expect(hops[2].gave).toEqual({ request: hops[3].request })
        // The plan playByPlay left is what consequences renders.
        expect(planSteps(hops[1].plan)).toHaveLength(3)
        expect(hops[3].rendered).toContain(renderPlanForGenerator(hops[1].plan))
        expect(hops[3].inputs).toEqual({ hash: textHash(hops[3].rendered ?? '') })
        expect(hops[3].plan.steps[0].items.filter(({ kind, standing }) => kind === 'consequence' && standing === 'confirmed')).toHaveLength(1)
        expect(hops[4].plan).toBe(hops[3].plan)
    })

    it('keeps the part of a request the piece has no place for', async () => {
        const { result: { hops } } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: OC6_OUTCOME })
        expect(hops.map(({ unread }) => unread)).toEqual([undefined, undefined, undefined, { missing: 'what happens to [table1] and [saucer1] as [teapot1] is moved' }, undefined])
    })

    it('shows consequences OC-20\'s chain, though the plan playByPlay left names no wall', async () => {
        const { result: { hops } } = await run('OC-20', { playByPlay: OC20_REPLY, consequences: OC20_OUTCOME })
        expect(renderPlanForGenerator(hops[1].plan)).not.toContain('wall1')
        expect(hops[3].rendered).toMatch(/chained to \[wall1\]/)
    })

    it('gives a trace that is data: it survives JSON', async () => {
        const { result } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: OC6_OUTCOME })
        expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    })

    it('makes one fresh call per live hop, with the piece\'s own output cap', async () => {
        const { invoke } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: OC6_OUTCOME })
        expect(invoke.mock.calls.map(([{ messages, maxTokens }]) => [messages.length, maxTokens])).toEqual([[1, 1024], [1, 1024]])
    })

    it('stops on a form fault, the plan as it was', async () => {
        const { result: { hops, stop } } = await run('OC-20', { playByPlay: OC20_FAULT })
        expect(stop).toMatchObject({ reason: 'formFault', piece: 'playByPlay' })
        expect(hops[1].problems?.[0]).toBe('has 1 sub-step; an expansion needs at least two')
        expect(hops[1].reply).toBe(OC20_FAULT)
        expect(hops[1].plan).toBe(compositionCases['OC-20'].start.plan)
    })

    it('stops when nothing answers: a piece not supplied, or a mock with no matching entry', async () => {
        const { result: missingPiece } = await run('OC-6', { playByPlay: OC6_REPLY }, { pieces: { playByPlay: LIVE.playByPlay } })
        expect(missingPiece.stop).toEqual({ reason: 'nothingAnswers', request: missingPiece.hops[2].gave && 'request' in missingPiece.hops[2].gave ? missingPiece.hops[2].gave.request : undefined })
        expect(missingPiece.hops).toHaveLength(3)
        const [{ entries, ...judge }] = compositionCases['OC-6'].mocks
        const { result: noEntry } = await run('OC-6', { playByPlay: OC6_REPLY }, { mocks: [{ ...judge, entries: entries.slice(0, 1) }] })
        expect(noEntry.stop).toEqual({ reason: 'nothingAnswers', piece: JUDGE })
        expect(noEntry.hops).toHaveLength(2)
    })

    it('stops at the cap when the judge keeps asking, the repeats\' inputs hashes equal', async () => {
        const { result: { hops, stop } } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: fenced({ changes: [] }) }, { cap: 6 })
        expect(stop).toEqual({ reason: 'cap', cap: 6 })
        expect(hops.map(({ piece }) => piece)).toEqual([JUDGE, 'playByPlay', JUDGE, 'consequences', JUDGE, 'consequences'])
        expect(hops[5].inputs).toEqual(hops[3].inputs)
    })

    describe('stops on an error, kept in the trace', () => {
        it('a call that fails', async () => {
            const { result: { hops, stop } } = await run('OC-6', {})
            expect(stop).toEqual({ reason: 'error', piece: 'playByPlay', error: 'timed out' })
            expect(hops[1]).toMatchObject({ error: 'timed out', inputs: { hash: '144e5e15' } })
            expect(hops[1].reply).toBeUndefined()
        })

        it('a call that throws', async () => {
            const invoke = jest.fn(async () => { throw new Error('refused') }) as unknown as ProbeInvoke
            const { stop } = await runLoop({ caseId: 'OC-6', start: compositionCases['OC-6'].start, judge: JUDGE, pieces: LIVE, mocks: compositionCases['OC-6'].mocks, cap: 10, model: 'NovaMicro', invoke })
            expect(stop).toEqual({ reason: 'error', piece: 'playByPlay', error: 'refused' })
        })

        it('a piece whose render throws: a handle playByPlay improvised, which consequences\' scene doesn\'t hold', async () => {
            const improvised = fenced({ says: POUR, intent: POUR, steps: [{ says: 'take up [cloth1]' }, { says: 'tilt [teapot1] with [cloth1] under it' }] })
            const { result: { hops, stop }, prompts } = await run('OC-6', { playByPlay: improvised, consequences: OC6_OUTCOME })
            expect(stop).toMatchObject({ reason: 'error', piece: 'consequences' })
            expect(hops[1].problems).toEqual([])
            expect(hops[3].error).toMatch(/Unknown scene handle\(s\) cloth1/)
            expect(hops[3].rendered).toBeUndefined()
            expect(prompts).toHaveLength(1)
        })

        it('a request for more of a step already expanded', async () => {
            const again: Mock = { piece: JUDGE, answers: [], entries: [{ name: 'always asks', when: () => true, give: ({ plan }) => ({ request: { kind: 'action', target: plan.steps[0].path, missing: 'how' } }) }] }
            const { result: { stop } } = await run('OC-6', { playByPlay: OC6_REPLY }, { mocks: [again] })
            expect(stop).toMatchObject({ reason: 'error', piece: 'playByPlay', error: expect.stringMatching(/already expanded/) })
        })

        it('a mock that throws', async () => {
            const broken: Mock = { piece: JUDGE, answers: [], entries: [{ name: 'broken', when: () => true, give: () => { throw new Error('no such step') } }] }
            const { result: { hops, stop } } = await run('OC-6', {}, { mocks: [broken] })
            expect(stop).toEqual({ reason: 'error', piece: JUDGE, error: 'no such step' })
            expect(hops[0]).toMatchObject({ mocked: true, entry: 'broken' })
        })

        it('options the piece refuses, before any call', async () => {
            const { result: { stop }, prompts } = await run('OC-6', { playByPlay: OC6_REPLY }, { pieces: { ...LIVE, playByPlay: { ...LIVE.playByPlay, options: { rules: 'none' } } } })
            expect(stop).toMatchObject({ reason: 'error', piece: 'playByPlay', error: expect.stringMatching(/options must be/) })
            expect(prompts).toEqual([])
        })
    })

    it('applies a mocked generator\'s plan as it does a live one\'s', async () => {
        const { result: { hops: [, { plan: expanded }] } } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: OC6_OUTCOME })
        const mocked: Mock = { piece: 'playByPlay', answers: ['action'], entries: [{ name: 'expands', when: (_state, request) => request?.kind === 'action', give: () => ({ plan: expanded }) }] }
        const { result: { hops, stop }, prompts } = await run('OC-6', { consequences: OC6_OUTCOME }, { pieces: { consequences: LIVE.consequences }, mocks: [...compositionCases['OC-6'].mocks, mocked] })
        expect(stop).toEqual({ reason: 'verdict', verdict: 'allows' })
        expect(hops.map(({ piece, mocked: isMocked }) => [piece, isMocked])).toEqual([[JUDGE, true], ['playByPlay', true], [JUDGE, true], ['consequences', false], [JUDGE, true]])
        expect(hops[1].plan).toBe(expanded)
        expect(prompts).toHaveLength(1)
    })

    it('refuses a piece that declares no part, before any call', async () => {
        const against = registry.trial.kind === 'family' ? registry.trial.stages.against : undefined
        if (against === undefined || against.kind !== 'read') {
            throw new Error('expected the trial\'s against stage')
        }
        await expect(run('OC-6', {}, { pieces: { against: { piece: against, instructions: 'x' } } })).rejects.toThrow('declares no part')
    })

    it('renders a hop as the piece renders a cell with the same inputs', async () => {
        const { result: { hops } } = await run('OC-6', { playByPlay: OC6_REPLY, consequences: OC6_OUTCOME })
        const { fixture, things } = compositionCases['OC-6'].start
        const cell: ReadPieceCell<{ fixture: string; plan: typeof hops[1]['plan']; target: string; things: typeof things }> = { inputs: { fixture, plan: hops[1].plan, target: 'pour-tea2-teapot1', things }, lookFor: '', source: '' }
        expect(hops[3].rendered).toBe(await consequences.render(cell, { scene: 'explicit' }))
    })
})
