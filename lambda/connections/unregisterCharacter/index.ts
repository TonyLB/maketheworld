import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import type { ConnectionsCharactersEventUpdate } from "@tonylb/mtw-interfaces/ts/eventBridge/connections/characters"
import { atomicallyRemoveCharacterAdjacency } from "../disconnect"
import { getSessionIdFromConnectionId } from "../registerCharacter"

type StreamCharactersEventFn = (params: {
    update: ConnectionsCharactersEventUpdate
    streamKey: string
    header: { type: string }
}) => Promise<void>

export const unregisterCharacterMessage = async (params: {
    connectionId: string
    characterId: EphemeraCharacterId
    requestId?: string
    streamCharactersEvent: StreamCharactersEventFn
}): Promise<{ messageType: "Unregistration"; CharacterId: EphemeraCharacterId; RequestId?: string }> => {
    const { connectionId, characterId, requestId, streamCharactersEvent } = params
    const sessionId = await getSessionIdFromConnectionId(connectionId)
    if (!sessionId) {
        throw new Error(`Unable to resolve session for connection: ${connectionId}`)
    }

    const { sessionsAfterRemoval } = await atomicallyRemoveCharacterAdjacency(sessionId, characterId)

    if (sessionsAfterRemoval.length === 0) {
        const timestamp = new Date().toISOString()
        await streamCharactersEvent({
            streamKey: characterId,
            header: { type: "Character Disconnected" },
            update: {
                type: "Character Disconnected",
                characterId,
                sessionId,
                timestamp
            }
        })
    }

    return {
        messageType: "Unregistration",
        CharacterId: characterId,
        ...(requestId ? { RequestId: requestId } : {})
    }
}
