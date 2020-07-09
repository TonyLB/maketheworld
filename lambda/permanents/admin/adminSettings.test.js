jest.mock('../utilities', () => ({
    documentClient: {
        scan: jest.fn(),
        query: jest.fn(),
        get: jest.fn(),
        batchWrite: jest.fn()
    },
    graphqlClient: {
        mutate: jest.fn(async () => {})
    },
    gql: jest.fn((strings, ...args) => {
        const returnVal = args.map((arg, index) => (strings[index] + arg)).join("") + strings[args.length]
        return returnVal.split("\n").map((innerVal) => (innerVal.trim())).join('\n')
    })
}))
const { getSettings, putSettings } = require('./adminSettings')
const { documentClient, graphqlClient } = require('../utilities')

describe("getSettings", () => {
    it("should return defaults when no setting record", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {} })) })
        const data = await getSettings()
        expect(data).toEqual({
            ChatPrompt: 'What do you do?'
        })
    })
    it("should return settings when present", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            ChatPrompt: 'What happens next?'
        } })) })
        const data = await getSettings()
        expect(data).toEqual({
            ChatPrompt: 'What happens next?'
        })

    })
})

describe("putSettings", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it("should return empty when no ChatPrompt provided", async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putSettings({})
        expect(documentClient.batchWrite.mock.calls.length).toBe(0)
        expect(data).toEqual([])
    })

    it("should return update when ChatPrompt provided", async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putSettings({ ChatPrompt: 'What now?' })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'ADMIN',
                            DataCategory: 'Details',
                            ChatPrompt: 'What now?'
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::ADMIN::Details',
                            RowId: 'ADMIN::Details',
                            ChatPrompt: 'What now?'
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{
            Settings: { ChatPrompt: 'What now?' }
        }])
    })

})