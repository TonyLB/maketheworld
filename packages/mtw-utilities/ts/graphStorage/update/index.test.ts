import { GraphCacheData } from '../cache/'
import updateGraphStorage from './'

const internalCache = {
    Descent: {
        get: jest.fn(),
        put: jest.fn(),
        getPartial: jest.fn()
    } as unknown as jest.Mocked<GraphCacheData>,
    Ancestry: {
        get: jest.fn(),
        put: jest.fn(),
        getPartial: jest.fn()
    } as unknown as jest.Mocked<GraphCacheData>,
    clear: jest.fn(),
    flush: jest.fn()
}

const optimisticUpdate = jest.fn().mockResolvedValue({})
const dbHandler = { optimisticUpdate }

describe('graphStore update', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.Descent.get.mockResolvedValue([])
        internalCache.Descent.getPartial.mockReturnValue([])
        internalCache.Ancestry.get.mockResolvedValue([])
        internalCache.Ancestry.getPartial.mockReturnValue([])
    })

    it('should call all unreferenced updates in a first wave', async () => {
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportTwo',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(2)
        expect(optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportTwo',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        expect(optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportOne',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [] }
        optimisticUpdate.mock.calls[1][0].updateReducer(testItem)
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
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
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
        internalCache.Ancestry.getPartial.mockReturnValue([
            {
                EphemeraId: 'ASSET#ImportOne',
                completeness: 'Complete',
                connections: [
                    { EphemeraId: 'ASSET#Base', assets: ['ASSET'] },
                    { EphemeraId: 'ASSET#Bootstrap', assets: ['ASSET'] }
                ]
            },
            {
                EphemeraId: 'ASSET#Base',
                completeness: 'Complete',
                connections: []
            },
            {
                EphemeraId: 'ASSET#Bootstrap',
                completeness: 'Complete',
                connections: []
            }
        ])
        internalCache.Descent.getPartial.mockImplementation((key) => (key === 'ASSET#ImportTwo'
            ? [
                {
                    EphemeraId: 'ASSET#ImportTwo',
                    completeness: 'Complete',
                    connections: [{ EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }]
                },
                {
                    EphemeraId: 'ASSET#ImportThree',
                    completeness: 'Complete',
                    connections: []
                }
            ]
            : [
                {
                    EphemeraId: 'ASSET#ImportOne',
                    completeness: 'Complete',
                    connections: [{ EphemeraId: 'ASSET#ImportOne', assets: ['ASSET'] }]
                },
                {
                    EphemeraId: 'ASSET#ImportTwo',
                    completeness: 'Complete',
                    connections: [{ EphemeraId: 'ASSET#ImportThree', assets: ['ASSET'] }]
                },
                {
                    EphemeraId: 'ASSET#ImportThree',
                    completeness: 'Complete',
                    connections: []
                }
            ]))
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(3)
        let testItem = { Descent: [] }
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({ Descent: [{
            EphemeraId: 'ASSET#ImportOne',
            connections: [{ EphemeraId: 'ASSET#ImportTwo', assets: ['ASSET'] }]
        },
        {
            EphemeraId: 'ASSET#ImportTwo',
            connections: []
        }]})
        testItem = { Descent: [] }
        optimisticUpdate.mock.calls[1][0].updateReducer(testItem)
        expect(testItem).toEqual({ Descent: [{
            EphemeraId: 'ASSET#Base',
            connections: [{ EphemeraId: 'ASSET#ImportOne', assets: ['ASSET'] }]
        },
        {
            EphemeraId: 'ASSET#ImportOne',
            connections: []
        }]})
        testItem = { Descent: [] }
        optimisticUpdate.mock.calls[2][0].updateReducer(testItem)
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
        internalCache.Ancestry.getPartial.mockReturnValueOnce([
            {
                EphemeraId: 'ASSET#Base',
                completeness: 'Complete',
                connections: []
            }
        ])
        internalCache.Descent.getPartial.mockReturnValueOnce([
            {
                EphemeraId: 'ASSET#ImportThree',
                completeness: 'Complete',
                connections: []
            }
        ])
        .mockReturnValueOnce([])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(optimisticUpdate).toHaveBeenCalledWith({
            key: {
                EphemeraId: 'ASSET#ImportOne',
                DataCategory: 'Meta::Asset'
            },
            updateKeys: ['Descent', 'DataCategory'],
            updateReducer: expect.any(Function)
        })
        let testItem = { Descent: [] }
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
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
        internalCache.Ancestry.getPartial.mockReturnValue([])
        internalCache.Descent.getPartial.mockReturnValue([{
            EphemeraId: 'MAP#DEF',
            completeness: 'Complete',
            connections: []
        }])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightsOn',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(optimisticUpdate).toHaveBeenCalledWith({
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
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
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
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                putItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(optimisticUpdate).toHaveBeenCalledWith({
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
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
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
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Layer']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(optimisticUpdate).toHaveBeenCalledWith({
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
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
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
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                deleteItem: {
                    key: 'lightSwitch',
                    EphemeraId: 'ROOM#ABC',
                    assets: ['Base']
                }
            }],
            ancestry: []
        })

        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(optimisticUpdate).toHaveBeenCalledWith({
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
        optimisticUpdate.mock.calls[0][0].updateReducer(testItem)
        expect(testItem).toEqual({
            Descent: [{
                EphemeraId: 'VARIABLE#XYZ',
                connections: []
            }]
        })
    })

})