import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { chainsText, readChains, type ChainGroup } from './chainsText'
import { handleCompositionProbe } from './handleCompositionProbe'

const fenced = (value: unknown): string => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

const POUR = 'pour [tea2] from [teapot1] into [cup1]'
const EXPANDED = fenced({ says: POUR, intent: POUR, steps: [{ says: 'grip [teapot1] by its handle' }, { says: 'tilt [teapot1] over [cup1]' }] })
const IMPROVISED = fenced({ says: POUR, intent: POUR, steps: [{ says: 'take up [cloth1]' }, { says: 'tilt [teapot1] with [cloth1] under it' }] })
const OUTCOME = fenced({ changes: [{ add: 'consequence', thing: '[table1]', says: '[table1] tips with [teapot1]' }] })

/** Three OC-6 chains: one to its verdict, one that ends at playByPlay's form, one whose consequences render throws. */
const response = async () => {
    const replies = [EXPANDED, 'no block', IMPROVISED]
    const invoke = jest.fn(async ({ messages }: Parameters<ProbeInvoke>[0]) => {
        const prompt = messages[0].content?.[0].text ?? ''
        return { success: true as const, body: prompt.startsWith('PLAY') ? replies.shift() ?? '' : OUTCOME }
    }) as unknown as ProbeInvoke
    return handleCompositionProbe(
        { type: 'CompositionProbe', cases: ['OC-6'], repeats: 3, pieces: { playByPlay: { instructions: 'PLAY' }, consequences: { instructions: 'OTHER' } }, mocks: ['judge'] },
        { invoke },
    )
}

describe('chainsText', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    const read = async (): Promise<ChainGroup[]> => {
        const groups = readChains(await response())
        if (typeof groups === 'string') {
            throw new Error(groups)
        }
        return groups
    }

    it('prints each chain to its stop, hop by hop', async () => {
        const text = chainsText(await read())
        expect(text.split('\n').filter((line) => line.startsWith('#'))).toEqual([
            '# OC-6 (playByPlay cell OC-6)',
            '## OC-6, repeat 1: verdict, allows (5 hops)',
            '### 1. judge (mocked: needs detail of the action)', '### 2. playByPlay', '### 3. judge (mocked: needs detail of the consequences)', '### 4. consequences', '### 5. judge (mocked: allows)',
            expect.stringMatching(/^## OC-6, repeat 2: form fault at playByPlay: .* \(2 hops\)$/),
            '### 1. judge (mocked: needs detail of the action)', '### 2. playByPlay',
            expect.stringMatching(/^## OC-6, repeat 3: error at consequences: Unknown scene handle\(s\) cloth1.* \(4 hops\)$/),
            '### 1. judge (mocked: needs detail of the action)', '### 2. playByPlay', '### 3. judge (mocked: needs detail of the consequences)', '### 4. consequences',
        ])
    })

    it('gives a live hop its request, what it left unread, its hash, its reply, and the plan it changed', async () => {
        const [, fourth] = chainsText(await read()).split('### 4. consequences\n')
        const hop = fourth.split('\n\n###')[0]
        expect(hop).toContain('asked: consequences of pour-tea2-teapot1: what happens to [table1], [saucer1] and [cup1] as [teapot1] is moved\n')
        expect(hop).toContain('unread: missing "what happens to')
        expect(hop).toMatch(/inputs [0-9a-f]{8}\n/)
        expect(hop).toContain(`reply (${OUTCOME.length} characters):\n${OUTCOME}`)
        expect(hop).toMatch(/plan after:\nStep pour-tea2-teapot1: pour.*\n[\s\S]*- consequence pour-tea2-teapot1\.table1-tips-teapot1: \[table1\] tips with \[teapot1\]/)
    })

    it('prints a plan only where a hop changed it, and prompts only when asked', async () => {
        const groups = await read()
        const text = chainsText(groups)
        expect(text.match(/plan after:/g)).toHaveLength(3)
        expect(text).not.toContain('End of scene.')
        const [{ chains: [{ hops }] }] = groups
        expect(chainsText(groups, { prompts: true })).toContain(`prompt:\n${hops[3].rendered}`)
    })

    it.each([
        ['a request nothing answers', { reason: 'nothingAnswers' as const, request: { kind: 'consequences' as const, target: 'pour', missing: 'what' } }, 'nothing answers: consequences of pour: what'],
        ['a mock with no matching entry', { reason: 'nothingAnswers' as const, piece: 'judge' }, 'nothing answers (judge)'],
        ['the cap', { reason: 'cap' as const, cap: 7 }, 'the cap, 7 hops'],
    ])('names the stop: %s', async (_, stop, text) => {
        const [{ chains, ...group }] = await read()
        expect(chainsText([{ ...group, chains: [{ ...chains[0], stop }] }])).toContain(`## OC-6, repeat 1: ${text} (5 hops)`)
    })
})

describe('readChains', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('reads a body saved as a string, as an object, or bare', async () => {
        const saved = await response()
        const bare = JSON.parse(saved.body)
        expect(readChains(saved)).toEqual(bare.read)
        expect(readChains({ ...saved, body: bare })).toEqual(bare.read)
        expect(readChains(bare)).toEqual(bare.read)
    })

    it('refuses another probe\'s response, and gives a refusal\'s error', () => {
        expect(readChains({ piece: 'playByPlay', read: [] })).toBe('not a CompositionProbe response')
        expect(readChains({ statusCode: 400, body: '{"error":"repeats must be an integer of at least 1"}' })).toBe('not a CompositionProbe response: repeats must be an integer of at least 1')
    })
})
