jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('../messageBus')
import messageBus from '../messageBus'

import { fetchPlayerEphemera } from '.'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
// @ts-ignore
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
        }] as any)
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#ABC',
            RoomId: 'ROOM#XYZ',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            Name: 'Testy',
            fileURL: 'test.png',
            Color: 'purple',
            HomeId: 'ROOM#VORTEX',
            assets: [],
            Pronouns: 'they/them'
        })
        internalCacheMock.Global.get.mockResolvedValue('XYZ')
        await fetchPlayerEphemera({
            payloads: [{
                type: 'FetchPlayerEphemera'
            }],
            messageBus
        })
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#ABC',
                Connected: true,
                RoomId: 'ROOM#XYZ',
                DisplayName: 'Testy',
                fileURL: 'test.png',
                Color: 'purple',
                connectionTargets: ['CONNECTION#XYZ']
            }]
        })
    })
})
