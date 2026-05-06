jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import {
    ephemeraDB,
    connectionDB
} from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import { atomicallyRemoveCharacterAdjacency } from '.'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const queryMock = connectionDB.query as unknown as jest.Mock

describe("atomicallyRemoveCharacterAdjacency", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it("should update correctly on last connection", async () => {
        ephemeraDBMock.getItem.mockResolvedValue({ RoomId: 'ROOM#Test' })
        queryMock.mockResolvedValueOnce([{ ConnectionId: 'CONNECTION#XYZ', DataCategory: 'CHARACTER#ABC' }])
        await atomicallyRemoveCharacterAdjacency('1234', 'CHARACTER#TestChar')
        expect(connectionDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(connectionDBMock.transactWrite.mock.calls[0][0]).toEqual([
            { Delete: { ConnectionId: 'SESSION#1234', DataCategory: 'CHARACTER#TestChar' } },
            { Update: {
                Key: { ConnectionId: 'CHARACTER#TestChar', DataCategory: 'Meta::Character' },
                updateKeys: ['sessions'],
                updateReducer: expect.any(Function),
                deleteCondition: expect.any(Function),
                deleteCallback: expect.any(Function)
            }}
        ])
    })

})