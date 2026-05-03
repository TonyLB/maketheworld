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
    | {
          mode: 'full'
          /** Run full pipeline for this fixture only (`/test generation <fixtureIndex>`). Omit for all fixtures. */
          fixtureIndex1Based?: number
      }
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
    if (testOnly === 'candidates') {
        return { testOnly: 'candidates', harnessRunKind: 'runOnly' }
    }
    const phase = testOnly === 'planSelect' ? 'planSelect' : 'narrativeBeats'
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
                combined: resolved.inject.combined,
            },
        }
    }
    return {
        testOnly: 'narrativeBeats',
        harnessRunKind: 'runOnly',
        injectState: {
            roomObjectsByRoom: resolved.inject.roomObjectsByRoom,
            planSelectOutput: resolved.inject.planSelectOutput,
        },
    }
}

function harnessPartialStageSkipped(
    pipeline: GenerateHypothesisPipelineResult,
    stage: 'stageOne' | 'planSelection' | 'narrativeBeats'
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
    return pipeline.narrativeBeatResult === undefined
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

function formatSelectionBodyForHarness(args: {
    selectionBody: string | undefined
    planSelectionResult: InvokeBedrockHypothesisResult | null
}): string {
    const primary = args.selectionBody
    if (primary !== undefined && primary.trim().length > 0) {
        return `selectionBody:\n${primary}`
    }
    const fallback = args.planSelectionResult
    if (fallback?.success && fallback.body.trim().length > 0) {
        return `selectionBody:\n${fallback.body}`
    }
    return 'selectionBody: (none)'
}

/** Nova extended-thinking channel for plan selection; only surfaced when harness ends at planSelect (see caller). */
function formatPlanSelectionReasoningForHarness(args: {
    planSelectionSkipped: boolean
    planSelectionResult: InvokeBedrockHypothesisResult | null
}): string {
    if (args.planSelectionSkipped) {
        return 'planSelectionReasoning: (not run)'
    }
    const r = args.planSelectionResult
    if (!r?.success) {
        return 'planSelectionReasoning: (none)'
    }
    const rc = r.reasoningContent
    if (rc === undefined || rc.trim().length === 0) {
        return 'planSelectionReasoning: (none)'
    }
    return `planSelectionReasoning:\n${rc}`
}

function formatNarrativeBeatsJsonForHarness(args: {
    phasePlanJson: string | undefined
    phasePlanValidationReason: string | undefined
}): string {
    const { phasePlanJson, phasePlanValidationReason } = args
    if (phasePlanJson !== undefined && phasePlanJson.trim().length > 0) {
        return `narrativeBeatsJson:\n${phasePlanJson}`
    }
    let s = 'narrativeBeatsJson: (none)'
    if (phasePlanValidationReason !== undefined && phasePlanValidationReason.length > 0) {
        s += `\nnarrativeBeatsValidationReason: ${phasePlanValidationReason}`
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
            if (pipeline.narrativeBeatResult && !pipeline.narrativeBeatResult.success) {
                return pipeline.narrativeBeatResult.errorMessage
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
            if (!pipeline.narrativeBeatResult.success) {
                return pipeline.narrativeBeatResult.errorMessage
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
            if (pipeline.narrativeBeatResult && !pipeline.narrativeBeatResult.success) {
                return pipeline.narrativeBeatResult.errorMessage
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
    narrativeBeatResult: InvokeBedrockHypothesisResult | null
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
                narrativeBeatResult: pipeline.narrativeBeatResult,
                selectionBody: pipeline.selectionBody,
                phasePlanJson: pipeline.phasePlanJson,
                phasePlanValidationReason: pipeline.phasePlanValidationReason,
            }
        case 'harnessPartial':
            return {
                record: pipeline.record,
                stageOneResult: pipeline.stageOneResult ?? emptyFail,
                planSelectionResult: pipeline.planSelectionResult ?? null,
                narrativeBeatResult: pipeline.narrativeBeatResult ?? null,
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
    usageNarrativeBeat: string
    selectionBodyBlock: string
    /** Only when partial harness **`testOnly`** is **`planSelect`** (run ends after plan selection). */
    planSelectionReasoningBlock?: string
    narrativeBeatsJsonBlock: string
    errorMessage?: string
    /** Partial-run banner lines after heading (e.g. **`harness: runUntil candidates`**). */
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
        usageNarrativeBeat,
        selectionBodyBlock,
        planSelectionReasoningBlock,
        narrativeBeatsJsonBlock,
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
        usageNarrativeBeat,
        COYOTE_RENDER_LINE_BREAK,
        selectionBodyBlock,
        COYOTE_RENDER_LINE_BREAK,
    )
    if (planSelectionReasoningBlock !== undefined) {
        tree.push(planSelectionReasoningBlock, COYOTE_RENDER_LINE_BREAK)
    }
    tree.push(narrativeBeatsJsonBlock)
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
                const skipNarrativeBeat = harnessPartialStageSkipped(pipeline, 'narrativeBeats')
                const usageStageOne = skipS1
                    ? 'usageStage1: (not run)'
                    : formatUsageLine('usageStage1', flat.stageOneResult)
                const usagePlanSelection = skipPs
                    ? 'usagePlanSelection: (not run)'
                    : formatUsageLine('usagePlanSelection', flat.planSelectionResult ?? emptyUsageFailure)
                const usageNarrativeBeat = skipNarrativeBeat
                    ? 'usageNarrativeBeat: (not run)'
                    : formatUsageLine('usageNarrativeBeat', flat.narrativeBeatResult ?? emptyUsageFailure)
                const stageOneBodyBlock = skipS1
                    ? 'stageOneBody: (not run)'
                    : formatStageOneBodyForHarness(flat.stageOneResult)
                const selectionBodyBlock = skipPs
                    ? 'selectionBody: (not run)'
                    : formatSelectionBodyForHarness({
                          selectionBody: flat.selectionBody,
                          planSelectionResult: flat.planSelectionResult,
                      })
                const planSelectionReasoningBlock =
                    invocation.testOnly === 'planSelect'
                        ? formatPlanSelectionReasoningForHarness({
                              planSelectionSkipped: skipPs,
                              planSelectionResult: flat.planSelectionResult,
                          })
                        : undefined
                const narrativeBeatsJsonBlock = skipNarrativeBeat
                    ? 'narrativeBeatsJson: (not run)'
                    : formatNarrativeBeatsJsonForHarness({
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
                    usageNarrativeBeat,
                    selectionBodyBlock,
                    planSelectionReasoningBlock,
                    narrativeBeatsJsonBlock,
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
                const usageNarrativeBeat = formatUsageLine(
                    'usageNarrativeBeat',
                    flat.narrativeBeatResult ?? emptyUsageFailure
                )
                const stageOneBodyBlock = formatStageOneBodyForHarness(flat.stageOneResult)
                const selectionBodyBlock = formatSelectionBodyForHarness({
                    selectionBody: flat.selectionBody,
                    planSelectionResult: flat.planSelectionResult,
                })
                const narrativeBeatsJsonBlock = formatNarrativeBeatsJsonForHarness({
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
                    usageNarrativeBeat,
                    selectionBodyBlock,
                    narrativeBeatsJsonBlock,
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
                usageNarrativeBeat: 'usageNarrativeBeat: (none)',
                selectionBodyBlock: formatSelectionBodyForHarness({
                    selectionBody: undefined,
                    planSelectionResult: null,
                }),
                narrativeBeatsJsonBlock: formatNarrativeBeatsJsonForHarness({
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
                (invocation.mode === 'full' || invocation.mode === 'partial')
                && invocation.fixtureIndex1Based !== undefined
                    ? invocation.fixtureIndex1Based
                    : index + 1
            await runFixture(fixtures[index], index, effectiveFixtureIndex1Based)
        }
    }

    const workerCount = Math.min(testBatchSize, fixtures.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
