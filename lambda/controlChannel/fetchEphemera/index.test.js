import { jest, describe, it, expect } from '@jest/globals'

import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { renderItems } from '/opt/utilities/perception/index.js'

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
            Name: 'Testy'
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
                Name: 'Testy'
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
            DataCategory: 'ASSET#BASE'
        })
        expect(ephemeraDB.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'ASSET#TESTONE'
        })
        expect(renderItems).toHaveBeenCalledTimes(0)
        expect(output).toEqual({
            type: 'Ephemera',
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
        renderItems.mockResolvedValue([{
            type: 'test'
        }])
        const output = await fetchEphemeraForCharacter({
            RequestId: '1234',
            CharacterId: 'TEST'
        })
        expect(renderItems).toHaveBeenCalledWith(
            [{
                CharacterId: 'TEST',
                EphemeraId: 'MAP#ABC'
            },
            {
                CharacterId: 'TEST',
                EphemeraId: 'MAP#DEF'
            }],
            {},
            {
                global: ['BASE'],
                characters: {
                    TEST: ['TESTONE']
                }
            }
        )
        expect(output).toEqual({
            type: 'Ephemera',
            RequestId: '1234',
            updates: [{
                type: 'test'
            }]
        })
    })
})