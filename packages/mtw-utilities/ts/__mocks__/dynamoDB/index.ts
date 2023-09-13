const dbMock = () => ({
    getItem: jest.fn(),
    batchGetItem: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    putItem: jest.fn(),
    deleteItem: jest.fn()
})

export const ephemeraDB = dbMock()
export const assetDB = dbMock()
export const legacyConnectionDB = dbMock()
export const connectionDB = dbMock()

export const messageDeltaQuery = jest.fn()

export const exponentialBackoffWrapper = jest.fn((testFunc) => { testFunc() })
