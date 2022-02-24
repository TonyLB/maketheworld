import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'

import { getCharacterAssets, getGlobalAssets } from './dynamoDB.js'

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
                return { assets: ['LayerA'] }
            case 'CHARACTERINPLAY#DEF':
                return { assets: ['LayerB'] }
        }
    }

    it('should fetch when nothing passed', async () => {
        ephemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'])
        expect(output).toEqual({
            ABC: ['LayerA'],
            DEF: ['LayerB']
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#DEF',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
    })

    it('should not fetch when character assets already passed', async () => {
        ephemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'], { DEF: ['LayerB'] })
        expect(output).toEqual({
            ABC: ['LayerA'],
            DEF: ['LayerB']
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
    })
})
