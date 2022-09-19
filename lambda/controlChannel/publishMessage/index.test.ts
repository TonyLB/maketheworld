jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { publishMessage as publishMessageDynamoDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

jest.mock('../internalCache')
import internalCache from "../internalCache"

import publishMessage from './index'

const publishMessageMock = publishMessageDynamoDB as jest.Mock
const uuidMock = uuidv4 as jest.Mock
const cacheMock = jest.mocked(internalCache, true)

describe('PublishMessage', () => {
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

    it('should call dynamoDB handler directly', async () => {
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: [{ tag: 'String', value: 'Test' }]
            }]
        })
        expect(publishMessageMock).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            Targets: ['CHARACTER#123'],
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
    })

    it('should remap room targets dynamically', async () => {
        cacheMock.RoomCharacterList.get.mockResolvedValue([
            {
                EphemeraId: 'CHARACTER#123',
                ConnectionIds: ['Test1'],
                Color: 'green',
                Name: 'Tess'
            },
            {
                EphemeraId: 'CHARACTER#456',
                ConnectionIds: ['Test2'],
                Color: 'purple',
                Name: 'Marco'
            }
        ])
        await publishMessage({
            payloads: [{
                type: 'PublishMessage',
                targets: ['ROOM#ABC', 'CHARACTER#123'],
                displayProtocol: 'WorldMessage',
                message: [{ tag: 'String', value: 'Test' }]
            }]
        })
        expect(publishMessageMock).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            Targets: ['CHARACTER#123', 'CHARACTER#456'],
            Message: [{ tag: 'String', value: 'Test' }],
            DisplayProtocol: 'WorldMessage'
        })
    })

})