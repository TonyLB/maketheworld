const { getRoomRecap } = require('./getRoomRecap')
const { gqlOutput } = require('./gqlOutput')
jest.mock('./utilities', () => ({
    documentClient: {
        query: jest.fn(),
        batchGet: jest.fn()
    }
}))

const { documentClient } = require('./utilities')

describe("getRoomRecap", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should return nothing when no messages', async () => {

        global.Date.now = jest.fn(() => 12345600000)
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: []}))})

        const data = await getRoomRecap('VORTEX')
        expect(documentClient.batchGet.mock.calls.length).toEqual(0)
        expect(data).toEqual([])
    })

    it('should return recap values', async () => {

        global.Date.now = jest.fn(() => 12345600000)
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                MessageId: 'ROOM#VORTEX',
                DataCategory: 'MESSAGE#456',
                CreatedTime: 12345400000
            },
            {
                MessageId: 'ROOM#VORTEX',
                DataCategory: 'MESSAGE#123',
                CreatedTime: 12345100000
            }
        ]}))})
        documentClient.batchGet.mockReturnValue({ promise: () => (Promise.resolve({ Responses: { undefined_messages: [
            {
                MessageId: 'MESSAGE#456',
                DataCategory: 'Contents',
                Message: 'Test Two',
                CreatedTime: 12345400000
            },
            {
                MessageId: 'MESSAGE#123',
                DataCategory: 'Contents',
                Message: 'Test One',
                CreatedTime: 12345100000
            }
        ]}}))})

        const data = await getRoomRecap('VORTEX')
        expect(data).toEqual([
            {
                MessageId: '123',
                Target: 'VORTEX',
                Message: 'Test One',
                CreatedTime: 12345100000
            },
            {
                MessageId: '456',
                Target: 'VORTEX',
                Message: 'Test Two',
                CreatedTime: 12345400000
            }
        ])
    })

})
