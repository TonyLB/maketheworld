import { EphemeraCharacterId, isEphemeraCharacterId } from "./baseClasses"
import { checkTypes } from "./utils"

export type RegisterCharacterConnectionsAPIMessage = {
    message: "registercharacter"
    CharacterId: EphemeraCharacterId
}

export type UnregisterCharacterConnectionsAPIMessage = {
    message: "unregistercharacter"
    CharacterId: EphemeraCharacterId
}

export type ConnectionsAPIMessage = { RequestId?: string } & (
    RegisterCharacterConnectionsAPIMessage |
    UnregisterCharacterConnectionsAPIMessage
)

export const isRegisterCharacterConnectionsAPIMessage = (
    message: ConnectionsAPIMessage
): message is RegisterCharacterConnectionsAPIMessage => (
    message.message === "registercharacter"
)

export const isUnregisterCharacterConnectionsAPIMessage = (
    message: ConnectionsAPIMessage
): message is UnregisterCharacterConnectionsAPIMessage => (
    message.message === "unregistercharacter"
)

export const isConnectionsAPIMessage = (message: any): message is ConnectionsAPIMessage => {
    if (typeof message !== "object" || message === null) {
        return false
    }
    if (!("message" in message)) {
        return false
    }
    switch(message.message) {
        case "registercharacter":
        case "unregistercharacter":
            return Boolean(
                checkTypes(message, { CharacterId: "string" }, { RequestId: "string" })
                && isEphemeraCharacterId(message.CharacterId)
            )
        default:
            return false
    }
}

