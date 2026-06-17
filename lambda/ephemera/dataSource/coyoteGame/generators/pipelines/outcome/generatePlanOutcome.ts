import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame'
import { buildPlanOutcomePromptParts } from './buildPlanOutcomePrompt'
import {
    loadCoyoteRoomObjectsByRoom,
    type CoyoteRoomObjectSnapshotDeps,
    type CoyoteRoomObjectsByRoom,
} from '../../../utilities/coyoteRoomObjectSnapshot'
import { invokeBedrockHypothesis } from '../hypothesis/invokeBedrockHypothesis'

const OUTCOME_STUB: RenderTree = ['Outcome: Stubbed']

export type GeneratePlanOutcomeDeps = CoyoteRoomObjectSnapshotDeps & {
    /** Full durable hypothesis row from `CoyoteGame.get('intent')`. */
    getIntentRecord: () => Promise<CoyoteGameIntentRecord>
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom
    hypothesisLineOverride?: string
    /** Skip `getIntentRecord` when supplying a full record for tests/harnesses. */
    intentRecordOverride?: CoyoteGameIntentRecord
}

function normalizeOutcomeBody(body: string): string | null {
    const trimmed = body.trim()
    if (!trimmed) {
        return null
    }
    const openFence = /^```(?:text)?\s*\n?/i
    const closeFence = /\n?```\s*$/i
    const unwrapped = trimmed.replace(openFence, '').replace(closeFence, '').trim()
    if (!unwrapped) {
        return null
    }
    if (!/^Outcome:/i.test(unwrapped)) {
        return null
    }
    return unwrapped
}

function resolveIntentRecord(deps: GeneratePlanOutcomeDeps): Promise<CoyoteGameIntentRecord> {
    if (deps.intentRecordOverride !== undefined) {
        return Promise.resolve(deps.intentRecordOverride)
    }
    if (deps.hypothesisLineOverride !== undefined) {
        return Promise.resolve({ intent: deps.hypothesisLineOverride })
    }
    return deps.getIntentRecord()
}

/** Single-call LLM plan outcome: Road Runner safe, Coyote poetic backfire. */
export async function generatePlanOutcome(deps: GeneratePlanOutcomeDeps): Promise<RenderTree> {
    const roomObjectsByRoom = deps.roomObjectsByRoomOverride ?? await loadCoyoteRoomObjectsByRoom(deps)
    const intentRecord = await resolveIntentRecord(deps)
    const hypothesisLine = deps.hypothesisLineOverride ?? intentRecord.intent
    const prompt = buildPlanOutcomePromptParts({
        roomObjectsByRoom,
        hypothesisLine,
        walkthrough: intentRecord.walkthrough,
        narrativeBeatsStructured: intentRecord.narrativeBeatsStructured,
        gimmick: intentRecord.gimmick,
        tropeSequence: intentRecord.tropeSequence,
    })
    const invokeResult = await invokeBedrockHypothesis(prompt, { maxTokens: 384 })
    if (!invokeResult.success) {
        return OUTCOME_STUB
    }
    const line = normalizeOutcomeBody(invokeResult.body)
    return line ? [line] : OUTCOME_STUB
}
