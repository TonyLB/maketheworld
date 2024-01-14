jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

import dependencyCascade from './dependencyCascade'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { objectFilterEntries } from '@tonylb/mtw-utilities/dist/objects'
import { EphemeraComputedId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isLegalDependencyTag } from '../internalCache/baseClasses'
import { extractConstrainedTag } from '@tonylb/mtw-utilities/dist/types'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)

const cascadeTest = (ephemeraId: EphemeraComputedId, value: number, conditions: { key: string; value: any }[]) => ([
    ...conditions.map(({ key, value }) => ({
        ConditionCheck: {
            Key: { EphemeraId: key, DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(key)}` },
            ConditionExpression: 'value = :value',
            ProjectionFields: ['value'],
            ExpressionAttributeValues: { ':value': value }
        }
    })),
    {
        PrimitiveUpdate: {
            Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
            ProjectionFields: ['value'],
            UpdateExpression: 'SET value = :value',
            ExpressionAttributeValues: { ':value': value }
        }
    }
])

const graphNodeImplementation = (testGraph) => async (nodes) => (nodes.map((nodeKey) => {
    const node = testGraph.getNode(nodeKey)
    if (typeof node === 'undefined') {
        throw new Error('Lookup on absent node')
    }
    return {
        PrimaryKey: nodeKey,
        forward: { edges: node.edges.map(({ to, context = '' }) => ({ target: to, context})) },
        back: { edges: node.backEdges.map(({ from, context = '' }) => ({ target: from, context})) }
    }
}))

describe('DependencyCascade', () => {
    let stateCacheMock
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        stateCacheMock = jest.spyOn(internalCache.StateCache, "get")
    })

    it('should update a computed item and cascade', async () => {
        stateCacheMock.mockImplementation((keys) => (objectFilterEntries(
            {
                'COMPUTED#TestOne': {
                    src: 'a + b',
                    value: 4,
                    dependencies: ['a', 'b']
                },
                'COMPUTED#TestTwo': {
                    src: 'a * b',
                    value: 3,
                    dependencies: ['a', 'b']
                },
                'COMPUTED#CascadeOne': {
                    src: 'c * 2',
                    value: 8,
                    dependencies: ['c']
                },
                'COMPUTED#CascadeTwo': {
                    src: 'c * 3',
                    value: 12,
                    dependencies: ['c']
                },
                'COMPUTED#CascadeThree': {
                    src: 'd + 5',
                    value: 8,
                    dependencies: ['d']
                },
                'VARIABLE#VariableOne': { value: 1 },
                'VARIABLE#VariableTwo': { value: 2 }
            },
            ([key]) => (keys.includes(key))
        )))
        ephemeraDBMock.transactWrite.mockResolvedValue()
        const testGraph = new Graph<string, { key: string }, { context?: string; scopedId?: string }>(
            {
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'VARIABLE#VariableTwo': { key: 'VARIABLE#VariableTwo' },
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' },
                'COMPUTED#CascadeTwo': { key: 'COMPUTED#CascadeTwo' },
                'COMPUTED#CascadeThree': { key: 'COMPUTED#CascadeThree' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'a' } },
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestTwo', context: 'base', data: { scopedId: 'a' } },
                { from: 'VARIABLE#VariableTwo', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'b' } },
                { from: 'VARIABLE#VariableTwo', to: 'COMPUTED#TestTwo', context: 'base', data: { scopedId: 'b' } },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base', data: { scopedId: 'c' } },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeTwo', context: 'base', data: { scopedId: 'c' } },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeThree', context: 'base', data: { scopedId: 'd' } }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)

        internalCacheMock.GraphNodes.get.mockImplementation(graphNodeImplementation(testGraph))
        await dependencyCascade({
            payloads: [
                { targetId: 'COMPUTED#TestOne' },
                { targetId: 'COMPUTED#TestTwo' }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(5)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 3, [{ key: 'VARIABLE#VariableOne', value: 1 }, { key: 'VARIABLE#VariableTwo', value: 2 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestTwo', 2, [{ key: 'VARIABLE#VariableOne', value: 1 }, { key: 'VARIABLE#VariableTwo', value: 2 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeOne', 6, [{ key: 'COMPUTED#TestOne', value: 3 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeTwo', 9, [{ key: 'COMPUTED#TestOne', value: 3 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeThree', 7, [{ key: 'COMPUTED#TestTwo', value: 2 }]))

    })

    it('should update a variable item and cascade', async () => {
        stateCacheMock.mockImplementation((keys) => (objectFilterEntries(
            {
                'COMPUTED#TestOne': {
                    src: 'a + b',
                    value: 3,
                    dependencies: ['a', 'b']
                },
                'COMPUTED#TestTwo': {
                    src: 'a * b',
                    value: 2,
                    dependencies: ['a', 'b']
                },
                'COMPUTED#CascadeOne': {
                    src: 'c * 2',
                    value: 6,
                    dependencies: ['c']
                },
                'COMPUTED#CascadeTwo': {
                    src: 'c * 3',
                    value: 9,
                    dependencies: ['c']
                },
                'COMPUTED#CascadeThree': {
                    src: 'd + 5',
                    value: 7,
                    dependencies: ['d']
                },
                'VARIABLE#VariableOne': { value: 1 },
                'VARIABLE#VariableTwo': { value: 2 }
            },
            ([key]) => (keys.includes(key))
        )))
        ephemeraDBMock.transactWrite.mockResolvedValue()
        const testGraph = new Graph<string, { key: string }, { context?: string; scopedId?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' },
                'COMPUTED#CascadeTwo': { key: 'COMPUTED#CascadeTwo' },
                'COMPUTED#CascadeThree': { key: 'COMPUTED#CascadeThree' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'VARIABLE#VariableTwo': { key: 'VARIABLE#VariableTwo' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'a' } },
                { from: 'VARIABLE#VariableTwo', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'b' } },
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestTwo', context: 'base', data: { scopedId: 'a' } },
                { from: 'VARIABLE#VariableTwo', to: 'COMPUTED#TestTwo', context: 'base', data: { scopedId: 'b' } },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base', data: { scopedId: 'c' } },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeTwo', context: 'base', data: { scopedId: 'c' } },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeThree', context: 'base', data: { scopedId: 'd' } }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockImplementation(graphNodeImplementation(testGraph))
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 3 },
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(6)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([
            {
                PrimitiveUpdate: {
                    Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                    UpdateExpression: 'SET value = :newValue',
                    ConditionExpression: 'value = :oldValue',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':newValue': 3, ':oldValue': 1 }
                }
            }
        ])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 5, [{ key: 'VARIABLE#VariableOne', value: 3 }, { key: 'VARIABLE#VariableTwo', value: 2 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestTwo', 6, [{ key: 'VARIABLE#VariableOne', value: 3 }, { key: 'VARIABLE#VariableTwo', value: 2 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeOne', 10, [{ key: 'COMPUTED#TestOne', value: 5 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeTwo', 15, [{ key: 'COMPUTED#TestOne', value: 5 }]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeThree', 11, [{ key: 'COMPUTED#TestTwo', value: 6 }]))

    })

    it('should combine parallel ancestor cascades', async () => {
        stateCacheMock.mockImplementation((keys) => (objectFilterEntries(
            {
                'COMPUTED#TestOne': {
                    src: 'a * 2',
                    value: 4,
                    dependencies: ['a']
                },
                'COMPUTED#TestTwo': {
                    src: 'b * 3',
                    value: 3,
                    dependencies: ['b']
                },
                'COMPUTED#CascadeOne': {
                    src: 'c + d',
                    value: 7,
                    dependencies: ['c', 'd']
                },
                'VARIABLE#VariableOne': { value: 1 },
                'VARIABLE#VariableTwo': { value: 2 }
            },
            ([key]) => (keys.includes(key))
        )))
        ephemeraDBMock.transactWrite.mockResolvedValue()
        const testGraph = new Graph<string, { key: string }, { context?: string; scopedId?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'VARIABLE#VariableTwo': { key: 'VARIABLE#VariableTwo' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'a' } },
                { from: 'VARIABLE#VariableTwo', to: 'COMPUTED#TestTwo', context: 'base', data: { scopedId: 'b' } },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base', data: { scopedId: 'c' } },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeOne', context: 'base', data: { scopedId: 'd' } }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockImplementation(graphNodeImplementation(testGraph))
        await dependencyCascade({
            payloads: [
                { targetId: 'COMPUTED#TestOne' },
                { targetId: 'COMPUTED#TestTwo' }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(3)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 2, [{ key: 'VARIABLE#VariableOne', value: 1}]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestTwo', 6, [{ key: 'VARIABLE#VariableTwo', value: 2}]))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeOne', 8, [{ key: 'COMPUTED#TestOne', value: 2 }, { key: 'COMPUTED#TestTwo', value: 6 }]))

    })

    it('should render a side-effected room', async () => {
        stateCacheMock.mockImplementation((keys) => (objectFilterEntries(
            {
                'COMPUTED#TestOne': {
                    src: 'a * 2',
                    value: 2,
                    dependencies: ['a']
                },
                'VARIABLE#VariableOne': { value: 1 }
            },
            ([key]) => (keys.includes(key))
        )))
        ephemeraDBMock.transactWrite.mockResolvedValue()
        const testGraph = new Graph<string, { key: string }, { context?: string; scopedId?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'ROOM#TestRoom': { key: 'ROOM#TestRoom' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'a' } },
                { from: 'COMPUTED#TestOne', to: 'ROOM#TestRoom', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockImplementation(graphNodeImplementation(testGraph))
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 2 }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            PrimitiveUpdate: {
                Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :oldValue',
                UpdateExpression: 'SET value = :newValue',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':newValue': 2, ':oldValue': 1 }
            }
        }])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 4, [{ key: 'VARIABLE#VariableOne', value: 2 }]))

        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ROOM#TestRoom',
            header: true
        })

    })

    it('should update a side-effected map', async () => {
        stateCacheMock.mockImplementation((keys) => (objectFilterEntries(
            {
                'COMPUTED#TestOne': {
                    src: 'a * 2',
                    value: 2,
                    dependencies: ['a']
                },
                'VARIABLE#VariableOne': { value: 1 }
            },
            ([key]) => (keys.includes(key))
        )))
        ephemeraDBMock.transactWrite.mockResolvedValue()
        const testGraph = new Graph<string, { key: string }, { context?: string; scopedId?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'ROOM#TestRoom': { key: 'ROOM#TestRoom' },
                'MAP#TestMap': { key: 'MAP#TestMap' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base', data: { scopedId: 'a' } },
                { from: 'COMPUTED#TestOne', to: 'ROOM#TestRoom', context: 'base', data: { scopedId: 'c' } },
                { from: 'ROOM#TestRoom', to: 'MAP#TestMap', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockImplementation(graphNodeImplementation(testGraph))
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 2 }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            PrimitiveUpdate: {
                Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :oldValue',
                UpdateExpression: 'SET value = :newValue',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':newValue': 2, ':oldValue': 1 }
            }
        }])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 4, [{ key: 'VARIABLE#VariableOne', value: 2 }]))

        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ROOM#TestRoom',
            header: true
        })
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'MapUpdate',
            mapId: 'MAP#TestMap'
        })

    })
    
})