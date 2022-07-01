import { jest, describe, expect, it } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    assetDB,
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import AssetMetaData from './assetMetaData.js'

describe('AssetMap Class', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('fetch', () => {
        it('should record fetched AssetDB values', async () => {
            assetDB.getItem.mockResolvedValue({
                fileName: 'test',
                importTree: { TEST: {} },
                instance: 'TestInstance'
            })
            const testAssetMetaData = new AssetMetaData('Test')
            await testAssetMetaData.fetch()
            expect(testAssetMetaData.fileName).toEqual('test')
            expect(testAssetMetaData.importTree).toEqual({ TEST: {} })
            expect(testAssetMetaData.instance).toEqual('TestInstance')
        })
    })

    describe('checkEphemera', () => {
        it('should return cached value without checking', async () => {
            const testAssetMetaData = new AssetMetaData('Test')
            testAssetMetaData.ephemeraChecked = true
            const checkValue = await testAssetMetaData.checkEphemera()
            expect(checkValue).toBe(true)
            expect(ephemeraDB.getItem).toHaveBeenCalledTimes(0)
        })

        it('should return true on present Ephemera value', async () => {
            ephemeraDB.getItem.mockResolvedValue({
                EphemeraId: 'ASSET#Test'
            })
            const testAssetMetaData = new AssetMetaData('Test')
            const checkValue = await testAssetMetaData.checkEphemera()
            expect(checkValue).toBe(true)
            expect(ephemeraDB.getItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#Test',
                DataCategory: 'Meta::Asset'
            })
        })

        it('should return false on no Ephemera value', async () => {
            ephemeraDB.getItem.mockResolvedValue({})
            const testAssetMetaData = new AssetMetaData('Test')
            const checkValue = await testAssetMetaData.checkEphemera()
            expect(checkValue).toBe(false)
            expect(ephemeraDB.getItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#Test',
                DataCategory: 'Meta::Asset'
            })
        })
    })

    describe('pushEphemera', () => {
        it('should push class property values', async () => {
            const testAssetMetaData = new AssetMetaData('Test')
            testAssetMetaData.state = {
                foo: { value: 'foo' },
                antiFoo: { computed: true, src: '!foo', value: 'antiFoo' }
            }
            testAssetMetaData.dependencies = {
                foo: {
                    computed: ['antiFoo']
                }
            }
            testAssetMetaData.importTree = { BASE: {} }
            await testAssetMetaData.pushEphemera()
            expect(ephemeraDB.putItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#Test',
                DataCategory: 'Meta::Asset',
                Actions: {},
                State: {
                    foo: { value: 'foo' },
                    antiFoo: { computed: true, src: '!foo', value: 'antiFoo' }
                },
                Dependencies: {
                    foo: {
                        computed: ['antiFoo']
                    }
                },
                mapCache: {},
                importTree: { BASE: {} }
            })
        })

        it('should push scopeMap when available', async () => {
            const testAssetMetaData = new AssetMetaData('Test')
            testAssetMetaData.state = {}
            testAssetMetaData.dependencies = {}
            testAssetMetaData.importTree = {}
            testAssetMetaData.scopeMap = {
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            }
            await testAssetMetaData.pushEphemera()
            expect(ephemeraDB.putItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#Test',
                DataCategory: 'Meta::Asset',
                Actions: {},
                State: {},
                Dependencies: {},
                mapCache: {},
                importTree: {},
                scopeMap: {
                    VORTEX: 'ROOM#VORTEX',
                    Welcome: 'ROOM#123456'
                }
            })
        })
    })
})