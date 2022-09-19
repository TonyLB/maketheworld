const dbMock = () => ({
    getItem: jest.fn(),
    batchGetItem: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    optimisticUpdate: jest.fn(),
    putItem: jest.fn(),
    deleteItem: jest.fn()
})

export const assetDB = dbMock()
export const ephemeraDB = dbMock()
export const connectionDB = dbMock()

export const mergeIntoDataRange = jest.fn()
export const batchWriteDispatcher = jest.fn()

export const publishMessage = jest.fn()
export const messageDeltaQuery = jest.fn()

export const exponentialBackoffWrapper = jest.fn(async (testFunc) => { await testFunc() })
export const multiTableTransactWrite = jest.fn()
