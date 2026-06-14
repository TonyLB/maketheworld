jest.mock("@tonylb/mtw-utilities/ts/dynamoDB", () => {
    const actual = jest.requireActual("@tonylb/mtw-utilities/ts/dynamoDB") as typeof import("@tonylb/mtw-utilities/ts/dynamoDB")
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            transactWrite: jest.fn()
        }),
        exponentialBackoffWrapper: jest.fn(async (callback: () => Promise<unknown>) => callback())
    }
})

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import { atomicallyRemoveCharacterAdjacency } from '.'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>

describe("atomicallyRemoveCharacterAdjacency", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it("removes session adjacency and returns post-removal sessions", async () => {
        connectionDBMock.transactWrite.mockImplementation(async (transactions: any[]) => {
            const updateTransaction = transactions.find((t: any) => t.Update)
            updateTransaction?.Update?.successCallback?.({ sessions: ['SESSION#other'] })
            return undefined
        })

        const result = await atomicallyRemoveCharacterAdjacency('1234', 'CHARACTER#TestChar')

        expect(connectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(connectionDBMock.transactWrite.mock.calls[0][0]).toEqual([
            { Delete: { ConnectionId: 'SESSION#1234', DataCategory: 'CHARACTER#TestChar' } },
            { Update: {
                Key: { ConnectionId: 'CHARACTER#TestChar', DataCategory: 'Meta::Character' },
                updateKeys: ['sessions'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function),
                deleteCondition: expect.any(Function),
            }}
        ])
        expect(result).toEqual({ sessionsAfterRemoval: ['SESSION#other'] })
    })

    it("returns empty sessions when character row is deleted after last session removal", async () => {
        connectionDBMock.transactWrite.mockImplementation(async (transactions: any[]) => {
            const updateTransaction = transactions.find((t: any) => t.Update)
            updateTransaction?.Update?.successCallback?.({ sessions: [] })
            return undefined
        })

        const result = await atomicallyRemoveCharacterAdjacency('1234', 'CHARACTER#TestChar')

        expect(result).toEqual({ sessionsAfterRemoval: [] })
    })

})
