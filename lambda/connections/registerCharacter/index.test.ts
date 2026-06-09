import { beforeEach, describe, expect, it, jest } from "@jest/globals"

jest.mock("@tonylb/mtw-utilities/ts/dynamoDB", () => {
    const actual = jest.requireActual("@tonylb/mtw-utilities/ts/dynamoDB") as typeof import("@tonylb/mtw-utilities/ts/dynamoDB")
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            getItem: jest.fn(),
            transactWrite: jest.fn()
        }),
        exponentialBackoffWrapper: jest.fn(async (callback: () => Promise<void>) => {
            await callback()
        })
    }
})

import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { registerCharacterMessage } from "."

const connectionDBMock = jest.mocked(connectionDB)
const getItemMock = connectionDBMock.getItem as unknown as jest.Mock<any>
const transactWriteMock = connectionDBMock.transactWrite as unknown as jest.Mock<any>

const invokeTransactWriteSuccessCallback = async (prior: { sessions?: string[] }) => {
    transactWriteMock.mockImplementation(async (items: any[]) => {
        const updateItem = items.find((item) => "Update" in item)
        const successCallback = updateItem?.Update?.successCallback
        if (successCallback) {
            await successCallback({ sessions: prior.sessions ?? [] }, prior)
        }
    })
}

describe("registerCharacterMessage", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("writes session-character adjacency and emits Character Registered", async () => {
        getItemMock.mockResolvedValue({
            SessionId: "session-1"
        })
        await invokeTransactWriteSuccessCallback({ sessions: [] })
        const streamEvent = jest.fn(async () => undefined)

        const response = await registerCharacterMessage({
            connectionId: "connection-1",
            characterId: "CHARACTER#abc",
            requestId: "request-1",
            streamEvent
        })

        expect(getItemMock).toHaveBeenCalledWith({
            Key: {
                ConnectionId: "CONNECTION#connection-1",
                DataCategory: "Meta::Connection"
            },
            ProjectionFields: ["SessionId"]
        })
        expect(transactWriteMock).toHaveBeenCalledTimes(1)
        expect(transactWriteMock.mock.calls[0][0]).toEqual([
            {
                Put: {
                    ConnectionId: "SESSION#session-1",
                    DataCategory: "CHARACTER#abc"
                }
            },
            {
                Update: expect.objectContaining({
                    Key: {
                        ConnectionId: "CHARACTER#abc",
                        DataCategory: "Meta::Character"
                    }
                })
            }
        ])
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            streamKey: "CHARACTER#abc",
            header: { type: "Character Registered" },
            update: expect.objectContaining({
                type: "Character Registered",
                characterId: "CHARACTER#abc",
                sessionId: "session-1",
                isFirstSessionForCharacter: true
            })
        }))
        expect(response).toEqual({
            messageType: "Registration",
            CharacterId: "CHARACTER#abc",
            RequestId: "request-1"
        })
    })

    it("sets isFirstSessionForCharacter false when character already has sessions", async () => {
        getItemMock.mockResolvedValue({
            SessionId: "session-2"
        })
        await invokeTransactWriteSuccessCallback({ sessions: ["session-other"] })
        const streamEvent = jest.fn(async () => undefined)

        await registerCharacterMessage({
            connectionId: "connection-1",
            characterId: "CHARACTER#abc",
            streamEvent
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                isFirstSessionForCharacter: false
            })
        }))
    })

    it("leaves isFirstSessionForCharacter false when transactWrite successCallback does not run", async () => {
        getItemMock.mockResolvedValue({
            SessionId: "session-1"
        })
        transactWriteMock.mockResolvedValue(undefined)
        const streamEvent = jest.fn(async () => undefined)

        await registerCharacterMessage({
            connectionId: "connection-1",
            characterId: "CHARACTER#abc",
            streamEvent
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                isFirstSessionForCharacter: false
            })
        }))
    })

    it("throws when session cannot be resolved from connection", async () => {
        getItemMock.mockResolvedValue(undefined)
        transactWriteMock.mockResolvedValue(undefined)

        await expect(registerCharacterMessage({
            connectionId: "connection-missing",
            characterId: "CHARACTER#abc",
            streamEvent: async () => undefined
        })).rejects.toThrow("Unable to resolve session for connection: connection-missing")
    })
})
