const dbMock = () => ({
    getItem: jest.fn(),
    batchGetItem: jest.fn(),
    getItems: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    optimisticUpdate: jest.fn(),
    putItem: jest.fn(),
    deleteItem: jest.fn(),
    merge: jest.fn(),
    mergeTransact: jest.fn(),
    transactWrite: jest.fn()
})

export const ephemeraDB = dbMock()
export const assetDB = dbMock()
export const legacyConnectionDB = dbMock()
export const connectionDB = dbMock()
export const messageDeltaDB = {
    putItem: jest.fn()
}

export const messageDeltaQuery = jest.fn()

export const exponentialBackoffWrapper = jest.fn(async (testFunc) => { await testFunc() })
