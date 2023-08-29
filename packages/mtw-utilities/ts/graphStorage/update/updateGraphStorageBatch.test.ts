import { GraphNodeData } from '../cache/graphNode'
import updateGraphStorageBatch from './updateGraphStorageBatch'
import withGetOperations from '../../dynamoDB/mixins/get'
import produce from 'immer'
import withPrimitives from '../../dynamoDB/mixins/primitives'
import { GraphEdgeData } from '../cache/graphEdge'
import { GraphCacheData } from '../cache'
import { Graph } from '../utils/graph'
import { GraphStorageDBH } from './baseClasses'

const internalCacheNodeSet = jest.fn()

const internalCache = {
    Nodes: {
        get: jest.fn(),
        set: internalCacheNodeSet,
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

describe('updateGraphStorageBatch', () => {
    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const dateNowStub = jest.fn(() => 1000)
        global.Date.now = dateNowStub
        internalCacheNodeSet.mockClear()
        transactWrite.mockImplementation(async (items) => {
            items.forEach((item) => {
                if ('Update' in item && item.Update.successCallback) {
                    const returnValue = produce({}, item.Update.updateReducer)
                    item.Update.successCallback(returnValue, {})
                }
            })
        })
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    const testTransact = (Key: { PrimaryKey: string; DataCategory: string }) => ({
        Key,
        updateKeys: ['edgeSet', 'updatedAt', 'invalidatedAt'],
        updateReducer: expect.any(Function),
        successCallback: expect.any(Function),
        checkKeys: ['updatedAt']
    })

    it('should correctly add disjoint edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' },
                'ASSET#ImportThree': { key: 'ASSET#ImportThree' },
                'ASSET#ImportFour': { key: 'ASSET#ImportFour' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'put' },
                { from: 'ASSET#ImportThree', to: 'ASSET#ImportFour', context: 'ASSET', action: 'put' }
            ],
            {},
            true
        ))

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(internalCacheNodeSet).toHaveBeenCalledTimes(8)
        expect(transactWrite.mock.calls[0][0].length).toEqual(10)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportOne', 'forward', { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportTwo', 'forward', { edges: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][2].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportFour::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportThree', 'forward', { edges: [{ target: 'ASSET#ImportFour', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][3].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][3].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportFour', 'forward', { edges: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][4].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][4].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportOne', 'back', { edges: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][5].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][5].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportTwo', 'back', { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][6].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][6].Update.updateReducer)).toEqual({ edgeSet: [], updatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportThree', 'back', { edges: [], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][7].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][7].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportThree::ASSET'], updatedAt: 1000, invalidatedAt: 1000 })
        expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportFour', 'back', { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][8]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } })
        expect(transactWrite.mock.calls[0][0][9]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportFour::ASSET' } })
    })

    it('should correctly add connecting edges', async () => {
        internalCache.Nodes.get.mockResolvedValue([])
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' },
                'ASSET#ImportThree': { key: 'ASSET#ImportThree' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'put' },
                { from: 'ASSET#ImportTwo', to: 'ASSET#ImportThree', context: 'ASSET', action: 'put' },
                { from: 'ASSET#ImportThree', to: 'ASSET#ImportOne', context: 'ASSET', action: 'put' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'put' },
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'DifferentAsset', action: 'put' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' },
                'ASSET#ImportThree': { key: 'ASSET#ImportThree' },
                'ASSET#ImportFour': { key: 'ASSET#ImportFour' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'delete' },
                { from: 'ASSET#ImportThree', to: 'ASSET#ImportFour', context: 'ASSET', action: 'delete' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' },
                'ASSET#ImportThree': { key: 'ASSET#ImportThree' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'delete' },
                { from: 'ASSET#ImportTwo', to: 'ASSET#ImportThree', context: 'ASSET', action: 'delete' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'delete' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' },
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'TEST', action: 'delete' },
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSET', action: 'delete' }
            ],
            {},
            true
        ))

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
        await updateGraphStorageBatch({ internalCache, dbHandler })(new Graph(
            {
                'ASSET#ImportOne': { key: 'ASSET#ImportOne' },
                'ASSET#ImportTwo': { key: 'ASSET#ImportTwo' }
            },
            [
                { from: 'ASSET#ImportOne', to: 'ASSET#ImportTwo', context: 'ASSETTWO', action: 'put' }
            ],
            {},
            true
        ))

        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(transactWrite.mock.calls[0][0].length).toEqual(3)
        expect(transactWrite.mock.calls[0][0][0].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][0].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][1].Update).toEqual(testTransact({ PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }))
        expect(produce({ edgeSet: [] }, transactWrite.mock.calls[0][0][1].Update.updateReducer)).toEqual({ edgeSet: ['ASSET#ImportOne::ASSET', 'ASSET#ImportOne::ASSETTWO'], updatedAt: 1000 })
        expect(transactWrite.mock.calls[0][0][2]).toEqual({ Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSETTWO' } })
    })

})