const dbMock = () => ({
    getItem: jest.fn(),
    batchGetItem: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    putItem: jest.fn(),
    getItem: jest.fn()
})

export const assetDB = dbMock()
export const ephemeraDB = dbMock()

export const batchWriteDispatcher = jest.fn()
export const mergeIntoDataRange = jest.fn()

export const publishMessage = jest.fn()
export const messageDeltaQuery = jest.fn()
