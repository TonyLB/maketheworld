jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(),
        batchWrite: jest.fn(),
        scan: jest.fn(),
        put: jest.fn()
    }
}))

jest.mock('/opt/uuid', () => ({
    v4: jest.fn()
}))

const { documentClient } = require('../utilities')
const { getMaps, putMap } = require('./map')
const { v4 } = require('/opt/uuid')

describe("getMaps", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })
    it('should return empty from an empty scan', async () => {
        documentClient.scan.mockReturnValue({ promise: () => (Promise.resolve({ Items: []}))})
        const data = await getMaps()
        expect(documentClient.scan.mock.calls.length).toBe(1)
        expect(data).toEqual([])
    })

    it('should return properly', async () => {
        documentClient.scan.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                PermanentId: 'MAP#123',
                DataCategory: 'ROOM#ABC',
                X: 200,
                Y: 300
            },
            {
                PermanentId: 'MAP#123',
                DataCategory: 'Details',
                Name: 'Test Map One',
                Rooms: [
                    {
                        PermanentId: 'ABC',
                        X: 200,
                        Y: 300        
                    },
                    {
                        PermanentId: 'DEF',
                        X: 400,
                        Y: 200,
                        Locked: true        
                    }
                ]
            },
            {
                PermanentId: 'MAP#456',
                DataCategory: 'Details',
                Name: 'Test Map Two',
                Rooms: [
                    {
                        PermanentId: 'VORTEX',
                        X: 300,
                        Y: 200
                    }
                ]
            },
        ]}))})
        const data = await getMaps()
        expect(documentClient.scan.mock.calls.length).toBe(1)
        expect(data).toEqual([
            {
                MapId: '123',
                Name: 'Test Map One',
                Rooms: [
                    {
                        PermanentId: 'ABC',
                        X: 200,
                        Y: 300
                    },
                    {
                        PermanentId: 'DEF',
                        X: 400,
                        Y: 200,
                        Locked: true
                    }
                ]
            },
            {
                MapId: '456',
                Name: 'Test Map Two',
                Rooms: [
                    {
                        PermanentId: 'VORTEX',
                        X: 300,
                        Y: 200
                    }
                ]
            }
        ])
    })
})

describe("putMap", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    const baseMap = {
        MapId: '123',
        Name: 'Test Map',
        Rooms: [
            {
                PermanentId: 'ABC',
                X: 200,
                Y: 300
            },
            {
                PermanentId: 'DEF',
                X: 400,
                Y: 300,
                Locked: true
            }
        ]
    }
    const detailRow = {
        PermanentId: 'MAP#123',
        DataCategory: 'Details',
        Name: 'Test Map'
    }
    const detailPut = {
        PutRequest: {
            Item: detailRow
        }
    }
    const roomOneRow = {
        PermanentId: 'MAP#123',
        DataCategory: 'ROOM#ABC',
        X: 200,
        Y: 300
    }
    const roomOnePut = {
        PutRequest: {
            Item: roomOneRow
        }
    }
    const roomTwoRow = {
        PermanentId: 'MAP#123',
        DataCategory: 'ROOM#DEF',
        X: 400,
        Y: 300,
        Locked: true
    }
    const roomTwoPut = {
        PutRequest: {
            Item: roomTwoRow
        }
    }
    const roomThreeRow = {
        PermanentId: 'MAP#123',
        DataCategory: 'ROOM#GHI',
        X: 300,
        Y: 400
    }
    const roomThreePut = {
        PutRequest: {
            Item: roomThreeRow
        }
    }

    it('should create a new map', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        v4.mockReturnValue('123')
        const { MapId, ...rest } = baseMap
        const data = await putMap(rest)
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Map',
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 200,
                    Y: 300
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300,
                    Locked: true
                }
            ]
        }}])
    })

    it('should update map details', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        const data = await putMap({ ...baseMap, Name: 'Test Change'})
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Change',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Change',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Change',
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 200,
                    Y: 300
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300,
                    Locked: true
                }
            ]
        }}])

    })

    it('should add a room to a map', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        const data = await putMap({
            ...baseMap,
            Rooms: [
                ...baseMap.Rooms,
                {
                    PermanentId: 'GHI',
                    X: 300,
                    Y: 400
                }
            ]
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                },
                                {
                                    PermanentId: 'GHI',
                                    X: 300,
                                    Y: 400
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                },
                                {
                                    PermanentId: 'GHI',
                                    X: 300,
                                    Y: 400
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Map',
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 200,
                    Y: 300
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300,
                    Locked: true
                },
                {
                    PermanentId: 'GHI',
                    X: 300,
                    Y: 400
                }
            ]
        }}])

    })

    it('should remove a room from a map', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        const data = await putMap({
            ...baseMap,
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 200,
                    Y: 300
                }
            ]
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 200,
                                    Y: 300
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Map',
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 200,
                    Y: 300
                }
            ]
        }}])

    })

    it('should update a room', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        const data = await putMap({
            ...baseMap,
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 250,
                    Y: 350
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300,
                    Locked: true
                }
            ]
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 250,
                                    Y: 350
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Map',
                            Rooms: [
                                {
                                    PermanentId: 'ABC',
                                    X: 250,
                                    Y: 350
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300,
                                    Locked: true
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Map',
            Rooms: [
                {
                    PermanentId: 'ABC',
                    X: 250,
                    Y: 350
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300,
                    Locked: true
                }
            ]
        }}])

    })

    it('should perform all changes together', async () => {
        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve()) })
        const data = await putMap({
            ...baseMap,
            Name: 'Test Change',
            Rooms: [
                {
                    PermanentId: 'GHI',
                    X: 250,
                    Y: 350
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300
                }
            ]
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#123',
                            DataCategory: 'Details',
                            Name: 'Test Change',
                            Rooms: [
                                {
                                    PermanentId: 'GHI',
                                    X: 250,
                                    Y: 350
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300
                                }
                            ]
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::MAP#123::Details',
                            RowId: 'MAP#123::Details',
                            Name: 'Test Change',
                            Rooms: [
                                {
                                    PermanentId: 'GHI',
                                    X: 250,
                                    Y: 350
                                },
                                {
                                    PermanentId: 'DEF',
                                    X: 400,
                                    Y: 300
                                }
                            ]
                        }
                    }
                }
            ]
        }})
        expect(data).toEqual([{ Map: {
            MapId: '123',
            Name: 'Test Change',
            Rooms: [
                {
                    PermanentId: 'GHI',
                    X: 250,
                    Y: 350
                },
                {
                    PermanentId: 'DEF',
                    X: 400,
                    Y: 300
                }
            ]
        }}])

    })
})