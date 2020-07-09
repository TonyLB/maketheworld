jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() })),
        batchWrite: jest.fn(),
        scan: jest.fn(),
        get: jest.fn(),
        put: jest.fn()
    }
}))

jest.mock('/opt/uuid', () => ({
    v4: jest.fn()
}))

const stripMultiline = (value) => (value.split("\n").map((innerVal) => (innerVal.trim())).join('\n'))

const { documentClient } = require('../utilities')
const { getNeighborhood, putNeighborhood } = require('./neighborhood')
const { v4 } = require('/opt/uuid')

describe("getNeighborhood", () => {

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should return default from an empty scan', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {} }))})
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Retired: false,
            Visibility: 'Private',
            Topology: 'Dead-End'
        })
    })

    it('should return details correctly', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Public',
            Topology: 'Connected'
        } }))})
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Retired: false,
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Public',
            Topology: 'Connected'
        })
    })

    it('should return the retired flag correctly', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'A test description',
            Retired: 'RETIRED'
        } }))})
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Retired: true,
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Private',
            Topology: 'Dead-End'
        })
    })

})

describe("putNeighborhood", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should create a new neighborhood', async () => {
        global.Date.now = jest.fn(() => 123451234567)
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        v4.mockReturnValue('123')
        const data = await putNeighborhood({ arguments: {
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
                            PermanentId: 'NEIGHBORHOOD#123',
                            DataCategory: 'Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Topology: 'Dead-End',
                            Visibility: 'Private'
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                { PutRequest:
                    {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::NEIGHBORHOOD#123::Details',
                            RowId: 'NEIGHBORHOOD#123::Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Topology: 'Dead-End',
                            Visibility: 'Private'
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([
            {
                Map: null,
                Room: null,
                Neighborhood: {
                    PermanentId: '123',
                    ParentId: '987',
                    Name: 'Test',
                    Description: 'A test description',
                    Retired: false,
                    Visibility: 'Private',
                    Topology: 'Dead-End'
                }
            }
        ])
    })

    it('should update an existing neighborhood', async () => {

        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putNeighborhood({ arguments: {
            PermanentId: '123',
            Name: 'Test',
            Description: 'A test description',
            ParentId: '987',
            Visibility: 'Public',
            Topology: 'Connected'
        }})
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                { PutRequest:
                    {
                        Item: {
                            PermanentId: 'NEIGHBORHOOD#123',
                            DataCategory: 'Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Topology: 'Connected',
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
                            DeltaId: '123451234567::NEIGHBORHOOD#123::Details',
                            RowId: 'NEIGHBORHOOD#123::Details',
                            ParentId: '987',
                            Name: 'Test',
                            Description: 'A test description',
                            Topology: 'Connected',
                            Visibility: 'Public'
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([
            {
                Map: null,
                Room: null,
                Neighborhood: {
                    PermanentId: '123',
                    ParentId: '987',
                    Name: 'Test',
                    Description: 'A test description',
                    Retired: false,
                    Visibility: 'Public',
                    Topology: 'Connected'
                }
            }
        ])
    })

})
