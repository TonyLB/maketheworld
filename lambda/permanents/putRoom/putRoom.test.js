jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() })),
        batchWrite: jest.fn(),
        scan: jest.fn(),
        get: jest.fn(),
        put: jest.fn()
    }
}))

const { documentClient } = require('../utilities')
const { putRoom } = require('./putRoom')

describe("putRoom", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should update an existing room', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putRoom({ arguments: {
            PermanentId: '123',
            Name: 'Test',
            Description: 'A test description',
            ParentId: '987'
        }})
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                { PutRequest:
                    {
                        Item: {
                            PermanentId: 'ROOM#123',
                            DataCategory: 'Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Visibility: 'Public'
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                { PutRequest:
                    {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::ROOM#123::Details',
                            RowId: 'ROOM#123::Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Visibility: 'Public'
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([
            {
                Room: {
                    PermanentId: '123',
                    ParentId: '987',
                    Name: 'Test',
                    Description: 'A test description',
                    Retired: false,
                    Visibility: 'Public'
                }
            }
        ])
    })

})
