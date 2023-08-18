jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('../messageBus')
import messageBus from '../messageBus'

import { fetchPlayerEphemera } from '.'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const internalCacheMock = jest.mocked(internalCache, true)

describe('fetchPlayerEphemera', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should serialize fetched Character records', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: `CHARACTER#ABC`,
            DataCategory: 'Meta::Character'
        }])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#ABC',
            RoomId: 'ROOM#XYZ',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            Name: 'Testy',
            fileURL: 'test.png',
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        })
        internalCacheMock.Global.get.mockResolvedValue('XYZ')
        await fetchPlayerEphemera({
            payloads: [{
                type: 'FetchPlayerEphemera'
            }],
            messageBus
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                RoomId: 'ROOM#XYZ',
                Name: 'Testy',
                fileURL: 'test.png',
                Color: 'purple',
                targets: ['CONNECTION#XYZ']
            }]
        })
    })
})
