import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'

type HypothesisInputSnapshot = {
    roomObjectsByRoom: Record<EphemeraRoomId, string[]>
}

async function loadHypothesisInputSnapshot(): Promise<HypothesisInputSnapshot> {
    const roomKeys = await internalCache.CoyoteGame.get('gameRooms')
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const roomMetaList = await Promise.all(
        roomIds.map(async (roomId) => ({
            roomId,
            meta: await internalCache.ComponentEphemeraMeta.get(roomId),
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

/** Stub LLM hypothesis body; replace with real generation later. */
export async function generateHypothesis(): Promise<RenderTree> {
    const snapshot = await loadHypothesisInputSnapshot()
    void snapshot
    return ['Hypothesis: Stubbed']
}
