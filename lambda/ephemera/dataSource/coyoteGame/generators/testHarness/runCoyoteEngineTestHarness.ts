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
    type CoyoteHypothesisHarnessRunKind,
    type CoyoteHypothesisPipelineHarnessOptions,
    type CoyoteHypothesisTestPhase,
    type GenerateHypothesisPipelineResult,
} from '../pipelines/hypothesis/generateHypothesis'
import { resolveCoyoteHarnessStartAtInject } from './coyoteEngineTestFixtures'

/** Slash / actions parse (Phase 4) and tests; omit or **`{ mode: 'full' }`** for legacy full-pipeline-all-fixtures runs. */
export type CoyoteEngineTestHarnessInvocation =
    | { mode: 'full' }
    | {
          mode: 'partial'
          testOnly: CoyoteHypothesisTestPhase
          harnessRunKind: CoyoteHypothesisHarnessRunKind
          /** 1-based index into **`fixtures`** (or default harness list); omit to run every fixture under the same phase. */
          fixtureIndex1Based?: number
      }

export type RunCoyoteEngineTestHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send' | 'flush'>
    fixtures?: CoyoteEngineTestFixture[]
    testBatchSize?: number
    /** Override for tests; defaults to [`generateHypothesisWithStageResults`]. */
    generateHypothesisPipelineImpl?: typeof generateHypothesisWithStageResults
    now?: () => number
    /** Partial pipeline runs and optional single-fixture filter; see [`CoyoteEngineTestHarnessInvocation`]. */
    harnessInvocation?: CoyoteEngineTestHarnessInvocation
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

function normalizeHarnessInvocation(
    harnessInvocation: CoyoteEngineTestHarnessInvocation | undefined
): CoyoteEngineTestHarnessInvocation {
    return harnessInvocation ?? { mode: 'full' }
}

function selectHarnessFixtures(
    allFixtures: CoyoteEngineTestFixture[],
    invocation: CoyoteEngineTestHarnessInvocation
): CoyoteEngineTestFixture[] | { error: string } {
    if (invocation.mode === 'full') {
        return allFixtures
    }
    const { fixtureIndex1Based } = invocation
    if (fixtureIndex1Based === undefined) {
        return allFixtures
    }
    const max = allFixtures.length
    const i = fixtureIndex1Based
    if (!Number.isInteger(i) || i < 1 || i > max) {
        return {
            error: `Coyote engine test harness: fixture index must be an integer from 1 to ${max} (received ${i}).`,
        }
    }
    return [allFixtures[i - 1]]
}

function buildHarnessPipelineOptions(args: {
    invocation: Extract<CoyoteEngineTestHarnessInvocation, { mode: 'partial' }>
    fixtureIndex1Based: number
    fixtures: CoyoteEngineTestFixture[]
}): CoyoteHypothesisPipelineHarnessOptions | { error: string } {
    const { invocation, fixtureIndex1Based, fixtures } = args
    const { testOnly, harnessRunKind } = invocation
    if (harnessRunKind === 'runUntil') {
        return { testOnly, harnessRunKind: 'runUntil' }
    }
    if (testOnly === 'clustering') {
        return { testOnly: 'clustering', harnessRunKind: 'runOnly' }
    }
    const phase = testOnly === 'planSelect' ? 'planSelect' : 'phasePlan'
    const resolved = resolveCoyoteHarnessStartAtInject({
        fixtureIndex1Based,
        phase,
        fixtures,
    })
    if (!resolved.ok) {
        return { error: resolved.message }
    }
    if (resolved.phase === 'planSelect') {
        return {
            testOnly: 'planSelect',
            harnessRunKind: 'runOnly',
            injectState: {
                roomObjectsByRoom: resolved.inject.roomObjectsByRoom,
                combinedMarkdown: resolved.inject.combinedMarkdown,
            },
        }
    }
    return {
        testOnly: 'phasePlan',
        harnessRunKind: 'runOnly',
        injectState: {
            roomObjectsByRoom: resolved.inject.roomObjectsByRoom,
            combinedMarkdown: resolved.inject.combinedMarkdown,
            hop1Handoff: resolved.inject.hop1Handoff,
        },
    }
}

function harnessPartialStageSkipped(
    pipeline: GenerateHypothesisPipelineResult,
    stage: 'stageOne' | 'planSelection' | 'phasePlan'
): boolean {
    if (pipeline.kind !== 'harnessPartial') {
        return false
    }
    if (stage === 'stageOne') {
        return pipeline.stageOneResult === undefined
    }
    if (stage === 'planSelection') {
        return pipeline.planSelectionResult === undefined
    }
    return pipeline.phasePlanHopResult === undefined
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
    /** Partial-run banner lines after heading (e.g. **`harness: runUntil clustering`**). */
    harnessBannerLines?: string[]
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
        harnessBannerLines,
    } = args
    const heading = `${index + 1}/${total} ${fixture.id}${fixture.label ? ` - ${fixture.label}` : ''}`
    const bannerSuffix =
        harnessBannerLines !== undefined && harnessBannerLines.length > 0
            ? harnessBannerLines.reduce<RenderTree>(
                  (acc, line) => [...acc, line, COYOTE_RENDER_LINE_BREAK],
                  [],
              )
            : []
    const tree: RenderTree = [heading, COYOTE_RENDER_LINE_BREAK, ...bannerSuffix]
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
    const allFixtures = deps.fixtures ?? COYOTE_ENGINE_TEST_FIXTURES
    const invocation = normalizeHarnessInvocation(deps.harnessInvocation)
    const selectedOrErr = selectHarnessFixtures(allFixtures, invocation)
    if ('error' in selectedOrErr) {
        const laneId = uuidv4()
        deps.messageBus.send(
            {
                type: 'PublishMessage',
                targets: [deps.characterId],
                displayProtocol: 'WorldOOCMessage',
                message: [selectedOrErr.error],
            },
            laneId
        )
        await deps.messageBus.flush(laneId)
        return
    }
    const fixtures = selectedOrErr
    if (fixtures.length === 0) {
        return
    }
    const testBatchSize = Math.max(1, Math.floor(deps.testBatchSize ?? 1))
    const runPipeline = deps.generateHypothesisPipelineImpl ?? generateHypothesisWithStageResults
    const now = deps.now ?? (() => Date.now())
    let nextIndex = 0

    const emptyUsageFailure = { success: false as const, errorMessage: '', body: '' }

    const harnessBannerLines =
        invocation.mode === 'partial'
            ? [`harness: ${invocation.harnessRunKind} ${invocation.testOnly}`]
            : undefined

    const runFixture = async (
        fixture: CoyoteEngineTestFixture,
        index: number,
        effectiveFixtureIndex1Based: number
    ): Promise<void> => {
        const laneId = uuidv4()
        const startMs = now()
        try {
            const baseDeps = {
                getGameRooms: async () => [],
                getRoomMeta: async () => undefined,
                roomObjectsByRoomOverride: normalizeFixtureRoomObjects(fixture),
            }

            if (invocation.mode === 'partial') {
                const built = buildHarnessPipelineOptions({
                    invocation,
                    fixtureIndex1Based: effectiveFixtureIndex1Based,
                    fixtures: allFixtures,
                })
                if ('error' in built) {
                    deps.messageBus.send(
                        {
                            type: 'PublishMessage',
                            targets: [deps.characterId],
                            displayProtocol: 'WorldOOCMessage',
                            message: [built.error],
                        },
                        laneId
                    )
                    await deps.messageBus.flush(laneId)
                    return
                }
                const pipeline = await runPipeline(baseDeps, built)
                const flat = flattenPipelineResultForHarness(pipeline)
                const elapsedMs = Math.max(0, now() - startMs)
                const skipS1 = harnessPartialStageSkipped(pipeline, 'stageOne')
                const skipPs = harnessPartialStageSkipped(pipeline, 'planSelection')
                const skipPph = harnessPartialStageSkipped(pipeline, 'phasePlan')
                const usageStageOne = skipS1
                    ? 'usageStage1: (not run)'
                    : formatUsageLine('usageStage1', flat.stageOneResult)
                const usagePlanSelection = skipPs
                    ? 'usagePlanSelection: (not run)'
                    : formatUsageLine('usagePlanSelection', flat.planSelectionResult ?? emptyUsageFailure)
                const usagePhasePlanHop = skipPph
                    ? 'usagePhasePlanHop: (not run)'
                    : formatUsageLine('usagePhasePlanHop', flat.phasePlanHopResult ?? emptyUsageFailure)
                const stageOneBodyBlock = skipS1
                    ? 'stageOneBody: (not run)'
                    : formatStageOneBodyForHarness(flat.stageOneResult)
                const selectionBodyBlock = skipPs
                    ? 'selectionBody: (not run)'
                    : formatSelectionBodyForHarness(flat.selectionBody)
                const phasePlanJsonBlock = skipPph
                    ? 'phasePlanJson: (not run)'
                    : formatPhasePlanJsonForHarness({
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
                    harnessBannerLines,
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
            else {
                const pipeline = await runPipeline(baseDeps)
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
                harnessBannerLines,
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
            const effectiveFixtureIndex1Based =
                invocation.mode === 'partial' && invocation.fixtureIndex1Based !== undefined
                    ? invocation.fixtureIndex1Based
                    : index + 1
            await runFixture(fixtures[index], index, effectiveFixtureIndex1Based)
        }
    }

    const workerCount = Math.min(testBatchSize, fixtures.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
