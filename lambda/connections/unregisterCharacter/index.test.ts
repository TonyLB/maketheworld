import { beforeEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@tonylb/mtw-utilities/ts/dynamoDB", () => {
    const actual = jest.requireActual("@tonylb/mtw-utilities/ts/dynamoDB") as typeof import("@tonylb/mtw-utilities/ts/dynamoDB")
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            getItem: jest.fn(),
            transactWrite: jest.fn()
        }),
        exponentialBackoffWrapper: jest.fn(async (callback: () => Promise<unknown>) => callback())
    }
})

jest.mock("../disconnect", () => ({
    atomicallyRemoveCharacterAdjacency: jest.fn()
}))

jest.mock("../registerCharacter", () => ({
    getSessionIdFromConnectionId: jest.fn()
}))

import { atomicallyRemoveCharacterAdjacency } from "../disconnect"
import { getSessionIdFromConnectionId } from "../registerCharacter"
import { unregisterCharacterMessage } from "."

const getSessionIdFromConnectionIdMock = jest.mocked(getSessionIdFromConnectionId)
const atomicallyRemoveCharacterAdjacencyMock = jest.mocked(atomicallyRemoveCharacterAdjacency)

describe("unregisterCharacterMessage", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("removes adjacency and emits Character Disconnected when last session is removed", async () => {
        getSessionIdFromConnectionIdMock.mockResolvedValue("session-1")
        atomicallyRemoveCharacterAdjacencyMock.mockResolvedValue({ sessionsAfterRemoval: [] })
        const streamCharactersEvent = jest.fn(async () => undefined)

        const response = await unregisterCharacterMessage({
            connectionId: "connection-1",
            characterId: "CHARACTER#abc",
            requestId: "request-1",
            streamCharactersEvent
        })

        expect(atomicallyRemoveCharacterAdjacencyMock).toHaveBeenCalledWith("session-1", "CHARACTER#abc")
        expect(streamCharactersEvent).toHaveBeenCalledWith(expect.objectContaining({
            streamKey: "CHARACTER#abc",
            header: { type: "Character Disconnected" },
            update: expect.objectContaining({
                type: "Character Disconnected",
                characterId: "CHARACTER#abc",
                sessionId: "session-1"
            })
        }))
        expect(response).toEqual({
            messageType: "Unregistration",
            CharacterId: "CHARACTER#abc",
            RequestId: "request-1"
        })
    })

    it("does not emit Character Disconnected when other sessions remain", async () => {
        getSessionIdFromConnectionIdMock.mockResolvedValue("session-1")
        atomicallyRemoveCharacterAdjacencyMock.mockResolvedValue({ sessionsAfterRemoval: ["SESSION#other"] })
        const streamCharactersEvent = jest.fn(async () => undefined)

        await unregisterCharacterMessage({
            connectionId: "connection-1",
            characterId: "CHARACTER#abc",
            streamCharactersEvent
        })

        expect(streamCharactersEvent).not.toHaveBeenCalled()
    })

    it("throws when session cannot be resolved from connection", async () => {
        getSessionIdFromConnectionIdMock.mockResolvedValue(undefined)

        await expect(unregisterCharacterMessage({
            connectionId: "connection-missing",
            characterId: "CHARACTER#abc",
            streamCharactersEvent: async () => undefined
        })).rejects.toThrow("Unable to resolve session for connection: connection-missing")
    })
})
