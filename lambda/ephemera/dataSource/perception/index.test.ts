jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import messageBus from '../../messageBus'
import { sendCharacterPerceptionRequested } from './subscribedEvents'
import { ephemeraPerceptionDataSource } from './index'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('mtw.ephemera.perception DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        ephemeraDBMock.getItem.mockResolvedValue({
            Name: 'Test',
            Pronouns: 'they/them',
        })
    })

    it('registers subscription and flush completes without error when queue is empty', async () => {
        expect(ephemeraPerceptionDataSource.dataSourceKey).toBe('mtw.ephemera.perception')
        await expect(messageBus.flush()).resolves.toBeUndefined()
    })

    it('receiveEvents emits PublishMessage for Character Perception Requested ingress', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')

        sendCharacterPerceptionRequested(messageBus, 'CHARACTER#SUBJECT', {
            characterId: 'CHARACTER#VIEWER',
            ephemeraId: 'CHARACTER#SUBJECT',
        })
        await messageBus.flush()

        expect(ephemeraDBMock.getItem).toHaveBeenCalledWith({
            Key: {
                EphemeraId: 'CHARACTER#SUBJECT',
                DataCategory: 'Meta::Character',
            },
            ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
        })
        expect(sendSpy.mock.calls.some((call) => call[0]?.type === 'PublishMessage' && call[0]?.displayProtocol === 'PerceptionMessage')).toBe(true)
        sendSpy.mockRestore()
    })
})
