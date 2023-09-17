import { GraphNodeData } from '../cache/graphNode'
import updateGraphStorageBatch from './updateGraphStorageBatch'
import withGetOperations from '../../dynamoDB/mixins/get'
import produce from 'immer'
import withPrimitives from '../../dynamoDB/mixins/primitives'
import { GraphEdgeData } from '../cache/graphEdge'
import { GraphCacheData } from '../cache'
import { Graph } from '../utils/graph'
import { GraphStorageDBH } from './baseClasses'
import { marshall } from '@aws-sdk/util-dynamodb'

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
        transactWrite.mockResolvedValue({})
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    const testTransact = ({ Key, addItems = [], deleteItems = [], moment = 1000, invalidate }: { Key: { PrimaryKey: string; DataCategory: string }, addItems?: string[], deleteItems?: string[], moment?: number, invalidate?: boolean }) => ({ SetOperation: {
        Key,
        attributeName: 'edgeSet',
        addItems,
        deleteItems,
        setUpdate: {
            UpdateExpression: invalidate ? 'SET updatedAt = :moment, invalidatedAt = :moment' : 'SET updatedAt = :moment',
            ExpressionAttributeValues: marshall({ ':moment': moment })
        }
    }})

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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportFour::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportOne::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportThree::ASSET'], invalidate: true }),
            { Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } },
            { Put: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportFour::ASSET' } }
        ])
        // expect(internalCacheNodeSet).toHaveBeenCalledTimes(8)
        // expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportOne', 'forward', { edges: [{ target: 'ASSET#ImportTwo', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        // expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportThree', 'forward', { edges: [{ target: 'ASSET#ImportFour', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        // expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportTwo', 'back', { edges: [{ target: 'ASSET#ImportOne', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
        // expect(internalCacheNodeSet).toHaveBeenCalledWith('ASSET#ImportFour', 'back', { edges: [{ target: 'ASSET#ImportThree', context: 'ASSET' }], updatedAt: 1000, invalidatedAt: 1000 })
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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportThree::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportOne::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportThree::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportOne::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            { Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } },
            { Put: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::ASSET#ImportThree::ASSET' } },
            { Put: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportOne::ASSET' } }
        ])
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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, addItems: ['ASSET#ImportTwo::ASSET', 'ASSET#ImportTwo::DifferentAsset'] }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, addItems: ['ASSET#ImportOne::ASSET', 'ASSET#ImportOne::DifferentAsset'] }),
            { Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } },
            { Put: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::DifferentAsset' } }
        ])
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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportFour::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportOne::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportFour', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportThree::ASSET'], invalidate: true }),
            { Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } },
            { Delete: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::ASSET#ImportFour::ASSET' } }
        ])

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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportThree::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportOne::ASSET'], invalidate: true }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportThree', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportTwo::ASSET'], invalidate: true }),
            { Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } },
            { Delete: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::ASSET#ImportThree::ASSET' } }
        ])
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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportTwo::ASSET'] }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportOne::ASSET'] }),
            { Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } }
        ])

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
        expect(transactWrite.mock.calls[0][0]).toEqual([
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::Forward' }, deleteItems: ['ASSET#ImportTwo::ASSET'] }),
            testTransact({ Key: { PrimaryKey: 'ASSET#ImportTwo', DataCategory: 'Graph::Back' }, deleteItems: ['ASSET#ImportOne::ASSET'] }),
            { Delete: { PrimaryKey: 'ASSET#ImportOne', DataCategory: 'Graph::ASSET#ImportTwo::ASSET' } }
        ])
    })

})