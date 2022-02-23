import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
jest.mock('../perception/index.js')
import { render } from '../perception/index.js'
jest.mock('uuid')
import { v4 as uuidMock } from 'uuid'
import { testAssetsFactory, testMockImplementation } from './testAssets.js'

import { updateRooms } from './updateRooms.js'

describe('updateRooms', () => {

    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        uuidMock.mockReturnValue('UUID')
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should publish whatever render returns', async() => {
        render.mockResolvedValue([{
            RoomId: 'VORTEX',
            CharacterId: 'TESS',
            Name: 'Vortex',
            Exits: [],
            Description: ['A swirling vortex ']
        }])
        await updateRooms([])
        expect(render).toHaveBeenCalledWith([], {})
        expect(publishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            Targets: ['CHARACTER#TESS'],
            CreatedTime: 1000000000000,
            DisplayProtocol: 'RoomUpdate',
            Name: 'Vortex',
            RoomId: 'VORTEX',
            Description: ['A swirling vortex '],
            Exits: []
        })
    })

    it('should render no rooms on an empty check-list', async () => {
        render.mockResolvedValue([])
        await updateRooms([])
        expect(render).toHaveBeenCalledWith([], {})
        expect(publishMessage).toHaveBeenCalledTimes(0)
    })

})