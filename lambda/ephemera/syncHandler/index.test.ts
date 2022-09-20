jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { messageDeltaQuery } from '@tonylb/mtw-utilities/dist/dynamoDB'

jest.mock('../messageBus')
import messageBus from '../messageBus'

import { syncRequest } from '.'

const messageDeltaQueryMock = messageDeltaQuery as jest.Mock
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>

describe('syncRequest', () => {
    const realDateNow = Date.now.bind(global.Date)

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should return empty message array when no new sync data', async () => {
        messageDeltaQueryMock.mockResolvedValue({
            Items: []
        })
        await syncRequest({ payloads: [{
            type: 'Sync',
            targetId: 'ABCD'
        } ], messageBus })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'SyncResponse',
            messages: [],
            lastSync: 1000000000000
        })
    })
})
