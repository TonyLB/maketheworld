jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/')
import {
    publishMessage,
    ephemeraDB,
    assetDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')
import internalCache from '../internalCache'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = internalCache as jest.Mocked<typeof internalCache>

import registerCharacter from '.'

describe("registerCharacter", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.get.mockResolvedValueOnce('TestConnection').mockResolvedValueOnce('Request123')
    })

    it("should update connectionID when character is in table without connection", async () => {
        ephemeraDBMock.getItem.mockResolvedValue({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character'
        }})
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'ABC' }],
            messageBus
        })
        expect(ephemeraDBMock.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.update).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            UpdateExpression: "SET Connected = :true, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId), ConnectionIds = :connectionIds",
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ":connectionIds": ['TestConnection'],
                ":name": "",
                ":roomId": "VORTEX",
                ":true": true
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'ABC',
                RequestId: 'Request123'
            }
        })
    })

    it("should update connectionID when character is in table with prior connection", async () => {
        ephemeraDBMock.getItem.mockResolvedValue({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ConnectionId: '987'
        }})
        await registerCharacter({ payloads: [{ type: 'RegisterCharacter', characterId: 'ABC' }], messageBus })
        expect(ephemeraDBMock.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.update).toHaveBeenCalledWith({
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            UpdateExpression: "SET Connected = :true, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId), ConnectionIds = :connectionIds",
            ExpressionAttributeNames: {
                '#name': 'Name'
            },
            ExpressionAttributeValues: {
                ":connectionIds": ['TestConnection'],
                ":name": "",
                ":roomId": "VORTEX",
                ":true": true
            }
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: "Registration",
                CharacterId: 'ABC',
                RequestId: 'Request123'
            }
        })
    })

})