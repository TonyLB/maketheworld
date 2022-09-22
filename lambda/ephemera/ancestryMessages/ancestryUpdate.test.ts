jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import ancestryUpdateMessage from './ancestryUpdate'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('AncestryUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should call all unreferenced updates in a first wave', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({ Ancestry: [] })
        await ancestryUpdateMessage({
            payloads: [{
                type: 'AncestryUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            },
            {
                type: 'AncestryUpdate',
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
            type: 'AncestryUpdate',
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
            updateKeys: ['Ancestry'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Ancestry: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
    })

    it('should recursively cascade updates to ancestors', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Descent: [
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
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Ancestry: [] })
            return {}
        })
        await ancestryUpdateMessage({
            payloads: [{
                type: 'AncestryUpdate',
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
            type: 'AncestryUpdate',
            targetId: 'ASSET#Base',
            putItem: {
                tag: 'Asset',
                key: 'Base',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'AncestryUpdate',
            targetId: 'ASSET#Bootstrap',
            putItem: {
                tag: 'Asset',
                key: 'Bootstrap',
                EphemeraId: 'ASSET#ImportOne'
            }
        })
    })

    it('should aggregate multiple messages', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Descent: [
                {
                    tag: 'Asset',
                    key: 'Base',
                    EphemeraId: 'ASSET#Base',
                    connections: []
                }
            ]
        })
        .mockResolvedValueOnce({
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'ImportTwo',
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
        .mockResolvedValueOnce({
            Ancestry: []
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Ancestry: [] })
            return {}
        })
        await ancestryUpdateMessage({
            payloads: [{
                type: 'AncestryUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
                }
            },
            {
                type: 'AncestryUpdate',
                targetId: 'ASSET#ImportOne',
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
            type: 'AncestryUpdate',
            targetId: 'ASSET#Base',
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
            updateKeys: ['Ancestry'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Ancestry: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Ancestry: [
                {
                    tag: 'Asset',
                    key: 'ImportOne',
                    EphemeraId: 'ASSET#ImportTwo',
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
                    connections: []
                }
            ]
        })
    })

})