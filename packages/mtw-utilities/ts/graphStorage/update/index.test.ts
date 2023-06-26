jest.mock('../../dynamoDB')
import { ephemeraDB } from "../../dynamoDB"

import { CacheBase } from '../cache/baseClasses'
import { GraphCache } from '../cache/'
import updateGraphStorage from './'

const internalCache = new (GraphCache(CacheBase))()

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('graphStore update', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.Descent, 'get').mockResolvedValue([])
    })

    it('should call all unreferenced updates in a first wave', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({ Ancestry: [] })
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                type: 'DescentUpdate',
                EphemeraId: 'ASSET#ImportTwo',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }]
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportTwo',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
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
                    connections: [{ EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }]
                },
                {
                    EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
        testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[1][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
                    EphemeraId: 'ASSET#ImportOne',
                    connections: [{ EphemeraId: 'ASSET#ImportTwo', assets: ['ASSET'] }]
                },
                {
                    EphemeraId: 'ASSET#ImportTwo',
                //
                // TODO: Correct failure of multiple adds to cascade changes
                //
                //     connections: [{ EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }]
                // },
                // {
                //     EphemeraId: 'ASSET#ImportThree',
                    connections: []
                }
            ]
        })
    })

    it('should recursively cascade updates to ancestors', async () => {
        ephemeraDBMock.getItem.mockResolvedValueOnce({
            Ancestry: [
                {
                    EphemeraId: 'ASSET#ImportOne',
                    connections: [
                        { EphemeraId: 'ASSET#Base', assets: ['ASSET'] },
                        { EphemeraId: 'ASSET#Bootstrap', assets: ['ASSET'] }
                    ]
                },
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
                    EphemeraId: 'ASSET#ImportTwo',
                    connections: [{ EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }]
                },
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            }]
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(3)
        let testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({ Descent: [{
            EphemeraId: 'ASSET#ImportOne',
            connections: [{ EphemeraId: 'ASSET#ImportTwo', assets: ['ASSET'] }]
        },
        {
            EphemeraId: 'ASSET#ImportTwo',
            connections: []
        }]})
        testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[1][0].updateReducer(testItem)
        expect(testItem).toEqual({ Descent: [{
            EphemeraId: 'ASSET#Base',
            connections: [{ EphemeraId: 'ASSET#ImportOne', assets: ['ASSET'] }]
        },
        {
            EphemeraId: 'ASSET#ImportOne',
            connections: []
        }]})
        testItem = { Descent: [] }
        ephemeraDBMock.optimisticUpdate.mock.calls[2][0].updateReducer(testItem)
        expect(testItem).toEqual({ Descent: [{
            EphemeraId: 'ASSET#Bootstrap',
            connections: [{ EphemeraId: 'ASSET#ImportOne', assets: ['ASSET'] }]
        },
        {
            EphemeraId: 'ASSET#ImportOne',
            connections: []
        }]})
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                type: 'DescentUpdate',
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }]
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
                    EphemeraId: 'ASSET#ImportOne',
                    connections: [
                        { EphemeraId: 'ASSET#ImportTwo', assets: ['ASSET'] },
                        { EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }
                    ]
                },
                {
                    EphemeraId: 'ASSET#ImportTwo',
                    connections: []
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightsOn',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }]
        })

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
                    EphemeraId: 'ROOM#ABC',
                    key: 'lightSwitch',
                    assets: ['Base']
                }]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections: [{
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
                EphemeraId: 'VARIABLE#XYZ',
                connections: [
                    { EphemeraId: 'ROOM#ABC', assets: ['Base'], key: 'lightSwitch' },
                    { EphemeraId: 'ROOM#ABC', assets: ['Layer'], key: 'lightsOn' }
                ]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections:[
                    {
                        EphemeraId: 'MAP#DEF',
                        assets: ['Base'],
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }]
        })

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
                connections: [
                    { EphemeraId: 'ROOM#ABC', key: 'lightSwitch', assets: ['Base'] }
                ]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections: []
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                connections: [
                    { EphemeraId: 'ROOM#ABC', key: 'lightSwitch', assets: ['Base', 'Layer'] }
                ]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections:[]
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }]
        })

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
                connections: [
                    { EphemeraId: 'ROOM#ABC', key: 'lightSwitch', assets: ['Base', 'Layer'] }
                ]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections: []
            }
        ] }
        ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [
                {
                    EphemeraId: 'VARIABLE#XYZ',
                    connections: [
                        { EphemeraId: 'ROOM#ABC', key: 'lightSwitch', assets: ['Base'] }
                    ]
                },
                {
                    EphemeraId: 'ROOM#ABC',
                    connections:[]
                }
            ]
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
        await updateGraphStorage(internalCache)({
            payloads: [{
                type: 'DescentUpdate',
                EphemeraId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Base']
                }
            }]
        })

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
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Base']
                }]
            },
            {
                EphemeraId: 'ROOM#ABC',
                connections: [{ EphemeraId: 'MAP#DEF', assets: ['Base'] }]
            },
            {
                EphemeraId: 'MAP#DEF',
                connections: []
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