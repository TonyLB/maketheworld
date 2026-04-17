import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'
import { buildHypothesisPromptParts } from './buildHypothesisPrompt'
import { loadCoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'
import { parseHypothesisModelOutput } from './parseHypothesisModelOutput'

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    roomObjectsByRoomOverride?: Record<EphemeraRoomId, string[]>
}

/** Generates hypothesis line plus optional scene-analysis scaffolding from the model. */
export async function generateHypothesis(deps: GenerateHypothesisDeps): Promise<CoyoteGameIntentRecord> {
    const roomObjectsByRoom = deps.roomObjectsByRoomOverride ?? await loadCoyoteRoomObjectsByRoom(deps)
    const prompt = buildHypothesisPromptParts({ roomObjectsByRoom })
    const invokeResult = await invokeBedrockHypothesis(prompt)
    if (!invokeResult.success) {
        return { intent: 'Hypothesis: Stubbed' }
    }
    return parseHypothesisModelOutput(invokeResult.body)
}
