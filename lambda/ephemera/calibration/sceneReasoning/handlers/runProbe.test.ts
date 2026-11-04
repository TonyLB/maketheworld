import { buildSceneFixture, sceneFixture } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { defaultSceneFormats } from '../../../dataSource/actions/sceneProse'
import type { ProbeInvoke } from '../runSceneReasoningProbe'
import { handleSceneReasoningProbe } from './runProbe'

const okInvoke = () => jest.fn(async (_params: { modelId: string }) => ({ success: true as const, body: '[cup1]' }))
const body = (response: { body: string }) => JSON.parse(response.body)

describe('handleSceneReasoningProbe', () => {
    const tavernQuestions = sceneFixture('tavern').questions.length

    it('runs each question once in each default format on NovaMicro', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [{ type: 'held' }, { type: 'placedOn', subject: 'cup1' }] },
            { invoke },
        )
        expect(response.statusCode).toBe(200)
        expect(invoke).toHaveBeenCalledTimes(defaultSceneFormats.length * 2)
        expect(invoke.mock.calls[0][0].modelId).toBe('us.amazon.nova-micro-v1:0')
        expect(body(response).results).toHaveLength(defaultSceneFormats.length * 2)
    })

    it('runs only the formats named, each with its own render', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'deepChain' }, formats: ['registers'], questions: [{ type: 'held' }] },
            { invoke },
        )
        const [result, ...rest] = body(response).results
        expect(rest).toEqual([])
        expect(result.format).toBe('registers')
        expect(result.scene).toContain('The place:')
    })

    it('runs the SP-10 formats when they are named, and leaves them out of the default', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'teaTable' }, formats: ['registers', 'affordance', 'examples'], questions: [{ type: 'held' }] },
            { invoke },
        )
        expect(body(response).results.map(({ format }: { format: string }) => format)).toEqual(['registers', 'affordance', 'examples'])
        expect(body(response).results[1].scene).toContain('Rules that apply here:')
        expect(defaultSceneFormats).not.toContain('registers')
    })

    it('returns only what grading needs when brief', async () => {
        const invoke = okInvoke()
        const questions = [{ type: 'held' }, { type: 'placedOn', subject: 'cup1' }]
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, formats: ['D'], questions, repeats: 1, brief: true },
            { invoke },
        )
        const { questions: wordings, results } = body(response)
        expect(wordings).toHaveLength(2)
        expect(results.map((result: { question: number }) => result.question)).toEqual([0, 1])
        for (const result of results) {
            expect(result).not.toHaveProperty('scene')
            expect(result).not.toHaveProperty('questionText')
            expect(result.answer).toBeDefined()
        }
        const refused = await handleSceneReasoningProbe({ type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, brief: 'yes' }, { invoke })
        expect(refused.statusCode).toBe(400)
    })

    it('varies an open question\'s answer instruction by answer format, and refuses an unknown one', async () => {
        const invoke = okInvoke()
        const open = { type: 'open', asked: 'Can [cup1] be moved?' }
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, formats: ['D'], questions: [open], answerFormats: ['abstain', 'twoRegisters'], brief: true },
            { invoke },
        )
        expect(body(response).results.map(({ answerFormat }: { answerFormat: string }) => answerFormat)).toEqual(['abstain', 'twoRegisters'])
        const prompts = invoke.mock.calls.map(([call]) => (call as unknown as { messages: { content: { text: string }[] }[] }).messages[0].content[0].text)
        expect(prompts[0]).toContain('as short steps')
        expect(prompts[1]).toContain('What happens:')
        expect(prompts[0]).not.toContain('What happens:')
        const refused = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [open], answerFormats: ['tree'] },
            { invoke },
        )
        expect(refused.statusCode).toBe(400)
        const overCap = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, formats: ['D', 'registers'], questions: [open], answerFormats: ['abstain', 'twoRegisters'], repeats: 4 },
            { invoke },
        )
        expect(overCap.statusCode).toBe(400)
        expect(body(overCap).error).toContain('16 calls')
    })

    it('runs on the model named at run time', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [{ type: 'held' }], model: 'Nova2Lite' },
            { invoke },
        )
        expect(invoke.mock.calls[0][0].modelId).toBe('us.amazon.nova-2-lite-v1:0')
        expect(body(response).model).toBe('Nova2Lite')
    })

    it('defaults to the fixture\'s question set, one repeat', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, formats: ['D'] },
            { invoke },
        )
        expect(invoke).toHaveBeenCalledTimes(tavernQuestions)
        const { results } = body(response)
        expect(results[0]).toMatchObject({ format: 'D', repeat: 1 })
        expect(results[0]).toHaveProperty('expected')
    })

    it('scores a reply against the expected answer as a reading aid', async () => {
        const invoke = jest.fn(async () => ({ success: true as const, body: 'none' }))
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [{ type: 'held' }] },
            { invoke },
        )
        expect(body(response).results[0].matches).toBe(false)
    })

    it('asks an open question with the open answer instruction and more room, echoes its rubric, and leaves it unscored', async () => {
        const invoke = jest.fn(async (_params: Parameters<ProbeInvoke>[0]) => ({ success: true as const, body: 'Yes: pour [tea1] from [cup1].' }))
        const question = { type: 'open', asked: 'Can you pour tea into [saucer1]?', rubric: 'Notices the teapot is secured.' }
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'teaTable' }, questions: [question] },
            { invoke },
        )
        expect(response.statusCode).toBe(200)
        expect(invoke.mock.calls[0][0].maxTokens).toBe(1024)
        expect(JSON.stringify(invoke.mock.calls[0][0].messages)).toContain('What happens: say in plain words')
        const [result] = body(response).results
        expect(result).toMatchObject({ question, questionText: 'Can you pour tea into [saucer1]?', answer: 'Yes: pour [tea1] from [cup1].' })
        expect(result).not.toHaveProperty('expected')
        expect(result).not.toHaveProperty('matches')
    })

    it('refuses over the cap before any call', async () => {
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [{ type: 'held' }, { type: 'held' }], repeats: 7 },
            { invoke },
        )
        expect(response.statusCode).toBe(400)
        expect(body(response).error).toContain(`${defaultSceneFormats.length * 14} calls`)
        expect(invoke).not.toHaveBeenCalled()
    })

    it.each([
        ['unknown fixture', { scene: { fixture: 'nope' } }],
        ['no scene', {}],
        ['both scenes', { scene: { fixture: 'tavern', characterId: 'CHARACTER#X' } }],
        ['unknown format', { scene: { fixture: 'tavern' }, formats: ['A'] }],
        ['bad model', { scene: { fixture: 'tavern' }, model: 'Gpt' }],
        ['bad repeats', { scene: { fixture: 'tavern' }, repeats: 0 }],
        ['malformed question', { scene: { fixture: 'tavern' }, questions: [{ type: 'placedOn' }] }],
        ['open question without asked', { scene: { fixture: 'tavern' }, questions: [{ type: 'open' }] }],
        ['non-string rubric', { scene: { fixture: 'tavern' }, questions: [{ type: 'open', asked: 'Why?', rubric: 3 }] }],
        ['bad characterId', { scene: { characterId: 'nope' }, questions: [{ type: 'held' }] }],
        ['characterId without questions', { scene: { characterId: 'CHARACTER#X' } }],
    ])('refuses %s before any call', async (_name, event) => {
        const invoke = okInvoke()
        const getActorCache = jest.fn()
        const response = await handleSceneReasoningProbe({ type: 'SceneReasoningProbe', ...event }, { invoke, getActorCache })
        expect(response.statusCode).toBe(400)
        expect(invoke).not.toHaveBeenCalled()
        expect(getActorCache).not.toHaveBeenCalled()
    })

    it('lists valid fixture names when the fixture is unknown', async () => {
        const response = await handleSceneReasoningProbe({ type: 'SceneReasoningProbe', scene: { fixture: 'nope' } })
        expect(body(response).error).toContain('tavern')
    })

    it('reports a failed call without failing the batch', async () => {
        const invoke = jest.fn()
            .mockResolvedValueOnce({ success: false, errorMessage: 'throttled' })
            .mockResolvedValue({ success: true, body: '[cup1]' })
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { fixture: 'tavern' }, questions: [{ type: 'held' }, { type: 'placedOn', subject: 'cup1' }] },
            { invoke },
        )
        expect(response.statusCode).toBe(200)
        const { results } = body(response)
        expect(results[0].error).toBe('throttled')
        expect(results[1].answer).toBe('[cup1]')
    })

    it('probes a live character\'s cache, with no expected answers', async () => {
        const cache = await buildSceneFixture(sceneFixture('tavern'))
        const getActorCache = jest.fn(async () => cache)
        const invoke = okInvoke()
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { characterId: 'CHARACTER#ABC' }, questions: [{ type: 'held' }] },
            { invoke, getActorCache },
        )
        expect(response.statusCode).toBe(200)
        expect(getActorCache).toHaveBeenCalledWith('CHARACTER#ABC')
        expect(body(response).results[0]).not.toHaveProperty('expected')
    })

    it('refuses a character in no room', async () => {
        const response = await handleSceneReasoningProbe(
            { type: 'SceneReasoningProbe', scene: { characterId: 'CHARACTER#ABC' }, questions: [{ type: 'held' }] },
            { invoke: okInvoke(), getActorCache: jest.fn(async () => undefined) },
        )
        expect(response.statusCode).toBe(400)
    })
})
