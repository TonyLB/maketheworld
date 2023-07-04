import { marshall } from '@aws-sdk/util-dynamodb'
import { GraphCacheData } from '../cache/'
import { GraphNodeData } from '../cache/graphNode'
import legacyUpdateGraphStorage, { updateGraphStorage } from './'

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
    Nodes: {
        get: jest.fn(),
        invalidate: jest.fn()
    } as unknown as jest.Mocked<GraphNodeData<string>>,
    clear: jest.fn(),
    flush: jest.fn()
}

const optimisticUpdate = jest.fn().mockResolvedValue({})
const transactWrite = jest.fn()
const dbHandler = { optimisticUpdate, transactWrite }

describe('graphStore legacy update', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.Descent.get.mockResolvedValue([])
        internalCache.Descent.getPartial.mockReturnValue([])
        internalCache.Ancestry.get.mockResolvedValue([])
        internalCache.Ancestry.getPartial.mockReturnValue([])
    })

    it('should call all unreferenced updates in a first wave', async () => {
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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
        await legacyUpdateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
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

describe('graphStore new update', () => {
    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const dateNowStub = jest.fn(() => 1000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should correctly add disjoint edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportThree',
                putItem: {
                    EphemeraId: 'ASSET#ImportFour',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportFour::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportFour', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportFour', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportThree::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Put: { Item: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Put: { Item: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#ASSET#ImportFour::ASSET' } }},
        ])
    })

    it('should correctly add connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
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
            },
            {
                EphemeraId: 'ASSET#ImportThree',
                putItem: {
                    EphemeraId: 'ASSET#ImportOne',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportThree::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportThree::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::ASSET'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Put: { Item: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Put: { Item: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#ASSET#ImportThree::ASSET' } }},
            { Put: { Item: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#ASSET#ImportOne::ASSET' } }},
        ])
    })

    it('should store edges with different context separately', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'TEST' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'TEST' }] }, forward: { edges: [] } }
        ])
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
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['DifferentAsset']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::TEST', 'ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::DifferentAsset'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::TEST', 'ASSET#ImportOne::ASSET', 'ASSET#ImportOne::DifferentAsset'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Put: { Item: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Put: { Item: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::DifferentAsset' } }},
        ])
    })

    it('should correctly remove disjoint edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportThree', forward: { edges: [{ target: 'ASSET#ImportFour', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportFour', back: { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }] }, forward: { edges: [] } },
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportThree',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportFour',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportFour', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#ASSET#ImportFour::ASSET' } }},
        ])
    })

    it('should correctly remove connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }] } },
            { PrimaryKey: 'ASSET#ImportThree', back: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportTwo',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#ASSET#ImportThree::ASSET' } }}
        ])
    })

    it('should not invalidate when removing edges with near matches', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }, { target: 'ASSET#ImportTwo', context: 'TEST' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }, { target: 'ASSET#ImportOne', context: 'TEST' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::TEST'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::TEST'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
        ])
    })

    it('should correctly remove connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }] } },
            { PrimaryKey: 'ASSET#ImportThree', back: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSET']
                }
            },
            {
                EphemeraId: 'ASSET#ImportTwo',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportThree',
                    assets: ['ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': [], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment, invalidatedAt = :moment'
            } },
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#ASSET#ImportThree::ASSET' } }}
        ])
    })

    it('should delete only edges that are present', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }, { target: 'ASSET#ImportTwo', context: 'ASSETTWO' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }, { target: 'ASSET#ImportOne', context: 'ASSETTWO' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                deleteItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['TEST', 'ASSET']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::ASSETTWO'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::ASSETTWO'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Delete: { Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSET' } }},
        ])
    })

    it('should conditionCheck on invalidatedAt when available', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }], updatedAt: 500 }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler, keyLabel: 'EphemeraId' })({
            descent: [{
                EphemeraId: 'ASSET#ImportOne',
                putItem: {
                    EphemeraId: 'ASSET#ImportTwo',
                    assets: ['ASSETTWO']
                }
            }],
            ancestry: []
        })

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite).toHaveBeenCalledWith([
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#Forward' },
                ConditionExpression: 'updatedAt = :oldUpdated',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::ASSETTWO'], ':oldUpdated': 500, ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Update: {
                Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'GRAPH#Back' },
                ConditionExpression: 'attribute_not_exists(updatedAt)',
                ExpressionAttributeValues: marshall({ ':newEdgeSet': ['ASSET#ImportOne::ASSET', 'ASSET#ImportOne::ASSETTWO'], ':moment': 1000 }),
                UpdateExpression: 'SET edgeSet = :newEdgeSet, updatedAt = :moment'
            } },
            { Put: { Item: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'GRAPH#ASSET#ImportTwo::ASSETTWO' } }},
        ])
    })

})