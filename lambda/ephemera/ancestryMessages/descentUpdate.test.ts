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
                assetId: 'ImportTwo',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            },
            {
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportTwo',
                assetId: 'ImportThree',
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
            assetId: 'ImportTwo',
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
        let testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    assets: ['ImportThree'],
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
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
                assetId: 'ImportTwo',
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
            assetId: 'ImportTwo',
            putItem: {
                tag: 'Asset',
                key: 'Base',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Bootstrap',
            assetId: 'ImportTwo',
            putItem: {
                tag: 'Asset',
                key: 'Bootstrap',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
    })

    it('should aggregate multiple messages', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'Base',
                    EphemeraId: 'ASSET#Base',
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
        .mockResolvedValueOnce({
            Descent: []
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await descentUpdateMessage({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                assetId: 'ImportTwo',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            },
            {
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                assetId: 'ImportTwo',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportThree',
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(1)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Base',
            assetId: 'ImportTwo',
            putItem: {
                tag: 'Asset',
                key: 'Base',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportOne',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ImportTwo'],
                    connections: [{
                        tag: 'Asset',
                        key: 'ImportTwo',
                        EphemeraId: 'ASSET#ImportThree',
                        connections: []
                    }]
                },
                {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ImportTwo'],
                    connections: []
                }
            ]
        })
    })

})