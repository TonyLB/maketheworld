jest.mock('./utilities', () => ({
    documentClient: {
        scan: jest.fn(),
        query: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        put: jest.fn(),
        delete: jest.fn()
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
const { documentClient, graphqlClient } = require('./utilities')

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
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should return empty when no ChatPrompt provided", async () => {
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putSettings({})
        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(data).toEqual([])
    })

    it("should return update when ChatPrompt provided", async () => {
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putSettings({ ChatPrompt: 'What now?' })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'ADMIN',
                DataCategory: 'Details',
                ChatPrompt: 'What now?'
            }
        })
        expect(data).toEqual([{
            Settings: { ChatPrompt: 'What now?' }
        }])
    })

})