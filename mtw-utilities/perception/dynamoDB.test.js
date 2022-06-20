import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'

import { getCharacterAssets, getGlobalAssets, getItemMeta } from './dynamoDB.js'

describe('getGlobalAssets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should fetch when nothing passed', async () => {
        ephemeraDB.getItem.mockResolvedValue({ assets: ['BASE'] })
        const output = await getGlobalAssets()
        expect(output).toEqual(['BASE'])
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'Global',
            DataCategory: 'Assets',
            ProjectionFields: ['assets']
        })
    })

    it('should not fetch when global assets already passed', async () => {
        const output = await getGlobalAssets(['BASE'])
        expect(output).toEqual(['BASE'])
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(0)
    })
})

describe('getCharacterAssets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const mockGetImplementation = async ({ EphemeraId }) => {
        switch(EphemeraId) {
            case 'CHARACTERINPLAY#ABC':
                return { assets: ['LayerA'], RoomId: 'XYZ' }
            case 'CHARACTERINPLAY#DEF':
                return { assets: ['LayerB'], RoomId: 'XYZ' }
        }
    }

    it('should fetch when nothing passed', async () => {
        ephemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'])
        expect(output).toEqual({
            ABC: { assets: ['LayerA'], RoomId: 'XYZ' },
            DEF: { assets: ['LayerB'], RoomId: 'XYZ' }
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#DEF',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        })
    })

    it('should not fetch when character assets already passed', async () => {
        ephemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'], { DEF: { assets: ['LayerB'], RoomId: 'XYZ' } })
        expect(output).toEqual({
            ABC: { assets: ['LayerA'], RoomId: 'XYZ' },
            DEF: { assets: ['LayerB'], RoomId: 'XYZ' }
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        })
    })
})

describe('getItemMeta', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should fetch all types of data', async () => {
        const mockQueryImplementation = async ({ EphemeraId }) => {
            switch(EphemeraId) {
                case 'ROOM#ABC':
                    return [{
                        DataCategory: 'Meta::Room',
                        activeCharacters: {}
                    },
                    {
                        DataCategory: 'ASSET#BASE',
                        appearances: [{
                            contextStack: [],
                            render: ['Test']
                        }]
                    }]
                default:
                    return []
            }
        }
        ephemeraDB.getItem.mockResolvedValue({
            Name: 'Tess',
            fileURL: 'tess.png'
        })
        ephemeraDB.query.mockImplementation(mockQueryImplementation)
        const output = await getItemMeta([
            'ROOM#ABC',
            'CHARACTERINPLAY#QRS'
        ])
        expect(output).toEqual({
            ['CHARACTERINPLAY#QRS']: [{
                DataCategory: 'Meta::Character',
                Name: 'Tess',
                fileURL: 'tess.png'
            }],
            ['ROOM#ABC']: [{
                DataCategory: 'Meta::Room',
                activeCharacters: {}
            },
            {
                DataCategory: 'ASSET#BASE',
                appearances: [{
                    contextStack: [],
                    render: ['Test']
                }]
            }]
        })
    })

})
