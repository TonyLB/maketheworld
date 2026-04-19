import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'
import { COYOTE_RENDER_LINE_BREAK } from './coyoteRenderTree'
import {
    COYOTE_ENGINE_TEST_FIXTURES,
    type CoyoteEngineTestFixture,
} from './coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import type { InvokeBedrockHypothesisResult } from './invokeBedrockHypothesis'
import {
    generateHypothesisWithStageResults,
    type GenerateHypothesisPipelineResult,
} from './generateHypothesis'

export type RunCoyoteEngineTestHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
    fixtures?: CoyoteEngineTestFixture[]
    testBatchSize?: number
    /** Override for tests; defaults to [`generateHypothesisWithStageResults`]. */
    generateHypothesisPipelineImpl?: typeof generateHypothesisWithStageResults
    now?: () => number
}

const COYOTE_ROOM_IDS: EphemeraRoomId[] = [
    'ROOM#VORTEX',
    'ROOM#STRAIGHTAWAY',
    'ROOM#CLIFFTOP',
    'ROOM#CORNER',
    'ROOM#BRIDGE',
]

function normalizeFixtureRoomObjects(fixture: CoyoteEngineTestFixture): CoyoteRoomObjectsByRoom {
    return Object.fromEntries(
        COYOTE_ROOM_IDS.map((roomId) => [roomId, fixture.roomObjectsByRoom[roomId] ?? []])
    ) as CoyoteRoomObjectsByRoom
}

/** Raw stage-1 Bedrock text for harness diagnostics (seam contract tuning, parse failures vs skipped stage 2). */
function formatStageOneBodyForHarness(result: InvokeBedrockHypothesisResult): string {
    if (!result.success) {
        return 'stageOneBody: (none)'
    }
    const body = result.body
    if (!body.trim()) {
        return 'stageOneBody: (empty)'
    }
    return `stageOneBody:\n${body}`
}

function formatUsageLine(label: string, result: InvokeBedrockHypothesisResult): string {
    if (!result.success || !result.usage) {
        return `${label}: (none)`
    }
    const {
        inputTokens,
        outputTokens,
        totalTokens,
        cacheReadInputTokens,
        cacheWriteInputTokens,
    } = result.usage
    const cacheRead = cacheReadInputTokens ?? 0
    const cacheWrite = cacheWriteInputTokens ?? 0
    return `${label}: input=${inputTokens} output=${outputTokens} total=${totalTokens} cacheRead=${cacheRead} cacheWrite=${cacheWrite}`
}

function pipelineErrorMessage(pipeline: GenerateHypothesisPipelineResult): string | undefined {
    if (!pipeline.stageOneResult.success) {
        return pipeline.stageOneResult.errorMessage
    }
    if (pipeline.stageTwoResult && !pipeline.stageTwoResult.success) {
        return pipeline.stageTwoResult.errorMessage
    }
    return undefined
}

function formatFixtureRenderTree(args: {
    fixture: CoyoteEngineTestFixture
    index: number
    total: number
    intentRecord: CoyoteGameIntentRecord
    elapsedMs: number
    usageStageOne: string
    stageOneBodyBlock: string
    usageStageTwo: string
    errorMessage?: string
}): RenderTree {
    const {
        fixture,
        index,
        total,
        intentRecord,
        elapsedMs,
        usageStageOne,
        stageOneBodyBlock,
        usageStageTwo,
        errorMessage,
    } = args
    const heading = `${index + 1}/${total} ${fixture.id}${fixture.label ? ` - ${fixture.label}` : ''}`
    const tree: RenderTree = [heading, COYOTE_RENDER_LINE_BREAK]
    if (intentRecord.sceneAnalysis !== undefined && intentRecord.sceneAnalysis.length > 0) {
        tree.push(intentRecord.sceneAnalysis, COYOTE_RENDER_LINE_BREAK)
    }
    tree.push(
        intentRecord.intent,
        COYOTE_RENDER_LINE_BREAK,
        `elapsedMs: ${elapsedMs}`,
        COYOTE_RENDER_LINE_BREAK,
        usageStageOne,
        COYOTE_RENDER_LINE_BREAK,
        stageOneBodyBlock,
        COYOTE_RENDER_LINE_BREAK,
        usageStageTwo
    )
    if (errorMessage) {
        tree.push(COYOTE_RENDER_LINE_BREAK, `error: ${errorMessage}`)
    }
    return tree
}

export async function runCoyoteEngineTestHarness(deps: RunCoyoteEngineTestHarnessDeps): Promise<void> {
    const fixtures = deps.fixtures ?? COYOTE_ENGINE_TEST_FIXTURES
    if (fixtures.length === 0) {
        return
    }
    const testBatchSize = Math.max(1, Math.floor(deps.testBatchSize ?? 1))
    const runPipeline = deps.generateHypothesisPipelineImpl ?? generateHypothesisWithStageResults
    const now = deps.now ?? (() => Date.now())
    let nextIndex = 0

    const runFixture = async (fixture: CoyoteEngineTestFixture, index: number): Promise<void> => {
        const startMs = now()
        try {
            const pipeline = await runPipeline({
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: normalizeFixtureRoomObjects(fixture),
            })
            const elapsedMs = Math.max(0, now() - startMs)
            const usageStageOne = formatUsageLine('usageStage1', pipeline.stageOneResult)
            const usageStageTwo = pipeline.stageTwoResult
                ? formatUsageLine('usageStage2', pipeline.stageTwoResult)
                : 'usageStage2: (skipped)'
            const stageOneBodyBlock = formatStageOneBodyForHarness(pipeline.stageOneResult)
            const message = formatFixtureRenderTree({
                fixture,
                index,
                total: fixtures.length,
                intentRecord: pipeline.record,
                elapsedMs,
                usageStageOne,
                stageOneBodyBlock,
                usageStageTwo,
                errorMessage: pipelineErrorMessage(pipeline),
            })
            deps.messageBus.send({
                type: 'PublishMessage',
                targets: [deps.characterId],
                displayProtocol: 'WorldOOCMessage',
                message,
            })
        }
        catch (error) {
            const elapsedMs = Math.max(0, now() - startMs)
            const errorMessage = error instanceof Error ? error.message : String(error)
            const message = formatFixtureRenderTree({
                fixture,
                index,
                total: fixtures.length,
                intentRecord: { intent: 'Hypothesis: Stubbed' },
                elapsedMs,
                usageStageOne: 'usageStage1: (none)',
                stageOneBodyBlock: 'stageOneBody: (none)',
                usageStageTwo: 'usageStage2: (none)',
                errorMessage,
            })
            deps.messageBus.send({
                type: 'PublishMessage',
                targets: [deps.characterId],
                displayProtocol: 'WorldOOCMessage',
                message,
            })
        }
    }

    const worker = async (): Promise<void> => {
        while (nextIndex < fixtures.length) {
            const index = nextIndex
            nextIndex += 1
            await runFixture(fixtures[index], index)
        }
    }

    const workerCount = Math.min(testBatchSize, fixtures.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
