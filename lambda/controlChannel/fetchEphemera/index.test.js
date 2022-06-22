import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index.js')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
jest.mock('@tonylb/mtw-utilities/dist/perception/index.js')
import { render } from '@tonylb/mtw-utilities/dist/perception/index.js'

import fetchEphemera, { fetchEphemeraForCharacter } from './index.js'

describe('fetchEphemera', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should serialize fetched CharacterInPlay records', async () => {
        ephemeraDB.query.mockResolvedValue([{
            EphemeraId: 'CHARACTERINPLAY#ABC',
            Connected: true,
            RoomId: 'ROOM#XYZ',
            Name: 'Testy',
            fileURL: 'test.png'
        }])
        const output = await fetchEphemera('Request123')
        expect(output).toEqual({
            messageType: 'Ephemera',
            RequestId: 'Request123',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'ABC',
                Connected: true,
                RoomId: 'ROOM#XYZ',
                Name: 'Testy',
                fileURL: 'test.png'
            }]
        })
    })
})

describe('fetchEphemeraForCharacter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty update when no Maps match character assets', async () => {
        ephemeraDB.getItem.mockImplementation(async ({ DataCategory }) => {
            if (DataCategory === 'Meta::Character') {
                return {
                    assets: ['TESTONE']
                }
            }
            if (DataCategory === 'Assets') {
                return {
                    assets: ['BASE']
                }
            }
            return {}
        })
        ephemeraDB.query.mockResolvedValue([])
        const output = await fetchEphemeraForCharacter({
            RequestId: '1234',
            CharacterId: 'TEST'
        })
        expect(ephemeraDB.query).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'ASSET#BASE',
            KeyConditionExpression: 'begins_with(EphemeraId, :map)',
            ExpressionAttributeValues: { ':map': 'MAP#' }
        })
        expect(ephemeraDB.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'ASSET#TESTONE',
            KeyConditionExpression: 'begins_with(EphemeraId, :map)',
            ExpressionAttributeValues: { ':map': 'MAP#' }
        })
        expect(render).toHaveBeenCalledTimes(0)
        expect(output).toEqual({
            messageType: 'Ephemera',
            RequestId: '1234',
            updates: []
        })
    })

    it('should return update when Maps match character assets', async () => {
        ephemeraDB.getItem.mockImplementation(async ({ DataCategory }) => {
            if (DataCategory === 'Meta::Character') {
                return {
                    assets: ['TESTONE']
                }
            }
            if (DataCategory === 'Assets') {
                return {
                    assets: ['BASE']
                }
            }
            return {}
        })
        ephemeraDB.query.mockImplementation(async ({ DataCategory }) => {
            if (DataCategory === 'ASSET#TESTONE') {
                return [{
                    EphemeraId: 'MAP#ABC'
                }]
            }
            if (DataCategory === 'ASSET#BASE') {
                return [{
                    EphemeraId: 'MAP#ABC'
                },
                {
                    EphemeraId: 'MAP#DEF'
                }]
            }
            return {}
        })
        render.mockResolvedValue([{
            type: 'Map',
            CharacterId: 'TEST',
            MapId: 'MAP#ABC',
            name: 'Grand Bazaar',
            rooms: {
                fountainSquare: { x: -50, y: 0 }
            }
        }])
        const output = await fetchEphemeraForCharacter({
            RequestId: '1234',
            CharacterId: 'TEST'
        })
        expect(render).toHaveBeenCalledWith({
            renderList: [{
                CharacterId: 'TEST',
                EphemeraId: 'MAP#ABC'
            },
            {
                CharacterId: 'TEST',
                EphemeraId: 'MAP#DEF'
            }],
            assetLists: {
                global: ['BASE'],
                characters: {
                    TEST: ['TESTONE']
                }
            }
        })
        expect(output).toEqual({
            messageType: 'Ephemera',
            RequestId: '1234',
            updates: [{
                type: 'Map',
                CharacterId: 'TEST',
                MapId: 'MAP#ABC',
                name: 'Grand Bazaar',
                rooms: {
                    fountainSquare: { x: -50, y: 0 }
                }
            }]
        })
    })
})