import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildHypothesisPrompt } from './buildHypothesisPrompt'
import { loadCoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

function normalizeHypothesisBody(body: string): string | null {
    const trimmed = body.trim()
    if (!trimmed) {
        return null
    }
    const openFence = /^```(?:text)?\s*\n?/i
    const closeFence = /\n?```\s*$/i
    const unwrapped = trimmed.replace(openFence, '').replace(closeFence, '').trim()
    return unwrapped || null
}

/** Generates a single plain-text hypothesis sentence. */
export async function generateHypothesis(deps: GenerateHypothesisDeps): Promise<string> {
    const roomObjectsByRoom = await loadCoyoteRoomObjectsByRoom(deps)
    const prompt = buildHypothesisPrompt({ roomObjectsByRoom })
    const invokeResult = await invokeBedrockHypothesis(prompt)
    if (!invokeResult.success) {
        return 'Hypothesis: Stubbed'
    }
    return normalizeHypothesisBody(invokeResult.body) ?? 'Hypothesis: Stubbed'
}
