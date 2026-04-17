import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildPlanOutcomePromptParts } from './buildPlanOutcomePrompt'
import { loadCoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

const OUTCOME_STUB: RenderTree = ['Outcome: Stubbed']

export type GeneratePlanOutcomeDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    /** Current hypothesis line (from `CoyoteGame.get('intent')`). */
    getIntent: () => Promise<string>
    roomObjectsByRoomOverride?: Record<EphemeraRoomId, string[]>
    hypothesisLineOverride?: string
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

/** Single-call LLM plan outcome: Road Runner safe, Coyote poetic backfire. */
export async function generatePlanOutcome(deps: GeneratePlanOutcomeDeps): Promise<RenderTree> {
    const roomObjectsByRoom = deps.roomObjectsByRoomOverride ?? await loadCoyoteRoomObjectsByRoom(deps)
    const hypothesisLine = deps.hypothesisLineOverride ?? await deps.getIntent()
    const prompt = buildPlanOutcomePromptParts({ roomObjectsByRoom, hypothesisLine })
    const invokeResult = await invokeBedrockHypothesis(prompt, { maxTokens: 384 })
    if (!invokeResult.success) {
        return OUTCOME_STUB
    }
    const line = normalizeOutcomeBody(invokeResult.body)
    return line ? [line] : OUTCOME_STUB
}
