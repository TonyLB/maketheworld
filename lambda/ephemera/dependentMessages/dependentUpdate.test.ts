jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import dependentUpdateMessage from './dependentUpdate'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('DescentUpdateMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should call all unreferenced updates in a first wave', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({ Ancestry: [] })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: []
                }
            },
            {
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportTwo',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: []
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(1)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#ImportOne',
            putItem: {
                EphemeraId: 'ASSET#ImportTwo',
                assets: []
            }
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportTwo',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
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
                    EphemeraId: 'ASSET#Base',
                    connections: []
                },
                {
                    EphemeraId: 'ASSET#Bootstrap',
                    connections: []
                }
            ]
        })
        .mockResolvedValueOnce({
            Descent: [
                {
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: []
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(2)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Base',
            putItem: {
                EphemeraId: 'ASSET#ImportOne',
                assets: []
            }
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Bootstrap',
            putItem: {
                EphemeraId: 'ASSET#ImportOne',
                assets: []
            }
        })
    })

    it('should aggregate multiple messages', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: [
                {
                    EphemeraId: 'ASSET#Base',
                    connections: []
                }
            ]
        })
        .mockResolvedValueOnce({
            Descent: [
                {
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
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: []
                }
            },
            {
                type: 'DescentUpdate',
                targetId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: []
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(1)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'DescentUpdate',
            targetId: 'ASSET#Base',
            putItem: {
                EphemeraId: 'ASSET#ImportOne',
                assets: []
            }
        })
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportOne',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
                    EphemeraId: 'ASSET#ImportTwo',
                    connections: [{
                        EphemeraId: 'ASSET#ImportThree',
                        assets: []
                    }]
                },
                {
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
    })

    it('should independently store differently aliased inheritance edges', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: []
        })
        .mockResolvedValueOnce({
            Descent: [{
                EphemeraId: 'MAP#DEF',
                connections: []
            }]
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightsOn',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(0)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'VARIABLE#XYZ',
                DataCategory: 'Meta::Variable'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [
            {
                EphemeraId: 'ROOM#ABC',
                connections: [{
                    key: 'lightSwitch',
                    EphemeraId: 'MAP#DEF',
                    assets: ['Base']
                }]
            },
            {
                EphemeraId: 'MAP#DEF',
                connections: []
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'ROOM#ABC',
                connections:[
                    {
                        EphemeraId: 'MAP#DEF',
                        key: 'lightSwitch',
                        assets: ['Base', 'Layer'],
                    },
                    {
                        EphemeraId: 'MAP#DEF',
                        key: 'lightsOn',
                        assets: ['Layer'],
                    }    
                ]
            },
            {
                EphemeraId: 'MAP#DEF',
                connections: []
            }]
        })
    })

    it('should combine similarly aliased inheritance edges', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: []
        })
        .mockResolvedValueOnce({
            Descent: [{
                EphemeraId: 'MAP#DEF',
                connections: []
            }]
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(0)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'VARIABLE#XYZ',
                DataCategory: 'Meta::Variable'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [
            {
                EphemeraId: 'ROOM#ABC',
                connections: [{
                    EphemeraId: 'MAP#DEF',
                    assets: ['Base']
                }]
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'ROOM#ABC',
                connections:[
                    {
                        EphemeraId: 'MAP#DEF',
                        assets: ['Base']
                    }    
                ]
            }]
        })
    })

    it('should decrement layers when deleting one of many references', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: []
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(0)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'VARIABLE#XYZ',
                DataCategory: 'Meta::Variable'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [
            {
                EphemeraId: 'ROOM#ABC',
                connections: [{
                    EphemeraId: 'MAP#DEF',
                    assets: ['Base', 'Layer']
                }]
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'ROOM#ABC',
                connections:[
                    {
                        EphemeraId: 'MAP#DEF',
                        assets: ['Base']
                    }    
                ]
            }]
        })
    })

    it('should remove dependency when deleting last reference', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: []
        })
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer }) => {
            updateReducer({ Descent: [] })
            return {}
        })
        await dependentUpdateMessage('Descent')({
            payloads: [{
                type: 'DescentUpdate',
                targetId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Base']
                }
            }],
            messageBus
        })

        expect(messageBus.send).toHaveBeenCalledTimes(0)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'VARIABLE#XYZ',
                DataCategory: 'Meta::Variable'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [
            {
                EphemeraId: 'VARIABLE#XYZ',
                connections: [{
                    key: 'lightSwitch',
                    EphemeraId: 'MAP#DEF',
                    assets: ['Base']
                }]
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                connections: []
            }]
        })
    })

})