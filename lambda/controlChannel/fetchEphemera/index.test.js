import { jest, describe, it, expect } from '@jest/globals'

import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

import fetchEphemera from './index.js'

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