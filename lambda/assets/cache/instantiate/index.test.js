import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    assetDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../parseWMLFile.js')
import parseWMLFile from '../parseWMLFile.js'
jest.mock('../mergeEntries.js')
jest.mock('@tonylb/mtw-utilities/dist/executeCode/recalculateComputes')
import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'

jest.mock('./localize.js')
import { localizeDBEntries } from './localize.js'
jest.mock('../index')
import { cacheAsset } from '../index'
jest.mock('../assetMetaData.js')
import AssetMetaData from '../assetMetaData.js'

import instantiateAsset from './index.js'

describe('instantiate Asset', () => {
    const assetMetaDataMock = {
        checkEphemera: jest.fn(),
        fetch: jest.fn(),
        pushEphemera: jest.fn()
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()

        AssetMetaData.mockImplementation(() => (assetMetaDataMock))
    })

    it('should skip processing when no asset', async () => {
        await instantiateAsset()

        expect(assetDB.getItem).toHaveBeenCalledTimes(0)
    })

    it('should recursively cache when recursive option set true', async () => {
        assetMetaDataMock.fetch.mockResolvedValue({
            fileName: 'test',
            importTree: { BASE: {} },
            instance: true
        })

        localizeDBEntries.mockResolvedValue({
            scopeMap: { VORTEX: 'ROOM#VORTEX', Welcome: 'ROOM#123456' },
            mappedNormalForm: {}
        })

        recalculateComputes.mockReturnValue({ state: {} })

        await instantiateAsset({ assetId: 'test', options: { recursive: true } })

        expect(cacheAsset).toHaveBeenCalledWith('BASE', { recursive: true, check: true })
    })
})