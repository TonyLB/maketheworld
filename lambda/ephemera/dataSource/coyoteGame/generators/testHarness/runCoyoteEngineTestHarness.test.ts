import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { renderTreeToString } from '@tonylb/mtw-base/ts/renderTree'
import { harnessRoomObjects, harnessRoomObjectsSpec, type CoyoteEngineTestFixture } from './coyoteEngineTestFixtures'
import { runCoyoteEngineTestHarness } from './runCoyoteEngineTestHarness'
import type { GenerateHypothesisPipelineResult } from '../pipelines/hypothesis/generateHypothesis'

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
    const usageBase = { inputTokens: 10, outputTokens: 6, totalTokens: 16 }
    return {
        kind: 'full',
        record: {
            intent: intentLine,
        },
        stageOneResult: {
            success: true,
            body: '',
            usage: usageBase,
        },
        planSelectionResult: {
            success: true,
            body: '',
            usage: usageBase,
        },
        phasePlanHopResult: {
            success: true,
            body: intentLine,
            usage: usageBase,
        },
    }
}

describe('runCoyoteEngineTestHarness', () => {
    it('publishes one WorldOOCMessage per fixture', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
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
            messageBus: { send, flush },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
            now,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        expect(flush).toHaveBeenCalledTimes(simpleFixtures.length)
        expect(pipeline).toHaveBeenCalledTimes(simpleFixtures.length)
        const sendLanes = send.mock.calls.map((call) => call[1] as string)
        const flushLanes = flush.mock.calls.map((call) => call[0] as string)
        expect([...sendLanes].sort()).toEqual([...flushLanes].sort())
        for (const call of send.mock.calls) {
            expect(call[0]).toMatchObject({
                type: 'PublishMessage',
                targets: ['CHARACTER#runner'],
                displayProtocol: 'WorldOOCMessage',
            })
            expect(typeof call[1]).toBe('string')
            expect(Array.isArray((call[0] as { message: RenderTree }).message)).toBe(true)
        }
    })

    it('continues on error and still publishes one line per fixture', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest
            .fn()
            .mockResolvedValueOnce(okPipeline('Hypothesis: ok'))
            .mockResolvedValueOnce({
                kind: 'stub',
                record: { intent: 'Hypothesis: Stubbed' },
                stageOneResult: { success: false, errorMessage: 'Throttled', body: '' },
                planSelectionResult: null,
                phasePlanHopResult: null,
            })
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce(okPipeline('Hypothesis: final'))

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
        })

        expect(send).toHaveBeenCalledTimes(simpleFixtures.length)
        expect(flush).toHaveBeenCalledTimes(simpleFixtures.length)
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
        const flush = jest.fn().mockResolvedValue(undefined)
        const stageOneSeamBody = JSON.stringify({
            clusters: [{ clusterName: 'Cluster A', members: [{ stableKey: 'anvil-0' }] }],
        })
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'full',
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
            planSelectionResult: {
                success: true,
                body: '{"paragraphSummary":"x","planIssues":[{"code":"ROLE_CONFLICT","summary":"x"}]}',
                usage: {
                    inputTokens: 15,
                    outputTokens: 8,
                    totalTokens: 23,
                    cacheReadInputTokens: 10,
                    cacheWriteInputTokens: 1,
                },
            },
            phasePlanHopResult: {
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
            selectionBody: '{"paragraphSummary":"x","planIssues":[{"code":"ROLE_CONFLICT","summary":"x"}]}',
            phasePlanJson: '{"tropeSequence":["Contraption"],"deconflictionSummary":"single lane","phases":[{"trope":"Contraption","tropeBeat":"prime launch lane","stableKeysUsed":["anvil-0"],"virtualEntities":[],"achievement":"launch"}]}',
        })
        let t = 0
        const now = () => {
            t += 10
            return t
        }

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [simpleFixtures[0]],
            generateHypothesisPipelineImpl: pipeline,
            now,
        })

        expect(flush).toHaveBeenCalledTimes(1)
        expect(flush.mock.calls[0][0]).toBe(send.mock.calls[0][1])
        const message = (send.mock.calls[0][0] as { message: RenderTree }).message
        const flat = renderTreeToString(message)
        expect(flat).toContain('1/1 fixture-01')
        expect(flat).toContain('Hypothesis: It looks like you are trying to launch a boulder.')
        expect(flat).toContain('elapsedMs: 10')
        expect(flat).toContain('usageStage1: input=40 output=11 total=51 cacheRead=30 cacheWrite=2')
        expect(flat).toContain('stageOneBody:')
        expect(flat).toContain('"stableKey":"anvil-0"')
        expect(flat).toContain('usagePlanSelection: input=15 output=8 total=23 cacheRead=10 cacheWrite=1')
        expect(flat).toContain('usagePhasePlanHop: input=20 output=9 total=29 cacheRead=12 cacheWrite=0')
        expect(flat).toContain('selectionBody:\n{"paragraphSummary":"x","planIssues":[{"code":"ROLE_CONFLICT","summary":"x"}]}')
        expect(flat).toContain(
            'phasePlanJson:\n{"tropeSequence":["Contraption"],"deconflictionSummary":"single lane","phases":[{"trope":"Contraption","tropeBeat":"prime launch lane","stableKeysUsed":["anvil-0"],"virtualEntities":[],"achievement":"launch"}]}'
        )
        expect(flat).not.toContain('planSelectionReasoning')
    })

    it('respects testBatchSize concurrency limit', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
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
            messageBus: { send, flush },
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
        expect(flush).toHaveBeenCalledTimes(simpleFixtures.length)
    })

    it('partial runUntil passes harness options as the second argument to the pipeline impl', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'clustering',
            harnessRunKind: 'runUntil',
            record: { intent: 'Hypothesis: partial' },
            stageOneResult: {
                success: true,
                body: '{"clusters":[]}',
                usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
            },
        })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [simpleFixtures[0]],
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'clustering',
                harnessRunKind: 'runUntil',
            },
        })

        expect(pipeline).toHaveBeenCalledWith(
            expect.anything(),
            { testOnly: 'clustering', harnessRunKind: 'runUntil' }
        )
    })

    it('partial runUntil clustering passes affordance-rich room objects unchanged', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const affordanceFixture: CoyoteEngineTestFixture = {
            id: 'fixture-affordance',
            roomObjectsByRoom: {
                'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                    {
                        shortName: 'paint',
                        tropeAffinities: [{
                            trope: 'Distraction',
                            aptness: 'Good',
                            narrowing: 'fake tunnel lure',
                            environmentAffordances: [{ object: 'rock-wall', roles: ['Finishing Move'] }],
                        }],
                    },
                ]),
            },
        }
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'clustering',
            harnessRunKind: 'runUntil',
            record: { intent: 'Hypothesis: partial' },
            stageOneResult: {
                success: true,
                body: '{"candidates":[]}',
                usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
            },
        })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [affordanceFixture],
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'clustering',
                harnessRunKind: 'runUntil',
            },
        })

        expect(pipeline).toHaveBeenCalledTimes(1)
        const depsArg = pipeline.mock.calls[0][0] as {
            roomObjectsByRoomOverride: Record<string, Array<{
                tropeAffinities?: Array<{ environmentAffordances?: unknown[] }>;
            }>>;
        }
        expect(
            depsArg.roomObjectsByRoomOverride['ROOM#VORTEX'][0].tropeAffinities?.[0].environmentAffordances
        ).toEqual([{ object: 'rock-wall', roles: ['Finishing Move'] }])
    })

    it('partial harness partial result labels skipped stages as (not run) and prints harness banner', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'clustering',
            harnessRunKind: 'runUntil',
            record: { intent: 'Hypothesis: partial' },
            stageOneResult: {
                success: true,
                body: '{"clusters":[]}',
                usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
            },
        })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [simpleFixtures[0]],
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'clustering',
                harnessRunKind: 'runUntil',
            },
        })

        const rendered = renderTreeToString((send.mock.calls[0][0] as { message: RenderTree }).message)
        expect(rendered).toContain('harness: runUntil clustering')
        expect(rendered).toContain('usagePlanSelection: (not run)')
        expect(rendered).toContain('usagePhasePlanHop: (not run)')
        expect(rendered).toContain('selectionBody: (not run)')
        expect(rendered).toContain('phasePlanJson: (not run)')
        expect(rendered).not.toContain('planSelectionReasoning')
    })

    it('partial runUntil planSelect falls back to planSelectionResult body for selectionBody', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'planSelect',
            harnessRunKind: 'runUntil',
            record: { intent: 'Hypothesis: partial' },
            stageOneResult: {
                success: true,
                body: '{"candidates":[]}',
                usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
            },
            planSelectionResult: {
                success: true,
                body: '{"paragraphSummary":"winner","planIssues":[{"code":"DIRECTION_AMBIGUOUS","summary":"winner"}]}',
                reasoningContent: 'compare sketches then pick candidate-1',
                usage: { inputTokens: 9, outputTokens: 10, totalTokens: 19 },
            },
        })

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [simpleFixtures[0]],
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runUntil',
            },
        })

        const rendered = renderTreeToString((send.mock.calls[0][0] as { message: RenderTree }).message)
        expect(rendered).toContain(
            'selectionBody:\n{"paragraphSummary":"winner","planIssues":[{"code":"DIRECTION_AMBIGUOUS","summary":"winner"}]}'
        )
        expect(rendered).toContain(
            'planSelectionReasoning:\ncompare sketches then pick candidate-1'
        )
    })

    it('runOnly planSelect without inject publishes OOC error and does not call the pipeline', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn()

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: [simpleFixtures[0]],
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                fixtureIndex1Based: 1,
            },
        })

        expect(pipeline).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledTimes(1)
        const ooc = (send.mock.calls[0][0] as { message: string[] }).message
        expect(ooc[0]).toContain('planSelect')
        expect(ooc[0]).toContain('does not yet supply')
    })

    it('runOnly planSelect with inject calls pipeline with injected combined state', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'planSelect',
            harnessRunKind: 'runOnly',
            record: { intent: 'Hypothesis: planSelect only' },
            planSelectionResult: {
                success: true,
                body: '{"paragraphSummary":"winner","planIssues":[{"code":"ROLE_CONFLICT","summary":"needs lane owner"}]}',
                usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
            },
        })
        const fixturesWithInject: CoyoteEngineTestFixture[] = [
            {
                ...simpleFixtures[0],
                planSelectInject: {
                    roomObjectsByRoom: {
                        'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                        'ROOM#STRAIGHTAWAY': [],
                        'ROOM#CLIFFTOP': [],
                        'ROOM#CORNER': [],
                        'ROOM#BRIDGE': [],
                    },
                    combined: {} as any,
                },
            },
        ]

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: fixturesWithInject,
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                fixtureIndex1Based: 1,
            },
        })

        expect(pipeline).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                injectState: expect.objectContaining({
                    combined: fixturesWithInject[0].planSelectInject?.combined,
                }),
            })
        )
    })

    it('runOnly phasePlan with inject calls pipeline with structured planSelect output', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockResolvedValue({
            kind: 'harnessPartial',
            testOnly: 'phasePlan',
            harnessRunKind: 'runOnly',
            record: { intent: 'Hypothesis: phasePlan only' },
            phasePlanHopResult: {
                success: true,
                body: '```text\nHypothesis: phase only\n```',
                usage: { inputTokens: 6, outputTokens: 7, totalTokens: 13 },
            },
        })
        const fixturesWithInject: CoyoteEngineTestFixture[] = [
            {
                ...simpleFixtures[0],
                planSelectInject: {
                    roomObjectsByRoom: {
                        'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                        'ROOM#STRAIGHTAWAY': [],
                        'ROOM#CLIFFTOP': [],
                        'ROOM#CORNER': [],
                        'ROOM#BRIDGE': [],
                    },
                    combined: {} as any,
                },
                phasePlanInject: {
                    roomObjectsByRoom: {
                        'ROOM#VORTEX': harnessRoomObjects('vortex', ['anvil']),
                        'ROOM#STRAIGHTAWAY': [],
                        'ROOM#CLIFFTOP': [],
                        'ROOM#CORNER': [],
                        'ROOM#BRIDGE': [],
                    },
                    combined: {} as any,
                    planSelectOutput: {
                        paragraphSummary: 'Pick candidate-1 and keep timing coherent.',
                        planIssues: [{ code: 'ROLE_CONFLICT', summary: 'needs lane ownership' }],
                    },
                },
            },
        ]

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: fixturesWithInject,
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'phasePlan',
                harnessRunKind: 'runOnly',
                fixtureIndex1Based: 1,
            },
        })

        expect(pipeline).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                testOnly: 'phasePlan',
                harnessRunKind: 'runOnly',
                injectState: expect.objectContaining({
                    planSelectOutput: expect.objectContaining({
                        paragraphSummary: 'Pick candidate-1 and keep timing coherent.',
                        planIssues: [{ code: 'ROLE_CONFLICT', summary: 'needs lane ownership' }],
                    }),
                }),
            })
        )
    })

    it('full mode with fixtureIndex1Based runs one fixture', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn().mockImplementation(async (): Promise<GenerateHypothesisPipelineResult> =>
            okPipeline('Hypothesis: single')
        )

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: { mode: 'full', fixtureIndex1Based: 2 },
        })

        expect(pipeline).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('invalid full-mode fixture index sends OOC error and does not call the pipeline', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn()

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: { mode: 'full', fixtureIndex1Based: 99 },
        })

        expect(pipeline).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledTimes(1)
        const payload = send.mock.calls[0][0] as { message: string[] }
        expect(payload.message[0]).toContain('fixture index must be an integer')
    })

    it('invalid partial fixture index sends a single OOC error and does not call the pipeline', async () => {
        const send = jest.fn()
        const flush = jest.fn().mockResolvedValue(undefined)
        const pipeline = jest.fn()

        await runCoyoteEngineTestHarness({
            characterId: 'CHARACTER#runner',
            messageBus: { send, flush },
            fixtures: simpleFixtures,
            generateHypothesisPipelineImpl: pipeline,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'clustering',
                harnessRunKind: 'runUntil',
                fixtureIndex1Based: 99,
            },
        })

        expect(pipeline).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledTimes(1)
        const payload = send.mock.calls[0][0] as { message: string[] }
        expect(payload.message[0]).toContain('fixture index must be an integer')
    })
})
