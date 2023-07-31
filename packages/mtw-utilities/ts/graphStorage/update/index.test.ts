import { GraphNodeData } from '../cache/graphNode'
import updateGraphStorage, { GraphStorageDBH } from './'
import withGetOperations from '../../dynamoDB/mixins/get'
import produce from 'immer'
import withPrimitives from '../../dynamoDB/mixins/primitives'
import { GraphEdgeData } from '../cache/graphEdge'
import { GraphCacheData } from '../cache'

const internalCache = {
    Nodes: {
        get: jest.fn(),
        invalidate: jest.fn()
    } as unknown as 
        jest.Mocked<GraphNodeData<string, 
            InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
            InstanceType<ReturnType<ReturnType<typeof withPrimitives<'PrimaryKey'>>>>
        >>,
    Graph: {
        get: jest.fn()
    } as unknown as 
    jest.Mocked<GraphCacheData<string, 
        InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
        InstanceType<ReturnType<ReturnType<typeof withPrimitives<'PrimaryKey'>>>>,
        {}
    >>,
    Edges: {
        get: jest.fn()
    } as unknown as 
        jest.Mocked<GraphEdgeData<string, 
            InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
            InstanceType<ReturnType<ReturnType<typeof withPrimitives<'PrimaryKey'>>>>,
            {}
        >>,
    clear: jest.fn(),
    flush: jest.fn()
}

const optimisticUpdate = jest.fn().mockResolvedValue({})
const transactWrite = jest.fn()
const dbHandler = { optimisticUpdate, transactWrite } as unknown as GraphStorageDBH

describe('graphStore update', () => {
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

    const testTransact = (Key: { PrimaryKey: string; DataCategory: string }) => ({
        Key,
        updateKeys: ['edgeSet', 'updatedAt', 'invalidatedAt'],
        updateReducer: expect.any(Function),
        priorFetch: { updatedAt: undefined },
        checkKeys: ['updatedAt']
    })

    it('should correctly add disjoint edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(10)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][2].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportFour::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][3].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][3].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][4].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][4].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][5].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][5].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][6].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][6].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][7].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][7].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportThree::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][8]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][9]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportFour::ASSET' } })
    })

    it('should correctly add connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(9)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportThree::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][2].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][3].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][3].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportThree::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][4].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][4].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][5].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][5].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][6]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][7]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::ASSET#ImportThree::ASSET' } })
        expect(transactWrite.mock.calls[0][0][8]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportOne::ASSET' } })
    })

    it('should store edges with different context separately', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'TEST' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'TEST' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(4)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::TEST', 'ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::DifferentAsset'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::TEST', 'ASSET#ImportOne::ASSET', 'ASSET#ImportOne::DifferentAsset'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][3]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::DifferentAsset' } })
    })

    it('should correctly remove disjoint edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportThree', forward: { edges: [{ target: 'ASSET#ImportFour', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportFour', back: { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }] }, forward: { edges: [] } },
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(6)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][2].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][3].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][3].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][4]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][5]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportFour::ASSET' } })
    })

    it('should correctly remove connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }] } },
            { PrimaryKey: 'ASSET#ImportThree', back: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(6)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][2].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][3].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][3].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][4]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][5]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::ASSET#ImportThree::ASSET' } })
    })

    it('should not invalidate when removing edges with near matches', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }, { target: 'ASSET#ImportTwo', context: 'TEST' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }, { target: 'ASSET#ImportOne', context: 'TEST' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(3)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::TEST'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::TEST'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
    })

    it('should delete only edges that are present', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }, { target: 'ASSET#ImportTwo', context: 'ASSETTWO' }] }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }, { target: 'ASSET#ImportOne', context: 'ASSETTWO' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(3)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2]).toEqual({ Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
    })

    it('should conditionCheck on updatedAt when available', async () => {
        internalCache.Nodes.get.mockResolvedValue([
            { PrimaryKey: 'ASSET#ImportOne', forward: { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }], updatedAt: 500 }, back: { edges: [] } },
            { PrimaryKey: 'ASSET#ImportTwo', back: { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }] }, forward: { edges: [] } }
        ])
        await updateGraphStorage({ internalCache, dbHandler })({
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
        expect(transactWrite.mock.calls[0][0].length).toEqual(3)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual({
            ...testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }),
            priorFetch: { updatedAt: 500 }
        })
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET', 'ASSET#ImportOne::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSETTWO' } })
    })

})