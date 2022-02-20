import { jest } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')

import {
    assetDB,
    // ephemeraDB,
    // mergeIntoDataRange,
    // batchWriteDispatcher
} from '/opt/utilities/dynamoDB/index.js'

import {
    fetchAssetMetaData
} from './cache.js'

describe('fetchAssetMetaData', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should return mocked fileName', async () => {
        assetDB.getItem.mockResolvedValue({ fileName: 'Test.wml' })
        const fetchData = await fetchAssetMetaData('Test')
        expect(fetchData).toEqual('Test.wml')
    })
})