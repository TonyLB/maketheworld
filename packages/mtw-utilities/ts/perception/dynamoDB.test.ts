jest.mock('../dynamoDB')
import { ephemeraDB } from '../dynamoDB'
import { EphemeraQueryKeyProps } from '../dynamoDB/query'

import { getCharacterAssets, getGlobalAssets, getItemMeta } from './dynamoDB'

const mockedEphemeraDB = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('getGlobalAssets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should fetch when nothing passed', async () => {
        mockedEphemeraDB.getItem.mockResolvedValue({ assets: ['BASE'] })
        const output = await getGlobalAssets()
        expect(output).toEqual(['BASE'])
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'Global',
            DataCategory: 'Assets',
            ProjectionFields: ['assets']
        })
    })

    it('should not fetch when global assets already passed', async () => {
        const output = await getGlobalAssets(['BASE'])
        expect(output).toEqual(['BASE'])
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledTimes(0)
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
        mockedEphemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'])
        expect(output).toEqual({
            ABC: { assets: ['LayerA'], RoomId: 'XYZ' },
            DEF: { assets: ['LayerB'], RoomId: 'XYZ' }
        })
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledTimes(2)
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        })
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#DEF',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets', 'RoomId']
        })
    })

    it('should not fetch when character assets already passed', async () => {
        mockedEphemeraDB.getItem.mockImplementation(mockGetImplementation)
        const output = await getCharacterAssets(['ABC', 'DEF'], { DEF: { assets: ['LayerB'], RoomId: 'XYZ' } })
        expect(output).toEqual({
            ABC: { assets: ['LayerA'], RoomId: 'XYZ' },
            DEF: { assets: ['LayerB'], RoomId: 'XYZ' }
        })
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledTimes(1)
        expect(mockedEphemeraDB.getItem).toHaveBeenCalledWith({
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
        const mockQueryImplementation = async (props: EphemeraQueryKeyProps) => {
            if (!props.IndexName) {
                switch(props.EphemeraId) {
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
                }
            }
            return [] as { DataCategory: string; appearances: any[] }[]
        }
        mockedEphemeraDB.getItem.mockResolvedValue({
            Name: 'Tess',
            fileURL: 'tess.png'
        })
        mockedEphemeraDB.query.mockImplementation(mockQueryImplementation)
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
