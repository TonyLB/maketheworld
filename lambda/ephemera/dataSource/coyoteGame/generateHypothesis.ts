import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'
import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt'
import { buildHypothesisStageTwoPromptParts } from './buildHypothesisStageTwoPrompt'
import {
    combineHypothesisClusters,
    renderCombinedHypothesisForStageTwo,
} from './combineHypothesisClusters'
import {
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis'
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { parseHypothesisModelOutput, type ParseHypothesisModelOutputOptions } from './parseHypothesisModelOutput'
import { parseHypothesisStageOneOutput } from './parseHypothesisStageOneOutput'

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom
}

/** Failure policy (two-round pipeline): any stage-1/stage-2 Bedrock failure, invalid seam, or combine failure yields stub intent only — no partial hypothesis to players. */

export type GenerateHypothesisPipelineResult = {
    record: CoyoteGameIntentRecord
    stageOneResult: InvokeBedrockHypothesisResult
    stageTwoResult: InvokeBedrockHypothesisResult | null
    /** Stage Two extended-reasoning text when Bedrock returned it (not stored on CoyoteGameIntentRecord). */
    stageTwoReasoningContent?: string
}

async function runHypothesisPipeline(deps: GenerateHypothesisDeps): Promise<GenerateHypothesisPipelineResult> {
    const roomObjectsByRoom = deps.roomObjectsByRoomOverride ?? await loadCoyoteRoomObjectsByRoom(deps)

    const stageOneParts = buildHypothesisStageOnePromptParts({ roomObjectsByRoom })
    const stageOneResult = await invokeBedrockHypothesisStageOne(stageOneParts)

    if (!stageOneResult.success) {
        return {
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult,
            stageTwoResult: null,
        }
    }

    const seamParsed = parseHypothesisStageOneOutput(stageOneResult.body, roomObjectsByRoom)
    if (!seamParsed.ok) {
        return {
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult,
            stageTwoResult: null,
        }
    }

    // See coyoteGame/AGENT.md "Clustering and combine (design)": combine DTO + combined-only Stage Two.
    const combinedResult = combineHypothesisClusters(
        seamParsed.clusters,
        roomObjectsByRoom,
        seamParsed.explicitOutliers
    )
    if (!combinedResult.ok) {
        return {
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult,
            stageTwoResult: null,
        }
    }

    const combinedMarkdown = renderCombinedHypothesisForStageTwo(combinedResult.combined, roomObjectsByRoom)

    const stageTwoParts = buildHypothesisStageTwoPromptParts({
        roomObjectsByRoom,
        combinedMarkdown,
    })
    const stageTwoResult = await invokeBedrockHypothesisStageTwo(stageTwoParts)

    if (!stageTwoResult.success) {
        return {
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult,
            stageTwoResult,
        }
    }

    const parseOptions: ParseHypothesisModelOutputOptions = {
        reasoningContentProvided: Boolean(stageTwoResult.reasoningContent),
    }
    return {
        record: parseHypothesisModelOutput(stageTwoResult.body, parseOptions),
        stageOneResult,
        stageTwoResult,
        ...(stageTwoResult.reasoningContent !== undefined && stageTwoResult.reasoningContent.length > 0
            ? { stageTwoReasoningContent: stageTwoResult.reasoningContent }
            : {}),
    }
}

/** Same as [`generateHypothesis`] but exposes per-stage Bedrock results (e.g. harness metrics). */
export async function generateHypothesisWithStageResults(
    deps: GenerateHypothesisDeps
): Promise<GenerateHypothesisPipelineResult> {
    return runHypothesisPipeline(deps)
}

/** Generates hypothesis line plus optional scene-analysis scaffolding via two Bedrock round-trips (seam, then scene + Hypothesis). */
export async function generateHypothesis(deps: GenerateHypothesisDeps): Promise<CoyoteGameIntentRecord> {
    const { record } = await runHypothesisPipeline(deps)
    return record
}
