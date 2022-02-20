import { jest, expect } from '@jest/globals'

import {
    ephemeraDB,
    assetDB
} from '/opt/utilities/dynamoDB/index.js'

jest.mock('./parseWMLFile.js')
import parseWMLFile from './parseWMLFile.js'
jest.mock('./globalize.js')
import globalizeDBEntries from './globalize.js'
jest.mock('./initializeRooms.js')
import initializeRooms from './initializeRooms.js'
import { mergeEntries } from '/opt/utilities/dynamoDB/index.js'
import { recalculateComputes } from '/opt/utilities/executeCode/index.js'

import { cacheAsset } from './index.js'

describe('cacheAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should send rooms in need of update', async () => {
        assetDB.getItem
            .mockResolvedValueOnce({ fileName: 'test' })
        ephemeraDB.getItem
            .mockResolvedValueOnce({ State: {} })
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries.mockResolvedValue([{ EphemeraId: 'ROOM#DEF' }])
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('ABC')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('ABC', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith(['ROOM#DEF'])
        expect(mergeEntries).toHaveBeenCalled
        expect(recalculateComputes).toHaveBeenCalled
        expect(ephemeraDB.putItem).toHaveBeenCalled
    })
})