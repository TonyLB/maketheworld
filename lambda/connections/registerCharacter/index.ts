import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { ConnectionsEventUpdate } from "@tonylb/mtw-interfaces/ts/eventBridge/connections"
import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/ts/lists"

type StreamEventFn = (params: {
    update: ConnectionsEventUpdate
    streamKey: string
    header: { type: string }
}) => Promise<void>

const getSessionIdFromConnectionId = async (connectionId: string): Promise<string | undefined> => {
    const response = await connectionDB.getItem<{ SessionId?: string }>({
        Key: {
            ConnectionId: `CONNECTION#${connectionId}`,
            DataCategory: "Meta::Connection"
        },
        ProjectionFields: ["SessionId"]
    })
    const { SessionId } = response || {}
    if (typeof SessionId === "string" && SessionId.length > 0) {
        return SessionId
    }
    return undefined
}

export const registerCharacterMessage = async (params: {
    connectionId: string
    characterId: EphemeraCharacterId
    requestId?: string
    streamEvent: StreamEventFn
}): Promise<{ messageType: "Registration"; CharacterId: EphemeraCharacterId; RequestId?: string }> => {
    const { connectionId, characterId, requestId, streamEvent } = params
    const sessionId = await getSessionIdFromConnectionId(connectionId)
    if (!sessionId) {
        throw new Error(`Unable to resolve session for connection: ${connectionId}`)
    }
    await exponentialBackoffWrapper(async () => {
        await connectionDB.transactWrite([
            {
                Put: {
                    ConnectionId: `SESSION#${sessionId}`,
                    DataCategory: characterId
                }
            },
            {
                Update: {
                    Key: {
                        ConnectionId: characterId,
                        DataCategory: "Meta::Character"
                    },
                    updateKeys: ["sessions"],
                    updateReducer: (draft) => {
                        draft.sessions = unique(draft.sessions || [], [sessionId])
                    }
                }
            }
        ])
    }, { retryErrors: ["TransactionCanceledException"] })

    await streamEvent({
        streamKey: characterId,
        header: { type: "Character Registered" },
        update: {
            type: "Character Registered",
            characterId,
            sessionId,
            timestamp: new Date().toISOString()
        }
    })

    return {
        messageType: "Registration",
        CharacterId: characterId,
        ...(requestId ? { RequestId: requestId } : {})
    }
}

