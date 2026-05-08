import { jest, describe, it, expect, beforeEach } from "@jest/globals"

jest.mock("@tonylb/mtw-utilities/ts/dynamoDB", () => {
    const actual = jest.requireActual("@tonylb/mtw-utilities/ts/dynamoDB") as typeof import("@tonylb/mtw-utilities/ts/dynamoDB")
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            getItem: jest.fn()
        })
    }
})

import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { processConnectionsCharactersSubscribedEvents } from "./charactersDataSource"

const connectionDBMock = jest.mocked(connectionDB)
const getItemMock = connectionDBMock.getItem as unknown as jest.Mock

const makeEnvelope = (type: string, content: any) => ({
    header: {
        dataSourceKey: "mtw.connections",
        streamKey: "global",
        timestamp: Date.now(),
        type
    },
    getContent: async () => content
})

describe("connectionsCharacters subscribed event processing", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        connectionDBMock.getItem.mockReset()
    })

    it("emits no Connected/Disconnected for multi-session characters", async () => {
        const characterId = "CHARACTER#c1"
        getItemMock.mockImplementation(async ({ Key }: any) => {
            if (Key.ConnectionId === characterId) {
                return { sessions: ["session-a", "session-b"] }
            }
            return { sessions: [] }
        })

        const streamEvent = jest.fn(async (_params: any) => undefined)

        await processConnectionsCharactersSubscribedEvents([
            makeEnvelope("Character Registered", {
                type: "Character Registered",
                characterId,
                sessionId: "session-a",
                timestamp: "2026-01-01T00:00:00.000Z"
            })
        ], streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(0)

        await processConnectionsCharactersSubscribedEvents([
            makeEnvelope("Session Disconnect", {
                type: "Session Disconnect",
                sessionId: "session-a",
                characterIds: [characterId],
                timestamp: "2026-01-01T00:01:00.000Z"
            })
        ], streamEvent)

        // After teardown, character still has another active session -> no disconnected transition.
        expect(streamEvent).toHaveBeenCalledTimes(0)
    })

    it("emits Connected (duplicates allowed) when Meta::Character.sessions is empty", async () => {
        const characterId = "CHARACTER#c2"
        getItemMock.mockImplementation(async ({ Key }: any) => {
            if (Key.ConnectionId === characterId) {
                return { sessions: [] }
            }
            return { sessions: [] }
        })

        const streamEvent = jest.fn(async (_params: any) => undefined)

        await processConnectionsCharactersSubscribedEvents([
            makeEnvelope("Character Registered", {
                type: "Character Registered",
                characterId,
                sessionId: "session-x",
                timestamp: "2026-01-01T00:00:00.000Z"
            }),
            makeEnvelope("Character Registered", {
                type: "Character Registered",
                characterId,
                sessionId: "session-x",
                timestamp: "2026-01-01T00:00:00.000Z"
            })
        ], streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0]).toEqual(expect.objectContaining({
            streamKey: characterId,
            header: { type: "Character Connected" },
            update: expect.objectContaining({
                type: "Character Connected",
                characterId,
                sessionId: "session-x"
            })
        }))
    })

    it("emits Disconnected only when teardown leaves Meta::Character.sessions empty", async () => {
        const characterId = "CHARACTER#c3"
        getItemMock.mockImplementation(async ({ Key }: any) => {
            if (Key.ConnectionId === characterId) {
                return { sessions: [] }
            }
            return { sessions: ["session-other"] }
        })

        const streamEvent = jest.fn(async (_params: any) => undefined)

        await processConnectionsCharactersSubscribedEvents([
            makeEnvelope("Session Disconnect", {
                type: "Session Disconnect",
                sessionId: "session-last",
                characterIds: [characterId],
                timestamp: "2026-01-01T00:01:00.000Z"
            })
        ], streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent.mock.calls[0][0]).toEqual(expect.objectContaining({
            streamKey: characterId,
            header: { type: "Character Disconnected" },
            update: expect.objectContaining({
                type: "Character Disconnected",
                characterId,
                sessionId: "session-last"
            })
        }))
    })
})

