import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { renderTreeToString } from '@tonylb/mtw-base/ts/renderTree'
import { harnessRoomObjects, type CoyoteEngineTestFixture } from './coyoteEngineTestFixtures'
import { runCoyoteEngineTestHarness } from './runCoyoteEngineTestHarness'
import type { GenerateHypothesisPipelineResult } from './generateHypothesis'

const simpleFixtures: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        roomObjectsByRoom: { 'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']) },
    },
    {
        id: 'fixture-02',
        roomObjectsByRoom: { 'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket']) },
    },
    {
        id: 'fixture-03',
        roomObjectsByRoom: { 'ROOM#BRIDGE': harnessRoomObjects('bridge', ['portable hole']) },
    },
    {
        id: 'fixture-04',
        roomObjectsByRoom: { 'ROOM#CORNER': harnessRoomObjects('corner', ['paint']) },
    },
]

function okPipeline(intentLine: string): GenerateHypothesisPipelineResult {
    return {
        record: {
            intent: intentLine,
        },
        stageOneResult: {
            success: true,
            body: '',
            usage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 },
        },
        stageTwoResult: {
            success: true,
            body: intentLine,
            usage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 },
        },
    }
}

describe('runCoyoteEngineTestHarness', () => {
    it('publishes one WorldOOCMessage per fixture', async () => {
        const send = jest.fn()
        const pipeline = jest.fn().mockImplementation(async (): Promise<GenerateHypothesisPipelineResult> =>
            okPipeline('Hypothesis: It looks like you are trying to set a trap.')
        )
        let t = 1000
        const now = () => {
            t += 5
            return t
        }

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
            now,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        expect(pipeline).toHaveBeenCalledTimes(simpleFixtures.length)
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
        const pipeline = jest
            .fn()
            .mockResolvedValueOnce(okPipeline('Hypothesis: ok'))
            .mockResolvedValueOnce({
                record: { intent: 'Hypothesis: Stubbed' },
                stageOneResult: { success: false, errorMessage: 'Throttled', body: '' },
                stageTwoResult: null,
            })
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce(okPipeline('Hypothesis: final'))

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        const rendered = send.mock.calls.map((call) =>
            renderTreeToString((call[0] as { message: RenderTree }).message)
        )
        expect(rendered.some((msg) => msg.includes('error: Throttled'))).toBe(true)
        expect(rendered.some((msg) => msg.includes('stageOneBody: (none)') && msg.includes('error: Throttled'))).toBe(
            true
        )
        expect(rendered.some((msg) => msg.includes('error: network down'))).toBe(true)
    })

    it('includes fixture index, elapsed timing, and per-stage usage metrics lines', async () => {
        const send = jest.fn()
        const stageOneSeamBody =
            '## Clusters\n### Cluster A\n- **stableKey:** anvil-0\n'
        const pipeline = jest.fn().mockResolvedValue({
            record: {
                intent: 'Hypothesis: It looks like you are trying to launch a boulder.',
            },
            stageOneResult: {
                success: true,
                body: stageOneSeamBody,
                usage: {
                    inputTokens: 40,
                    outputTokens: 11,
                    totalTokens: 51,
                    cacheReadInputTokens: 30,
                    cacheWriteInputTokens: 2,
                },
            },
            stageTwoResult: {
                success: true,
                body: '```text\nHypothesis: It looks like you are trying to launch a boulder.\n```',
                usage: {
                    inputTokens: 20,
                    outputTokens: 9,
                    totalTokens: 29,
                    cacheReadInputTokens: 12,
                    cacheWriteInputTokens: 0,
                },
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
            generateHypothesisPipelineImpl: pipeline,
            now,
        })

        const message = (send.mock.calls[0][0] as { message: RenderTree }).message
        const flat = renderTreeToString(message)
        expect(flat).toContain('1/1 fixture-01')
        expect(flat).toContain('Hypothesis: It looks like you are trying to launch a boulder.')
        expect(flat).toContain('elapsedMs: 10')
        expect(flat).toContain('usageStage1: input=40 output=11 total=51 cacheRead=30 cacheWrite=2')
        expect(flat).toContain('stageOneBody:')
        expect(flat).toContain('**stableKey:** anvil-0')
        expect(flat).toContain('usageStage2: input=20 output=9 total=29 cacheRead=12 cacheWrite=0')
    })

    it('respects testBatchSize concurrency limit', async () => {
        const send = jest.fn()
        let inFlight = 0
        let maxInFlight = 0
        const resolvers: Array<() => void> = []
        const pipeline = jest.fn().mockImplementation(async (): Promise<GenerateHypothesisPipelineResult> => {
            inFlight += 1
            maxInFlight = Math.max(maxInFlight, inFlight)
            await new Promise<void>((resolve) => {
                resolvers.push(() => {
                    inFlight -= 1
                    resolve()
                })
            })
            return okPipeline('Hypothesis: ok')
        })

        const runPromise = runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
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
