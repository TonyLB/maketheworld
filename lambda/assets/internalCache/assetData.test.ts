jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

const assetDBMock = jest.mocked(assetDB)

import { AssetData } from './assetData'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'

const assetData = new AssetData()

describe('AssetData cache class', () => {
    beforeEach(() => {
        assetData.clear()
        jest.clearAllMocks()
    })

    it('should return the default value when no data is found', async () => {
        assetDBMock.query.mockResolvedValue([])
        assetDBMock.getItem.mockResolvedValue({})
        const assetId = 'ASSET#12345'
        const result = await assetData.get([assetId])
        expect(result).toEqual([
            {
                AssetId: assetId,
                standardForm: expect.any(Object)
            }
        ])
    })

    it('should return the data from the database when found', async () => {
        const assetId = 'ASSET#Test'
        const roomRow = new StandardRoom(deIndentWML(`
            <Room uuid=(ABCDEF) key=(Room1)>
                <ShortName>Lobby</ShortName>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Plain lobby</DisplayName>
                    <Description>A featureless lobby</Description>
                </Situation>
            </Room>
        `))
        const mockData = [{
            ...roomRow.toJSON() as StandardRoomData,
            DataCategory: 'ASSET#Test' as const,
            AssetId: roomRow.universalKey as `ROOM#${string}`
        }]
        assetDBMock.query.mockResolvedValue(mockData)
        assetDBMock.getItem.mockResolvedValue({ topLevel: ['ROOM#ABCDEF'] })
        const result = await assetData.get([assetId])
        expect(result).toEqual([
            {
                AssetId: assetId,
                standardForm: expect.any(Object)
            }
        ])
        expect(schemaToWML([result[0].standardForm.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(ABCDEF) key=(Room1)>
                    <ShortName>Lobby</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Plain lobby</DisplayName>
                        <Description>A featureless lobby</Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should return asset with ShortName and Summary from Meta::Asset record', async () => {
        const assetId = 'ASSET#TestWithMetadata'
        const mockComponentData = [
            { tag: 'Room', key: 'lobby', AssetId: `ROOM#ABC123`, DataCategory: 'ASSET#TestWithMetadata', shortName: 'Main Lobby', exits: [] }
        ]
        const mockMetaData = {
            shortName: 'Nakatomi Plaza',
            summary: ['A high-rise office building in downtown Los Angeles'],
            topLevel: ['ROOM#ABC123']
        }
        
        assetDBMock.query.mockResolvedValue(mockComponentData)
        assetDBMock.getItem.mockResolvedValue(mockMetaData)
        
        const result = await assetData.get([assetId])
        
        expect(result).toEqual([
            {
                AssetId: assetId,
                standardForm: expect.any(Object)
            }
        ])
        
        // Verify Asset-level metadata is present
        expect(result[0].standardForm.shortName?.toJSON()).toEqual('Nakatomi Plaza')
        expect(result[0].standardForm.summary?.toJSON()).toEqual(['A high-rise office building in downtown Los Angeles'])
        
        // Verify the WML includes Asset metadata
        expect(schemaToWML([result[0].standardForm.schema])).toEqual(deIndentWML(`
            <Asset uuid=(TestWithMetadata)>
                <ShortName>Nakatomi Plaza</ShortName>
                <Summary>A high-rise office building in downtown Los Angeles</Summary>
                <Room uuid=(ABC123) key=(lobby)><ShortName>Main Lobby</ShortName></Room>
            </Asset>
        `))
    })

    it('should return asset without ShortName/Summary when Meta::Asset has no metadata', async () => {
        const assetId = 'ASSET#TestNoMetadata'
        const mockComponentData = [
            { tag: 'Room', key: 'room1', AssetId: `ROOM#DEF456`, DataCategory: 'ASSET#TestNoMetadata', exits: [] }
        ]
        const mockMetaData = { topLevel: ['ROOM#DEF456'] }  // No shortName or summary
        
        assetDBMock.query.mockResolvedValue(mockComponentData)
        assetDBMock.getItem.mockResolvedValue(mockMetaData)
        
        const result = await assetData.get([assetId])
        
        expect(result[0].standardForm.shortName).toBeUndefined()
        expect(result[0].standardForm.summary).toBeUndefined()
        
        // Verify the WML doesn't include Asset metadata
        expect(schemaToWML([result[0].standardForm.schema])).toEqual('<Asset uuid=(TestNoMetadata)><Room uuid=(DEF456) key=(room1) /></Asset>')
    })

    it('should return asset with only ShortName when Summary is not present', async () => {
        const assetId = 'ASSET#TestShortNameOnly'
        const mockComponentData = []
        const mockMetaData = {
            shortName: 'Quick Name'
            // No summary
        }
        
        assetDBMock.query.mockResolvedValue(mockComponentData)
        assetDBMock.getItem.mockResolvedValue(mockMetaData)
        
        const result = await assetData.get([assetId])
        
        expect(result[0].standardForm.shortName?.toJSON()).toEqual('Quick Name')
        expect(result[0].standardForm.summary).toBeUndefined()
    })

})