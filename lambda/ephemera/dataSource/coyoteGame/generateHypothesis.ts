import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'
import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt'
import { buildHypothesisStageTwoPromptParts } from './buildHypothesisStageTwoPrompt'
import {
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis'
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { parseHypothesisModelOutput } from './parseHypothesisModelOutput'
import { parseHypothesisStageOneOutput } from './parseHypothesisStageOneOutput'

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom
}

/** Failure policy (two-round pipeline): any stage-1/stage-2 Bedrock failure or invalid seam yields stub intent only — no partial hypothesis to players. */

export type GenerateHypothesisPipelineResult = {
    record: CoyoteGameIntentRecord
    stageOneResult: InvokeBedrockHypothesisResult
    stageTwoResult: InvokeBedrockHypothesisResult | null
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

    const stageTwoParts = buildHypothesisStageTwoPromptParts({
        roomObjectsByRoom,
        seamMarkdown: seamParsed.markdown,
    })
    const stageTwoResult = await invokeBedrockHypothesisStageTwo(stageTwoParts)

    if (!stageTwoResult.success) {
        return {
            record: { intent: 'Hypothesis: Stubbed' },
            stageOneResult,
            stageTwoResult,
        }
    }

    return {
        record: parseHypothesisModelOutput(stageTwoResult.body),
        stageOneResult,
        stageTwoResult,
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
