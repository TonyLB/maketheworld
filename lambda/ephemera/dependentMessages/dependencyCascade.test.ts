jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

import dependencyCascadeMessage from './dependencyCascade'
import { DependencyNode } from '../internalCache/baseClasses'
import { extractTree } from "@tonylb/mtw-utilities/dist/graphStorage/cache"
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { objectEntryFilter } from '../lib/objects'
import { objectFilterEntries } from '@tonylb/mtw-utilities/dist/objects'
import { EphemeraComputedId } from '@tonylb/mtw-interfaces/dist/baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)

describe('DependencyCascadeMessage', () => {
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
        await dependencyCascadeMessage({
            payloads: [
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestOne' },
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestTwo' }
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
        await dependencyCascadeMessage({
            payloads: [
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestOne' },
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestTwo' }
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

    //
    // TODO: ISS2751: Refactor new dependencyCascade to accept variable updates
    //

    //
    // TODO: ISS2752: Refactor dependencyCascade to trigger room renders
    //

    //
    // TODO: ISS2753: Refactor dependencyCascade to trigger map renders
    //

    // it('should cascade computed after updating a variable', async () => {
    //     internalCacheMock.Descent.generationOrder.mockReturnValue([['VARIABLE#testVariable'], ['COMPUTED#TestOne', 'COMPUTED#TestTwo']])
    //     const testDescent: DependencyNode[] = [
    //         {
    //             EphemeraId: 'VARIABLE#testVariable',
    //             completeness: 'Partial',
    //             connections: [
    //                 { EphemeraId: 'COMPUTED#TestOne', key: 'testVariable', assets: ['base'] },
    //                 { EphemeraId: 'COMPUTED#TestTwo', key: 'testVariable', assets: ['base'] }
    //             ]
    //         },
    //         {
    //             EphemeraId: 'COMPUTED#TestOne',
    //             completeness: 'Partial',
    //             connections: [
    //                 { EphemeraId: 'COMPUTED#CascadeOne', key: 'testOne', assets: ['base'] },
    //                 { EphemeraId: 'COMPUTED#CascadeTwo', key: 'testOne', assets: ['base'] }
    //             ]
    //         },
    //         {
    //             EphemeraId: 'COMPUTED#CascadeOne',
    //             completeness: 'Partial',
    //             connections: []
    //         },
    //         {
    //             EphemeraId: 'COMPUTED#CascadeTwo',
    //             completeness: 'Partial',
    //             connections: []
    //         },
    //         {
    //             EphemeraId: 'COMPUTED#TestTwo',
    //             completeness: 'Partial',
    //             connections: [
    //                 { EphemeraId: 'COMPUTED#CascadeOne', key: 'testTwo', assets: ['base'] }
    //             ]
    //         }
    //     ]
    //     internalCacheMock.Descent.getBatch.mockResolvedValue(testDescent)
    //     internalCacheMock.Descent.getPartial.mockImplementation((targetId) => (extractTree(testDescent, targetId)))
    //     await dependencyCascadeMessage({
    //         payloads: [
    //             { type: 'DependencyCascade', targetId: 'VARIABLE#testVariable' }
    //         ],
    //         messageBus: messageBusMock
    //     })
    //     expect(transactMock).toHaveBeenCalledTimes(0)
    //     expect(messageBusMock.send).toHaveBeenCalledTimes(4)
    //     expect(messageBusMock.send.mock.calls.map(([item]) => (item))).toMatchSnapshot()

    // })
})