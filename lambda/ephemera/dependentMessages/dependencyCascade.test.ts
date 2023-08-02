jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

import dependencyCascade from './dependencyCascade'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { objectFilterEntries } from '@tonylb/mtw-utilities/dist/objects'
import { EphemeraComputedId } from '@tonylb/mtw-interfaces/dist/baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)

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
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo',
            c: 'COMPUTED#TestOne',
            d: 'COMPUTED#TestTwo'
        })
        const testGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' },
                'COMPUTED#CascadeTwo': { key: 'COMPUTED#CascadeTwo' },
                'COMPUTED#CascadeThree': { key: 'COMPUTED#CascadeThree' }
            },
            [
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base' },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeTwo', context: 'base' },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeThree', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockResolvedValue([])
        await dependencyCascade({
            payloads: [
                { targetId: 'COMPUTED#TestOne' },
                { targetId: 'COMPUTED#TestTwo' }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(5)
        const cascadeTest = (ephemeraId: EphemeraComputedId, value: number) => ([
            {
                ConditionCheck: {
                    Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                    ConditionExpression: 'value = :value',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':value': 1 }
                }
            },
            {
                ConditionCheck: {
                    Key: { EphemeraId: 'VARIABLE#VariableTwo', DataCategory: 'Meta::Variable' },
                    ConditionExpression: 'value = :value',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':value': 2 }
                }
            },
            {
                PrimitiveUpdate: {
                    Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
                    ProjectionFields: ['value'],
                    UpdateExpression: 'SET value = :value',
                    ExpressionAttributeValues: { ':value': value }
                }
            }
        ])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 3))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestTwo', 2))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeOne', 6))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeTwo', 9))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeThree', 7))

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
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo',
            c: 'COMPUTED#TestOne',
            d: 'COMPUTED#TestTwo'
        })
        const testGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' },
                'COMPUTED#CascadeTwo': { key: 'COMPUTED#CascadeTwo' },
                'COMPUTED#CascadeThree': { key: 'COMPUTED#CascadeThree' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base' },
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestTwo', context: 'base' },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base' },
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeTwo', context: 'base' },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeThree', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockResolvedValue([])
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 3 },
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(6)
        const cascadeTest = (ephemeraId: EphemeraComputedId, value: number) => ([
            {
                ConditionCheck: {
                    Key: { EphemeraId: 'VARIABLE#VariableTwo', DataCategory: 'Meta::Variable' },
                    ConditionExpression: 'value = :value',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':value': 2 }
                }
            },
            {
                PrimitiveUpdate: {
                    Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
                    ProjectionFields: ['value'],
                    UpdateExpression: 'SET value = :value',
                    ExpressionAttributeValues: { ':value': value }
                }
            }
        ])
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
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestOne', 5))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#TestTwo', 6))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeOne', 10))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeTwo', 15))
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith(cascadeTest('COMPUTED#CascadeThree', 11))

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
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo',
            c: 'COMPUTED#TestOne',
            d: 'COMPUTED#TestTwo'
        })
        const testGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'COMPUTED#TestTwo': { key: 'COMPUTED#TestTwo' },
                'COMPUTED#CascadeOne': { key: 'COMPUTED#CascadeOne' }
            },
            [
                { from: 'COMPUTED#TestOne', to: 'COMPUTED#CascadeOne', context: 'base' },
                { from: 'COMPUTED#TestTwo', to: 'COMPUTED#CascadeOne', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockResolvedValue([])
        await dependencyCascade({
            payloads: [
                { targetId: 'COMPUTED#TestOne' },
                { targetId: 'COMPUTED#TestTwo' }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(3)
        const conditionCheckOne = {
            ConditionCheck: {
                Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :value',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':value': 1 }
            }
        }
        const conditionCheckTwo = {
            ConditionCheck: {
                Key: { EphemeraId: 'VARIABLE#VariableTwo', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :value',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':value': 2 }
            }
        }
        const cascadeTest = (ephemeraId: EphemeraComputedId, value: number) => ({
            PrimitiveUpdate: {
                Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
                ProjectionFields: ['value'],
                UpdateExpression: 'SET value = :value',
                ExpressionAttributeValues: { ':value': value }
            }
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([conditionCheckOne, cascadeTest('COMPUTED#TestOne', 2)])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([conditionCheckTwo, cascadeTest('COMPUTED#TestTwo', 6)])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([conditionCheckOne, conditionCheckTwo, cascadeTest('COMPUTED#CascadeOne', 8)])

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
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            c: 'COMPUTED#TestOne',
        })
        const testGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'ROOM#TestRoom': { key: 'ROOM#TestRoom' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base' },
                { from: 'COMPUTED#TestOne', to: 'ROOM#TestRoom', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockResolvedValue([])
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 2 }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        const cascadeTest = (ephemeraId: EphemeraComputedId, value: number) => ({
            PrimitiveUpdate: {
                Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
                ProjectionFields: ['value'],
                UpdateExpression: 'SET value = :value',
                ExpressionAttributeValues: { ':value': value }
            }
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            PrimitiveUpdate: {
                Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :oldValue',
                UpdateExpression: 'SET value = :newValue',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':newValue': 2, ':oldValue': 1 }
            }
        }])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([cascadeTest('COMPUTED#TestOne', 4)])

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
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            c: 'COMPUTED#TestOne',
        })
        const testGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'COMPUTED#TestOne': { key: 'COMPUTED#TestOne' },
                'VARIABLE#VariableOne': { key: 'VARIABLE#VariableOne' },
                'ROOM#TestRoom': { key: 'ROOM#TestRoom' },
                'MAP#TestMap': { key: 'MAP#TestMap' }
            },
            [
                { from: 'VARIABLE#VariableOne', to: 'COMPUTED#TestOne', context: 'base' },
                { from: 'COMPUTED#TestOne', to: 'ROOM#TestRoom', context: 'base' },
                { from: 'ROOM#TestRoom', to: 'MAP#TestMap', context: 'base' }
            ],
            {},
            true
        )

        internalCacheMock.Graph.get.mockResolvedValue(testGraph)
        internalCacheMock.GraphNodes.get.mockResolvedValue([])
        await dependencyCascade({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 2 }
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(2)
        const cascadeTest = (ephemeraId: EphemeraComputedId, value: number) => ({
            PrimitiveUpdate: {
                Key: { EphemeraId: ephemeraId, DataCategory: 'Meta::Computed' },
                ProjectionFields: ['value'],
                UpdateExpression: 'SET value = :value',
                ExpressionAttributeValues: { ':value': value }
            }
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            PrimitiveUpdate: {
                Key: { EphemeraId: 'VARIABLE#VariableOne', DataCategory: 'Meta::Variable' },
                ConditionExpression: 'value = :oldValue',
                UpdateExpression: 'SET value = :newValue',
                ProjectionFields: ['value'],
                ExpressionAttributeValues: { ':newValue': 2, ':oldValue': 1 }
            }
        }])
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([cascadeTest('COMPUTED#TestOne', 4)])

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