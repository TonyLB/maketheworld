import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildHypothesisPrompt } from './buildHypothesisPrompt'
import { invokeBedrockHypothesis } from './invokeBedrockHypothesis'

type HypothesisInputSnapshot = {
    roomObjectsByRoom: Record<EphemeraRoomId, string[]>
}

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

async function loadHypothesisInputSnapshot(deps: GenerateHypothesisDeps): Promise<HypothesisInputSnapshot> {
    const roomKeys = await deps.getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const roomMetaList = await Promise.all(
        roomIds.map(async (roomId) => ({
            roomId,
            meta: await deps.getRoomMeta(roomId),
        }))
    )

    return {
        roomObjectsByRoom: Object.fromEntries(
            roomMetaList.map(({ roomId, meta }) => [
                roomId,
                (meta?.objects ?? []).map(({ shortName }) => shortName),
            ])
        ) as Record<EphemeraRoomId, string[]>,
    }
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
    const snapshot = await loadHypothesisInputSnapshot(deps)
    const prompt = buildHypothesisPrompt(snapshot)
    const invokeResult = await invokeBedrockHypothesis(prompt)
    if (!invokeResult.success) {
        return 'Hypothesis: Stubbed'
    }
    return normalizeHypothesisBody(invokeResult.body) ?? 'Hypothesis: Stubbed'
}
