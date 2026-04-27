import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { v4 as uuidv4 } from 'uuid'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { CoyoteGameIntentRecord } from '../../../../internalCache/coyoteGame'
import { COYOTE_RENDER_LINE_BREAK } from '../../utilities/coyoteRenderTree'
import {
    COYOTE_ENGINE_TEST_FIXTURES,
    type CoyoteEngineTestFixture,
} from './coyoteEngineTestFixtures'
import type { CoyoteRoomObjectsByRoom } from '../../utilities/coyoteRoomObjectSnapshot'
import type { InvokeBedrockHypothesisResult } from '../pipelines/hypothesis/invokeBedrockHypothesis'
import {
    generateHypothesisWithStageResults,
    type GenerateHypothesisPipelineResult,
} from '../pipelines/hypothesis/generateHypothesis'

export type RunCoyoteEngineTestHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send' | 'flush'>
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

function formatSelectionBodyForHarness(selectionBody: string | undefined): string {
    if (selectionBody !== undefined && selectionBody.trim().length > 0) {
        return `selectionBody:\n${selectionBody}`
    }
    return 'selectionBody: (none)'
}

function formatPhasePlanJsonForHarness(args: {
    phasePlanJson: string | undefined
    phasePlanValidationReason: string | undefined
}): string {
    const { phasePlanJson, phasePlanValidationReason } = args
    if (phasePlanJson !== undefined && phasePlanJson.trim().length > 0) {
        return `phasePlanJson:\n${phasePlanJson}`
    }
    let s = 'phasePlanJson: (none)'
    if (phasePlanValidationReason !== undefined && phasePlanValidationReason.length > 0) {
        s += `\nphasePlanValidationReason: ${phasePlanValidationReason}`
    }
    return s
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
    switch (pipeline.kind) {
        case 'stub': {
            if (!pipeline.stageOneResult.success) {
                return pipeline.stageOneResult.errorMessage
            }
            if (pipeline.planSelectionResult && !pipeline.planSelectionResult.success) {
                return pipeline.planSelectionResult.errorMessage
            }
            if (pipeline.phasePlanHopResult && !pipeline.phasePlanHopResult.success) {
                return pipeline.phasePlanHopResult.errorMessage
            }
            return undefined
        }
        case 'full': {
            if (!pipeline.stageOneResult.success) {
                return pipeline.stageOneResult.errorMessage
            }
            if (!pipeline.planSelectionResult.success) {
                return pipeline.planSelectionResult.errorMessage
            }
            if (!pipeline.phasePlanHopResult.success) {
                return pipeline.phasePlanHopResult.errorMessage
            }
            return undefined
        }
        case 'harnessPartial': {
            if (pipeline.stageOneResult && !pipeline.stageOneResult.success) {
                return pipeline.stageOneResult.errorMessage
            }
            if (pipeline.planSelectionResult && !pipeline.planSelectionResult.success) {
                return pipeline.planSelectionResult.errorMessage
            }
            if (pipeline.phasePlanHopResult && !pipeline.phasePlanHopResult.success) {
                return pipeline.phasePlanHopResult.errorMessage
            }
            return undefined
        }
    }
}

/** Normalize union pipeline result for harness formatting (default full runs use **`full`** or **`stub`** only). */
function flattenPipelineResultForHarness(pipeline: GenerateHypothesisPipelineResult): {
    record: CoyoteGameIntentRecord
    stageOneResult: InvokeBedrockHypothesisResult
    planSelectionResult: InvokeBedrockHypothesisResult | null
    phasePlanHopResult: InvokeBedrockHypothesisResult | null
    selectionBody?: string
    phasePlanJson?: string
    phasePlanValidationReason?: string
} {
    const emptyFail = { success: false as const, errorMessage: '', body: '' }
    switch (pipeline.kind) {
        case 'full':
        case 'stub':
            return {
                record: pipeline.record,
                stageOneResult: pipeline.stageOneResult,
                planSelectionResult: pipeline.planSelectionResult,
                phasePlanHopResult: pipeline.phasePlanHopResult,
                selectionBody: pipeline.selectionBody,
                phasePlanJson: pipeline.phasePlanJson,
                phasePlanValidationReason: pipeline.phasePlanValidationReason,
            }
        case 'harnessPartial':
            return {
                record: pipeline.record,
                stageOneResult: pipeline.stageOneResult ?? emptyFail,
                planSelectionResult: pipeline.planSelectionResult ?? null,
                phasePlanHopResult: pipeline.phasePlanHopResult ?? null,
                selectionBody: pipeline.selectionBody,
                phasePlanJson: pipeline.phasePlanJson,
                phasePlanValidationReason: pipeline.phasePlanValidationReason,
            }
    }
}

function formatFixtureRenderTree(args: {
    fixture: CoyoteEngineTestFixture
    index: number
    total: number
    intentRecord: CoyoteGameIntentRecord
    elapsedMs: number
    usageStageOne: string
    stageOneBodyBlock: string
    usagePlanSelection: string
    usagePhasePlanHop: string
    selectionBodyBlock: string
    phasePlanJsonBlock: string
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
        usagePlanSelection,
        usagePhasePlanHop,
        selectionBodyBlock,
        phasePlanJsonBlock,
        errorMessage,
    } = args
    const heading = `${index + 1}/${total} ${fixture.id}${fixture.label ? ` - ${fixture.label}` : ''}`
    const tree: RenderTree = [heading, COYOTE_RENDER_LINE_BREAK]
    if (intentRecord.walkthrough !== undefined && intentRecord.walkthrough.length > 0) {
        tree.push(intentRecord.walkthrough, COYOTE_RENDER_LINE_BREAK)
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
        usagePlanSelection,
        COYOTE_RENDER_LINE_BREAK,
        usagePhasePlanHop,
        COYOTE_RENDER_LINE_BREAK,
        selectionBodyBlock,
        COYOTE_RENDER_LINE_BREAK,
        phasePlanJsonBlock
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

    const emptyUsageFailure = { success: false as const, errorMessage: '', body: '' }

    const runFixture = async (fixture: CoyoteEngineTestFixture, index: number): Promise<void> => {
        const laneId = uuidv4()
        const startMs = now()
        try {
            const pipeline = await runPipeline({
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: normalizeFixtureRoomObjects(fixture),
            })
            const flat = flattenPipelineResultForHarness(pipeline)
            const elapsedMs = Math.max(0, now() - startMs)
            const usageStageOne = formatUsageLine('usageStage1', flat.stageOneResult)
            const usagePlanSelection = formatUsageLine(
                'usagePlanSelection',
                flat.planSelectionResult ?? emptyUsageFailure
            )
            const usagePhasePlanHop = formatUsageLine(
                'usagePhasePlanHop',
                flat.phasePlanHopResult ?? emptyUsageFailure
            )
            const stageOneBodyBlock = formatStageOneBodyForHarness(flat.stageOneResult)
            const selectionBodyBlock = formatSelectionBodyForHarness(flat.selectionBody)
            const phasePlanJsonBlock = formatPhasePlanJsonForHarness({
                phasePlanJson: flat.phasePlanJson,
                phasePlanValidationReason: flat.phasePlanValidationReason,
            })
            const message = formatFixtureRenderTree({
                fixture,
                index,
                total: fixtures.length,
                intentRecord: flat.record,
                elapsedMs,
                usageStageOne,
                stageOneBodyBlock,
                usagePlanSelection,
                usagePhasePlanHop,
                selectionBodyBlock,
                phasePlanJsonBlock,
                errorMessage: pipelineErrorMessage(pipeline),
            })
            deps.messageBus.send(
                {
                    type: 'PublishMessage',
                    targets: [deps.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message,
                },
                laneId
            )
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
                usagePlanSelection: 'usagePlanSelection: (none)',
                usagePhasePlanHop: 'usagePhasePlanHop: (none)',
                selectionBodyBlock: formatSelectionBodyForHarness(undefined),
                phasePlanJsonBlock: formatPhasePlanJsonForHarness({
                    phasePlanJson: undefined,
                    phasePlanValidationReason: undefined,
                }),
                errorMessage,
            })
            deps.messageBus.send(
                {
                    type: 'PublishMessage',
                    targets: [deps.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message,
                },
                laneId
            )
        }
        await deps.messageBus.flush(laneId)
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
