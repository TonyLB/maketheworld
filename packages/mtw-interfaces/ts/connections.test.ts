import {
    isConnectionsAPIMessage,
    isRegisterCharacterConnectionsAPIMessage,
    isUnregisterCharacterConnectionsAPIMessage
} from "./connections"

describe("ConnectionsAPIMessage typeguards", () => {
    it("accepts valid registercharacter payload", () => {
        const payload = {
            message: "registercharacter",
            CharacterId: "CHARACTER#abc",
            RequestId: "request-1"
        } as const
        expect(isConnectionsAPIMessage(payload)).toBe(true)
        expect(isRegisterCharacterConnectionsAPIMessage(payload)).toBe(true)
    })

    it("accepts valid unregistercharacter payload", () => {
        const payload = {
            message: "unregistercharacter",
            CharacterId: "CHARACTER#abc",
            RequestId: "request-1"
        } as const
        expect(isConnectionsAPIMessage(payload)).toBe(true)
        expect(isUnregisterCharacterConnectionsAPIMessage(payload)).toBe(true)
    })

    it("rejects invalid CharacterId format", () => {
        expect(isConnectionsAPIMessage({
            message: "registercharacter",
            CharacterId: "ROOM#abc"
        })).toBe(false)
    })

    it("rejects unknown message types", () => {
        expect(isConnectionsAPIMessage({
            message: "sync",
            CharacterId: "CHARACTER#abc"
        })).toBe(false)
    })
})

