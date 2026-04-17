import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { renderTreeToString } from '@tonylb/mtw-base/ts/renderTree'
import type { CoyotePromptParts } from './buildHypothesisPrompt'
import type { CoyoteEngineTestFixture } from './coyoteEngineTestFixtures'
import { runCoyoteEngineTestHarness } from './runCoyoteEngineTestHarness'

const simpleFixtures: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        roomObjectsByRoom: { 'ROOM#VORTEX': ['anvil'] },
    },
    {
        id: 'fixture-02',
        roomObjectsByRoom: { 'ROOM#STRAIGHTAWAY': ['rocket'] },
    },
    {
        id: 'fixture-03',
        roomObjectsByRoom: { 'ROOM#BRIDGE': ['portable hole'] },
    },
    {
        id: 'fixture-04',
        roomObjectsByRoom: { 'ROOM#CORNER': ['paint'] },
    },
]

describe('runCoyoteEngineTestHarness', () => {
    it('publishes one WorldOOCMessage per fixture', async () => {
        const send = jest.fn()
        const invoke = jest.fn().mockResolvedValue({
            success: true,
            body: 'Hypothesis: It looks like you are trying to set a trap.',
            usage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 },
        })
        let t = 1000
        const now = () => {
            t += 5
            return t
        }

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            invokeBedrockHypothesisImpl: invoke,
            now,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        expect(invoke).toHaveBeenCalledTimes(simpleFixtures.length)
        for (const call of send.mock.calls) {
            expect(call[0]).toMatchObject({
                type: 'PublishMessage',
                targets: ['CHARACTER#runner'],
                displayProtocol: 'WorldOOCMessage',
            })
            expect(Array.isArray((call[0] as { message: RenderTree }).message)).toBe(true)
        }
    })

    it('continues on error and still publishes one line per fixture', async () => {
        const send = jest.fn()
        const invoke = jest
            .fn()
            .mockResolvedValueOnce({ success: true, body: 'Hypothesis: ok', usage: undefined })
            .mockResolvedValueOnce({ success: false, errorMessage: 'Throttled' })
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({ success: true, body: 'Hypothesis: final', usage: undefined })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            invokeBedrockHypothesisImpl: invoke,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        const rendered = send.mock.calls.map((call) =>
            renderTreeToString((call[0] as { message: RenderTree }).message)
        )
        expect(rendered.some((msg) => msg.includes('error: Throttled'))).toBe(true)
        expect(rendered.some((msg) => msg.includes('error: network down'))).toBe(true)
    })

    it('includes fixture index, elapsed timing, and usage metrics lines', async () => {
        const send = jest.fn()
        const invoke = jest.fn().mockResolvedValue({
            success: true,
            body: '```text\nHypothesis: It looks like you are trying to launch a boulder.\n```',
            usage: {
                inputTokens: 40,
                outputTokens: 11,
                totalTokens: 51,
                cacheReadInputTokens: 30,
                cacheWriteInputTokens: 2,
            },
        })
        let t = 0
        const now = () => {
            t += 10
            return t
        }

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: [simpleFixtures[0]],
            invokeBedrockHypothesisImpl: invoke,
            now,
        })

        const message = (send.mock.calls[0][0] as { message: RenderTree }).message
        const flat = renderTreeToString(message)
        expect(flat).toContain('1/1 fixture-01')
        expect(flat).toContain('Hypothesis: It looks like you are trying to launch a boulder.')
        expect(flat).toContain('elapsedMs: 10')
        expect(flat).toContain('usage: input=40 output=11 total=51 cacheRead=30 cacheWrite=2')
    })

    it('includes scene analysis when model returns preamble before Hypothesis line', async () => {
        const send = jest.fn()
        const invoke = jest.fn().mockResolvedValue({
            success: true,
            body: '## Scene analysis\nRocket: Coyote-operated.\nHypothesis: It looks like you are trying to ride.',
            usage: undefined,
        })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: [simpleFixtures[0]],
            invokeBedrockHypothesisImpl: invoke,
        })

        const flat = renderTreeToString((send.mock.calls[0][0] as { message: RenderTree }).message)
        expect(flat).toContain('## Scene analysis')
        expect(flat).toContain('Hypothesis: It looks like you are trying to ride.')
    })

    it('respects testBatchSize concurrency limit', async () => {
        const send = jest.fn()
        let inFlight = 0
        let maxInFlight = 0
        const resolvers: Array<() => void> = []
        const invoke = jest.fn().mockImplementation(async (_prompt: CoyotePromptParts) => {
            inFlight += 1
            maxInFlight = Math.max(maxInFlight, inFlight)
            await new Promise<void>((resolve) => {
                resolvers.push(() => {
                    inFlight -= 1
                    resolve()
                })
            })
            return { success: true, body: 'Hypothesis: ok', usage: undefined }
        })

        const runPromise = runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            invokeBedrockHypothesisImpl: invoke,
            testBatchSize: 2,
        })

        await Promise.resolve()
        await Promise.resolve()
        expect(maxInFlight).toBe(2)

        for (let index = 0; index < simpleFixtures.length; index += 1) {
            while (resolvers.length === 0) {
                await Promise.resolve()
            }
            const release = resolvers.shift()
            if (!release) {
                throw new Error('Expected resolver to exist')
            }
            release()
            await Promise.resolve()
        }

        await runPromise
        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
    })
})
