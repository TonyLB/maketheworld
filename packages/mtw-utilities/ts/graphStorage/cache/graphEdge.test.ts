import withGetOperations from "../../dynamoDB/mixins/get"
import withPrimitives from "../../dynamoDB/mixins/primitives"
import { CacheBase } from "./baseClasses"
import GraphEdge from './graphEdge'

describe('GraphEdge cache', () => {
    const dbHandler = {
        getItems: jest.fn()
    } as unknown as jest.Mocked<
        InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
        InstanceType<ReturnType<ReturnType<typeof withPrimitives<'PrimaryKey'>>>>
    >
    const internalCache = new (GraphEdge(dbHandler)(CacheBase))()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should batch-get everything in an empty cache', async () => {
        dbHandler.getItems.mockResolvedValue([
            { PrimaryKey: 'A', DataCategory: 'Edge::B' },
            { PrimaryKey: 'A', DataCategory: 'Edge::C' },
            { PrimaryKey: 'B', DataCategory: 'Edge::C' }
        ])
        const results = await internalCache.Edges.get([
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' },
        ])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'Edge::B' },
                { PrimaryKey: 'A', DataCategory: 'Edge::C' },
                { PrimaryKey: 'B', DataCategory: 'Edge::C' },
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory']
        })
        expect(results).toEqual([
            {
                key: 'A::B',
                from: 'A',
                to: 'B',
                data: {}
            },
            {
                key: 'A::C',
                from: 'A',
                to: 'C',
                data: {}
            },
            {
                key: 'B::C',
                from: 'B',
                to: 'C',
                data: {}
            },
        ])
    })

    it('should batch-get only as needed when cache has content', async () => {
        dbHandler.getItems.mockResolvedValueOnce([
            { PrimaryKey: 'A', DataCategory: 'Edge::B' },
            { PrimaryKey: 'A', DataCategory: 'Edge::C' }
        ]).mockResolvedValueOnce([
            { PrimaryKey: 'B', DataCategory: 'Edge::C' }
        ])
        const results = await internalCache.Edges.get([
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' }
        ])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'Edge::B' },
                { PrimaryKey: 'A', DataCategory: 'Edge::C' }
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory']
        })
        expect(results).toEqual([
            {
                key: 'A::B',
                from: 'A',
                to: 'B',
                data: {}
            },
            {
                key: 'A::C',
                from: 'A',
                to: 'C',
                data: {}
            }
        ])
        const secondResult = await internalCache.Edges.get([
            { from: 'A', to: 'C' },
            { from: 'B', to: 'C' }
        ])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'B', DataCategory: 'Edge::C' }
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory']
        })
        expect(secondResult).toEqual([
            {
                key: 'A::C',
                from: 'A',
                to: 'C',
                data: {}
            },
            {
                key: 'B::C',
                from: 'B',
                to: 'C',
                data: {}
            },
        ])
    })
})