import { GraphNodeData } from '../cache/graphNode'
import GraphUpdate from './'
import withGetOperations from '../../dynamoDB/mixins/get'
import withPrimitives from '../../dynamoDB/mixins/primitives'
import { GraphEdgeData } from '../cache/graphEdge'
import { GraphCacheData } from '../cache'
import { GraphStorageDBH } from './baseClasses'

jest.mock('./updateGraphStorageBatch')
import updateGraphStorageBatch from './updateGraphStorageBatch'

const updateGraphStorageBatchMock = updateGraphStorageBatch as jest.Mock

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

const dbHandlerMock = {
    batchWriteDispatcher: jest.fn()
} as unknown as jest.Mocked<GraphStorageDBH>

describe('GraphUpdate', () => {

    const updateGraphStorageInternalMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        updateGraphStorageBatchMock.mockReturnValue(updateGraphStorageInternalMock)
    })

    it('should no-op when edges match incoming', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            forward: { edges: [
                { target: 'B', context: 'test' },
                { target: 'C', context: 'test' }
            ] },
            back: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' }
            ]
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageBatchMock).toHaveBeenCalledTimes(0)
    })

    it('should add absent edge', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            forward: { edges: [
                { target: 'B', context: 'test' }
            ] },
            back: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' }
            ]
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            C: { key: 'C' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { from: 'A', to: 'C', context: 'test', action: 'put' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::back')
    })

    it('should remove surplus edge', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            forward: { edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' }
            ] },
            back: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'B', context: 'test' }
            ]
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            C: { key: 'C' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { from: 'A', to: 'C', context: 'test', action: 'delete' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::back')
    })

    it('should combine multiple operations', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            forward: { edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' }
            ] },
            back: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'B', context: 'test' },
                { target: 'B', context: 'testTwo' },
                { target: 'D', context: 'test' }
            ]
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' },
            D: { key: 'D' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { from: 'A', to: 'B', context: 'testTwo', action: 'put' },
            { from: 'A', to: 'D', context: 'test', action: 'put' },
            { from: 'A', to: 'C', context: 'test', action: 'delete' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('B::back')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::back')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('D::back')
    })

    it('should work in backwards direction', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            back: { edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' }
            ] },
            forward: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'B', context: 'test' },
                { target: 'B', context: 'testTwo' },
                { target: 'D', context: 'test' }
            ],
            options: { direction: 'back' }
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' },
            D: { key: 'D' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { to: 'A', from: 'B', context: 'testTwo', action: 'put' },
            { to: 'A', from: 'D', context: 'test', action: 'put' },
            { to: 'A', from: 'C', context: 'test', action: 'delete' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::back')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('B::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('D::forward')
    })

    it('should respect contextFilter if provided', async () => {
        internalCache.Nodes.get.mockResolvedValue([{
            PrimaryKey: 'A',
            forward: { edges: [
                { target: 'C', context: 'test' },
                { target: 'B', context: 'test' },
                { target: 'D', context: 'testTwo' }
            ] },
            back: { edges: [] }
        }])
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'B', context: 'test' },
                { target: 'D', context: 'test' },
            ],
            options: { contextFilter: (context) => (context === 'test') }
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            C: { key: 'C' },
            D: { key: 'D' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { from: 'A', to: 'D', context: 'test', action: 'put' },
            { from: 'A', to: 'C', context: 'test', action: 'delete' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::back')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('D::back')
    })

    it('should aggregate multiple setEdges calls', async () => {
        internalCache.Nodes.get.mockImplementation(async (keyList) => (
            keyList.map((key) => {
                switch(key) {
                    case 'A':
                        return {
                            PrimaryKey: 'A',
                            forward: { edges: [
                                { target: 'C', context: 'test' },
                                { target: 'B', context: 'test' },
                                { target: 'D', context: 'test' }
                            ] },
                            back: { edges: [] }
                        }
                    case 'B':
                        return {
                            PrimaryKey: 'B',
                            forward: { edges: [] },
                            back: { edges: [] }
                        }
                    default:
                        return {
                            PrimaryKey: 'error',
                            forward: { edges: [] },
                            back: { edges: [] }
                        }
                }
            }))
        )
        const graphUpdate = new GraphUpdate({ internalCache, dbHandler: dbHandlerMock })
        graphUpdate.setEdges([{
            itemId: 'A',
            edges: [
                { target: 'B', context: 'test' },
                { target: 'D', context: 'test' },
            ],
        }])
        graphUpdate.setEdges([{
            itemId: 'B',
            edges: [
                { target: 'C', context: 'test' }
            ],
        }])
        await graphUpdate.flush()
        expect(updateGraphStorageInternalMock).toHaveBeenCalledTimes(1)
        expect(updateGraphStorageInternalMock.mock.calls[0][0].nodes).toEqual({
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' }
        })
        expect(updateGraphStorageInternalMock.mock.calls[0][0].edges).toEqual([
            { from: 'A', to: 'C', context: 'test', action: 'delete' },
            { from: 'B', to: 'C', context: 'test', action: 'put' }
        ])
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('A::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('B::forward')
        expect(internalCache.Nodes.invalidate).toHaveBeenCalledWith('C::back')
    })

})