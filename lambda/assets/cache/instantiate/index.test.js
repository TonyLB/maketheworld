import { jest, describe, it, expect } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
    assetDB,
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'

jest.mock('../parseWMLFile.js')
import parseWMLFile from '../parseWMLFile.js'
jest.mock('../globalize.js')
import globalizeDBEntries from '../globalize.js'
jest.mock('../initializeRooms.js')
import initializeRooms from '../initializeRooms.js'
jest.mock('../mergeEntries.js')
import mergeEntries from '../mergeEntries.js'
import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'

jest.mock('./localize.js')
import { localizeDBEntries } from './localize.js'
jest.mock('../index.js')
import { cacheAsset } from '../index.js'
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
        const topLevelAppearance = (key) => ({
            contextStack: [{ key, tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        })

        assetMetaDataMock.fetch.mockResolvedValue({
            fileName: 'test',
            importTree: { BASE: {} },
            instance: true
        })

        localizeDBEntries.mockResolvedValue({
            scopeMap: { VORTEX: 'ROOM#VORTEX', Welcome: 'ROOM#123456' },
            normalForm: {}
        })

        await instantiateAsset({ assetId: 'test', options: { recursive: true } })

        expect(cacheAsset).toHaveBeenCalledWith('BASE', { recursive: true, check: true })
        // expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        // expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
        // expect(mergeEntries).toHaveBeenCalledWith('BASE', baseAsset)
        // expect(recalculateComputes).toHaveBeenCalledWith(
        //     {},
        //     {},
        //     []
        // )
        // expect(ephemeraDB.putItem).toHaveBeenCalledWith({
        //     EphemeraId: "ASSET#test",
        //     DataCategory: "Meta::Asset",
        //     Actions: {},
        //     State: {},
        //     Dependencies: {},
        //     importTree: { BASE: {} }
        // })
        // expect(ephemeraDB.putItem).toHaveBeenCalledWith({
        //     EphemeraId: "ASSET#BASE",
        //     DataCategory: "Meta::Asset",
        //     Actions: {},
        //     State: {},
        //     Dependencies: {},
        //     importTree: {}
        // })
    })
})