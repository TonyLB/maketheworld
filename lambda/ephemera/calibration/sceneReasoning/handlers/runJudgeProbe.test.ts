import * as sceneFixtures from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { JUDGE_INSTRUCTIONS, JUDGE_RECAP } from '../../../dataSource/actions/sceneProse/frame'
import type { ProbeInvoke } from '../runSceneReasoningProbe'
import { handleJudgeProbe } from './runJudgeProbe'

jest.mock('../../../dataSource/positions/ludicCache/sceneFixtures', () => {
    const actual = jest.requireActual('../../../dataSource/positions/ludicCache/sceneFixtures')
    return { ...actual, sceneFixture: jest.fn(actual.sceneFixture) }
})
const { sceneFixture } = sceneFixtures

const reply = (label: string) => [
    'Picture: The teapot is stuck.', 'Obstacle: [teapot1] is glued to [table1].', 'Needs: nothing', 'Revises (if it happens): nothing', `Answer: ${label} glue.`,
].join('\n')
const invokeWith = (label: string) => jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: true as const, body: reply(label) }))
const promptOf = (invoke: ReturnType<typeof invokeWith>, call: number): string => invoke.mock.calls[call][0].messages[0].content?.[0]?.text ?? ''
const body = (response: { body: string }) => JSON.parse(response.body)
const DRAFT = 'DRAFT\n1. Picture: x\n2. Answer: x'

describe('handleJudgeProbe', () => {
    const set = sceneFixture('teaTable').judgeSets!.judge

    it('asks each request of the set once, with the deployed instructions, and grades by label', async () => {
        const invoke = invokeWith('obstructed')
        const response = await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' } }, { invoke })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(set.length)
        const prompt = promptOf(invoke, 0)
        expect(prompt.startsWith(`${JUDGE_INSTRUCTIONS}\n\nScene: The Parlour`)).toBe(true)
        expect(prompt.endsWith(`Request: ${set[0].request}`)).toBe(true)
        const { summary, instructions } = body(response)
        expect(summary.calls).toBe(set.length)
        expect(summary.requests[3]).toMatchObject({ expect: 'obstructed', pass: 1 })
        expect(instructions.overridden).toBe(false)
    })

    it('returns every reply with its grade, passes included', async () => {
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [3, 4] }, { invoke: invokeWith('obstructed') }))
        expect(result.read.map(({ request, grade }: { request: number; grade: { verdict: string } }) => [request, grade.verdict])).toEqual([[3, 'pass'], [4, 'pass']])
        const wrong = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [3, 4] }, { invoke: invokeWith('simple') }))
        expect(wrong.summary.wrongSimple).toBe(2)
    })

    it('uses a draft of the instructions for this invoke only, and says so with a different hash', async () => {
        const invoke = invokeWith('obstructed')
        const deployed = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0] }, { invoke }))
        const draft = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0], instructions: DRAFT }, { invoke }))
        expect(promptOf(invoke, 1).startsWith(`${DRAFT}\n\nScene: The Parlour`)).toBe(true)
        expect(draft.instructions).toMatchObject({ overridden: true, chars: DRAFT.length })
        expect(draft.instructions.hash).not.toBe(deployed.instructions.hash)
        expect(draft.sceneText).toEqual(deployed.sceneText)
        expect(deployed.sceneText.overridden).toBe(false)
    })

    it('uses a draft of the scene in place of the render, so the two drafts replace all but the request', async () => {
        const invoke = invokeWith('obstructed')
        const sceneText = 'Scene: A draft of [teapot1].'
        const { sceneText: reported } = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [3], instructions: DRAFT, sceneText }, { invoke }))
        expect(promptOf(invoke, 0)).toBe(`${DRAFT}\n\n${sceneText}\n\nRequest: ${set[3].request}`)
        expect(reported).toMatchObject({ overridden: true, chars: sceneText.length })
    })

    it('adds the recap to the instructions in use only under the development flag', async () => {
        const invoke = invokeWith('obstructed')
        const off = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0] }, { invoke }))
        const on = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0], development: true }, { invoke }))
        const draft = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0], instructions: DRAFT, development: true }, { invoke }))
        expect(promptOf(invoke, 0)).not.toContain('Recap:')
        expect(promptOf(invoke, 1).startsWith(`${JUDGE_INSTRUCTIONS} ${JUDGE_RECAP}\n\nScene: The Parlour`)).toBe(true)
        expect(promptOf(invoke, 2).startsWith(`${DRAFT} ${JUDGE_RECAP}\n\nScene: The Parlour`)).toBe(true)
        expect(off.instructions.development).toBe(false)
        expect(on.instructions.development).toBe(true)
        expect(on.instructions.hash).not.toBe(off.instructions.hash)
        expect(draft.instructions.overridden).toBe(true)
    })

    it('refuses a development flag that is not a boolean', async () => {
        const invoke = invokeWith('obstructed')
        const response = await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [0], development: 'yes' }, { invoke })
        expect(response.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
    })

    it('grades the form against the steps of the draft in use', async () => {
        const handleJudgeProbeResult = (draft: string) => handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [3], instructions: draft }, { invoke: invokeWith('obstructed') })
        const withRules = '1. Picture: x\n2. Rules: x\n3. Obstacle: x\n4. Needs: x\n5. Revises: x\n6. Answer: x'
        const { read } = body(await handleJudgeProbeResult(withRules))
        expect(read[0].grade.form).toEqual({ missing: ['rules'], inOrder: true })
    })

    it.each([
        [{ scene: { fixture: 'nowhere' } }],
        [{ scene: { fixture: 'tavern' }, set: 'missing' }],
        [{ scene: { fixture: 'teaTable' }, only: [99] }],
        [{ scene: { fixture: 'teaTable' }, repeats: 2 }],
        [{ scene: { fixture: 'teaTable' }, instructions: '' }],
        [{ scene: { fixture: 'teaTable' }, instructions: 'A draft with no numbered steps' }],
        [{ scene: { fixture: 'teaTable' }, sceneText: '' }],
        [{ scene: { fixture: 'teaTable' }, only: [3], sceneText: 'Scene: no such thing here' }],
        [{ scene: { fixture: 'teaTable' }, model: 'Gpt' }],
    ])('refuses %j before any call', async (event) => {
        const invoke = invokeWith('simple')
        const response = await handleJudgeProbe({ type: 'JudgeProbe', ...event }, { invoke })
        expect(response.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
    })
})

describe('handleJudgeProbe: proposed outcomes', () => {
    const fixture = jest.requireActual('../../../dataSource/positions/ludicCache/sceneFixtures').sceneFixture('teaTable') as sceneFixtures.SceneFixture
    const set = fixture.judgeSets!.judge
    const TEAPOT = 3
    const POUR = 4
    const CUP = 1

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('leaves the response and prompt as they are with the flag off', async () => {
        const invoke = invokeWith('simple')
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [POUR] }, { invoke }))
        expect(result).not.toHaveProperty('proposedOutcome')
        expect(promptOf(invoke, 0)).not.toContain('Proposed outcome')
    })

    it('asks a request with no proposal the same prompt with the flag on as with it off', async () => {
        const off = invokeWith('obstructed')
        const on = invokeWith('obstructed')
        await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [TEAPOT] }, { invoke: off })
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [TEAPOT], proposedOutcome: {} }, { invoke: on }))
        expect(promptOf(on, 0)).toBe(promptOf(off, 0))
        expect(result.proposedOutcome.requests).toEqual([{ request: TEAPOT, status: 'none' }])
    })

    it('shows a proposal after the scene and before the request, and reports what it showed', async () => {
        const invoke = invokeWith('obstructed')
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [POUR], proposedOutcome: {} }, { invoke }))
        const prompt = promptOf(invoke, 0)
        const [shown] = result.proposedOutcome.requests
        expect(shown).toMatchObject({ request: POUR, status: 'shown' })
        expect(shown.hash).toHaveLength(8)
        expect(prompt).toContain(`End of scene.\n\n${shown.text}\n\nRequest: ${set[POUR].request}`)
        expect(shown.text).toContain('In [cup1] there are [tea1] Tea and [tea2] Tea.')
        expect(result.instructions.overridden).toBe(false)
    })

    it('names things as the scene above it does, though the walk reaches them in another order', async () => {
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [CUP], proposedOutcome: {} }, { invoke: invokeWith('simple') }))
        const [{ text }] = result.proposedOutcome.requests
        expect(text).toContain('In [cup1] there is [tea1] Tea.')
        expect(text).toContain('In [teapot1] there is [tea2] Tea.')
    })

    it('takes the form, the framing and the explanation per probe', async () => {
        const invoke = invokeWith('obstructed')
        const result = body(await handleJudgeProbe({
            type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [POUR],
            proposedOutcome: { form: 'moves', framing: 'A plan', explanation: 'Read it.' },
        }, { invoke }))
        const [{ text }] = result.proposedOutcome.requests
        expect(text).toBe('A plan: Read it.\n\nMoves:\n- [tea2] moves from [teapot1] into [cup1].')
        expect(result.proposedOutcome).toMatchObject({ form: 'moves', framing: 'A plan', explanation: { overridden: true } })
    })

    it('makes no call for a proposal the dry run refuses, and says why', async () => {
        const refused = { ...fixture, judgeSets: { judge: set.map((request, index) => index === TEAPOT ? { ...request, proposal: [{ moved: 'OBJECT#Teapot', from: 'OBJECT#Table', to: 'CHARACTER#Actor' }] } : request) } } as sceneFixtures.SceneFixture
        ;(sceneFixture as jest.Mock).mockReturnValueOnce(refused)
        const invoke = invokeWith('obstructed')
        const result = body(await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [TEAPOT, POUR], proposedOutcome: {} }, { invoke }))
        expect(invoke).toHaveBeenCalledTimes(1)
        expect(result.read.map(({ request }: { request: number }) => request)).toEqual([POUR])
        expect(result.proposedOutcome.requests[0]).toEqual({ request: TEAPOT, status: 'refused', reason: 'securedToBlocksMove' })
    })

    it.each([
        [true],
        [{ form: 'prose' }],
        [{ after: 'graph' }],
        [{ framing: '' }],
        [{ explanation: '' }],
    ])('refuses %j before any call', async (proposedOutcome) => {
        const invoke = invokeWith('obstructed')
        const response = await handleJudgeProbe({ type: 'JudgeProbe', scene: { fixture: 'teaTable' }, only: [POUR], proposedOutcome }, { invoke })
        expect(response.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
    })
})
