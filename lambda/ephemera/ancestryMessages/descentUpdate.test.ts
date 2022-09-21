jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import descentUpdateMessage from './descentUpdate'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('DescentUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should call all unreferenced updates in a first wave', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({ Ancestry: [] })
        await descentUpdateMessage({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            },
            {
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportTwo',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    EphemeraId: 'ASSET#ImportThree',
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(1)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#ImportOne',
            putItem: {
                tag: 'Asset',
                key: 'ImportOne',
                EphemeraId: 'ASSET#ImportTwo'
            }
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportTwo',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent'],
            updateReducer: expect.any(Function)
        })
    })

    it('should recursively cascade updates to ancestors', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'Base',
                    EphemeraId: 'ASSET#Base',
                    connections: []
                },
                {
                    tag: 'Asset',
                    key: 'Bootstrap',
                    EphemeraId: 'ASSET#Bootstrap',
                    connections: []
                }
            ]
        })
        .mockResolvedValueOnce({
            Descent: [
                {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await descentUpdateMessage({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(2)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Base',
            putItem: {
                tag: 'Asset',
                key: 'Base',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Bootstrap',
            putItem: {
                tag: 'Asset',
                key: 'Bootstrap',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
    })

})