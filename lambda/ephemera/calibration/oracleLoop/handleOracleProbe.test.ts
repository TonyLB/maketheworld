import { readFileSync } from 'fs'
import { join } from 'path'

import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { renderScene } from '../../dataSource/actions/sceneProse'
import type { ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { handleOracleProbe } from './handleOracleProbe'
import { oracleCases } from './oracleCases'

/** Draft 1, the harness's consumer: its eight steps, ending in Answer. */
const DRAFT_1 = readFileSync(join(__dirname, '../../../../taskPlanning/lambda/ephemera/dataSource/actions/oracleLoopDrafts/1.txt'), 'utf8')
const REPLY = ['Moves: x', 'Changes: x', 'Picture: x', 'Rules: none', 'Missing: nothing', 'Tests: works: yes', 'Improve: nothing', 'Answer: better x.'].join('\n')

const invokeReplying = (reply: string) => jest.fn<ReturnType<ProbeInvoke>, Parameters<ProbeInvoke>>(async () => ({ success: true as const, body: reply }))
const promptOf = (invoke: ReturnType<typeof invokeReplying>, call: number): string => invoke.mock.calls[call][0].messages[0].content?.[0]?.text ?? ''
const body = (response: { body: string }) => JSON.parse(response.body)
const judgeRender = async (name: string): Promise<string> => {
    const fixture = sceneFixture(name)
    return renderScene((await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene, 'judge')
}

describe('handleOracleProbe', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('asks cases from different fixtures in one invoke, each its own scene, inputs and request', async () => {
        const invoke = invokeReplying(REPLY)
        const response = await handleOracleProbe({ type: 'OracleProbe', cases: ['OC-6', 'OC-11'], instructions: DRAFT_1 }, { invoke })
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(2)
        const prompts = [promptOf(invoke, 0), promptOf(invoke, 1)]
        expect(prompts[0]).toContain(await judgeRender('teaTable'))
        expect(prompts[1]).toContain(await judgeRender('teaTableCupOnFloor'))
        expect(prompts[0].startsWith(DRAFT_1)).toBe(true)
        expect(prompts[0]).toMatch(/End of scene\.\n\nBest answer so far: I don't see how\.\n\nCandidate: [^\n]+\n\nMoves:\n- pour \[tea2\] from \[teapot1\] into \[cup1\] \(from the system\)\.\n  record: \[tea2\] moves from \[teapot1\] into \[cup1\]\.\n\nRequest: I want to pour tea from \[teapot1\]\.$/)
        const result = body(response)
        expect(result.cases.map(({ case: id, endResult }: { case: string; endResult: string }) => [id, endResult])).toEqual([
            ['OC-6', oracleCases['OC-6'].endResult], ['OC-11', oracleCases['OC-11'].endResult],
        ])
        expect(result.summary).toEqual({ calls: 2, errors: 0, malformed: 0 })
        expect(result.read[0]).toEqual({ case: 'OC-6', repeat: 1, answer: REPLY, form: { missing: [], inOrder: true } })
    })

    it('calls on a round with no candidate, since zero is a valid round', async () => {
        const invoke = invokeReplying(REPLY)
        expect((await handleOracleProbe({ type: 'OracleProbe', cases: ['OC-20'], instructions: DRAFT_1 }, { invoke })).statusCode).toBe(200)
        expect(promptOf(invoke, 0)).toContain("End of scene.\n\nBest answer so far: I don't see how.\n\nRequest: I want to pick up [table1].")
    })

    it('checks form only, against the draft\'s own steps', async () => {
        const invoke = invokeReplying('Moves: x\nAnswer: better x.')
        const result = body(await handleOracleProbe({ type: 'OracleProbe', cases: ['OC-1'], instructions: DRAFT_1, repeats: 2 }, { invoke }))
        expect(result.summary).toEqual({ calls: 2, errors: 0, malformed: 2 })
        expect(result.read[0].form.missing).toEqual(['changes', 'picture', 'rules', 'missing', 'tests', 'improve'])
        expect(result.read[0]).not.toHaveProperty('grade')
    })

    it('applies framing and show to every case, and reports them', async () => {
        const invoke = invokeReplying(REPLY)
        const result = body(await handleOracleProbe({
            type: 'OracleProbe', cases: ['OC-6'], instructions: DRAFT_1, framing: { floor: 'Nothing works yet.' }, show: { after: 'fiction', suppliedBy: false },
        }, { invoke }))
        expect(promptOf(invoke, 0)).toContain('Best answer so far: Nothing works yet.')
        expect(promptOf(invoke, 0)).toContain('  record: [tea2] moves from [teapot1] into [cup1].\n\nAfter:\n\nFiction:')
        expect(result.framing).toEqual({ overridden: ['floor'] })
        expect(result.show).toEqual({ after: 'fiction', suppliedBy: false })
    })

    it('words the scene\'s rules as the event asks, v45\'s by default', async () => {
        const invoke = invokeReplying(REPLY)
        await handleOracleProbe({ type: 'OracleProbe', cases: ['OC-6'], instructions: DRAFT_1 }, { invoke })
        expect(promptOf(invoke, 0)).toContain(await judgeRender('teaTable'))
        const result = body(await handleOracleProbe({ type: 'OracleProbe', cases: ['OC-6'], instructions: DRAFT_1, rules: 'violation' }, { invoke }))
        expect(promptOf(invoke, 1)).toContain('- teapot-secured-to-table: [teapot1] is glued to [table1]. A method keeps this rule if')
        expect(promptOf(invoke, 1)).not.toContain("stays fixed relative to [table1]'s frame")
        expect(result.rules).toBe('violation')
    })

    it.each([
        [{ cases: ['OC-6'], instructions: DRAFT_1, rules: 'strict' }, /rules must be one of: v45, violation/],
        [{ cases: ['OC-99'], instructions: DRAFT_1 }, /cases must be a non-empty list/],
        [{ cases: [], instructions: DRAFT_1 }, /cases must be a non-empty list/],
        [{ cases: ['OC-6'] }, /instructions must be a draft/],
        [{ cases: ['OC-6'], instructions: '1. Moves: x\n2. Improve: x' }, /ending in Answer/],
        [{ cases: ['OC-1', 'OC-6', 'OC-11'], instructions: DRAFT_1, repeats: 5 }, /over the cap of 12/],
        [{ cases: ['OC-6'], instructions: DRAFT_1, framing: { heading: 'x' } }, /unknown keys heading/],
        [{ cases: ['OC-6'], instructions: DRAFT_1, framing: { floor: '' } }, /framing.floor must be/],
        [{ cases: ['OC-6'], instructions: DRAFT_1, show: { after: 'both' } }, /show.after must be one of/],
        [{ cases: ['OC-6'], instructions: DRAFT_1, model: 'Claude' }, /model must be a NovaModel/],
    ])('refuses %j before any call', async (event, error) => {
        const invoke = invokeReplying(REPLY)
        const response = await handleOracleProbe({ type: 'OracleProbe', ...event }, { invoke })
        expect(response.statusCode).toBe(400)
        expect(body(response).error).toMatch(error)
        expect(invoke).not.toHaveBeenCalled()
    })

    it('has a case for every scene and request it asks about, each handle in its own render', async () => {
        const invoke = invokeReplying(REPLY)
        const ids = Object.keys(oracleCases)
        const results = await Promise.all([ids.slice(0, 6), ids.slice(6)].map((cases) => handleOracleProbe({ type: 'OracleProbe', cases, instructions: DRAFT_1 }, { invoke })))
        expect(results.map(({ statusCode }) => statusCode)).toEqual([200, 200])
    })
})
