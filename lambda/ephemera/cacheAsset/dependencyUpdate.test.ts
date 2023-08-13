jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/setEdges')
import setEdges from '@tonylb/mtw-utilities/dist/graphStorage/update/setEdges'

jest.mock('../internalCache')
import internalCache from '../internalCache'

import { MessageBus } from '../messageBus/baseClasses'
import { updateDependenciesFromMergeActions } from './dependencyUpdate'

const internalCacheMock = jest.mocked(internalCache, true)
const setEdgesMock = setEdges as jest.Mock

describe('dependencyUpdate', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    const setEdgesInternalMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.CharacterConnections.get.mockResolvedValue([])
        setEdgesMock.mockReturnValue(setEdgesInternalMock)
    })

    it('should create internal connections when merging ephemera', async () => {
        await updateDependenciesFromMergeActions('test')([
            {
                key: {
                    EphemeraId: 'ROOM#ABC',
                    DataCategory: 'ASSET#test'
                },
                action: 'delete'
            },
            {
                key: {
                    EphemeraId: 'ROOM#GHI',
                    DataCategory: 'ASSET#test'
                },
                action: 'ignore'

            },
            {
                key: {
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test',
                    key: 'ABC',
                    appearances: [{
                        conditions: [],
                        exits: [],
                        name: [{ tag: 'String', value: 'Vortex' }],
                        render: []
                    },
                    {
                        conditions: [{
                            dependencies: [{
                                key: 'active',
                                EphemeraId: 'COMPUTED#XYZ'
                            }],
                            if: "active"
                        }],
                        exits: [],
                        name: [],
                        render: ["The lights are on "]
                    }]
                },
            },
            {
                key: {
                    EphemeraId: 'MAP#LMNO',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'MAP#LMNO',
                    DataCategory: 'ASSET#test',
                    key: 'LMNO',
                    appearances: [{
                        conditions: [],
                        rooms: [{ EphemeraId: 'ROOM#DEF' }]
                    }]
                }
            },
            {
                key: {
                    EphemeraId: 'KNOWLEDGE#GHI',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'KNOWLEDGE#GHI',
                    DataCategory: 'ASSET#test',
                    key: 'testKnowledge',
                    appearances: [{
                        conditions: [],
                        name: [{ tag: 'String', value: 'Knowledge is power' }],
                        render: [{ tag: 'String', value: 'There is so much to learn!' }]
                    }]
                },
            },
            {
                key: {
                    EphemeraId: 'VARIABLE#QRS',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'VARIABLE#QRS',
                    DataCategory: 'ASSET#test',
                    key: 'powered',
                    default: 'false'
                },
            },
            {
                key: {
                    EphemeraId: 'VARIABLE#TUV',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'VARIABLE#TUV',
                    DataCategory: 'ASSET#test',
                    key: 'switchedOn',
                    default: 'true'
                },
            },
            {
                key: {
                    EphemeraId: 'COMPUTED#XYZ',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'COMPUTED#XYZ',
                    DataCategory: 'ASSET#test',
                    key: 'active',
                    src: 'powered && switchedOn',
                    dependencies: [
                        { key: 'switchedOn', EphemeraId: 'VARIABLE#TUV' },
                        { key: 'powered', EphemeraId: 'VARIABLE#QRS' }
                    ]
                }
            }
        ])
        expect(setEdgesInternalMock).toHaveBeenCalledTimes(1)
        expect(setEdgesInternalMock).toHaveBeenCalledWith([
            { itemId: 'ROOM#ABC', edges: [], options: { direction: 'back', contextFilter: expect.any(Function) } },
            { itemId: 'ROOM#DEF', edges: [{ target: 'COMPUTED#XYZ', context: 'test' }], options: { direction: 'back', contextFilter: expect.any(Function) } },
            { itemId: 'MAP#LMNO', edges: [{ target: 'ROOM#DEF', context: 'test' }], options: { direction: 'back', contextFilter: expect.any(Function) } },
            { itemId: 'KNOWLEDGE#GHI', edges: [], options: { direction: 'back', contextFilter: expect.any(Function) } },
            { itemId: 'COMPUTED#XYZ', edges: [{ target: 'VARIABLE#TUV', context: 'test' }, { target: 'VARIABLE#QRS', context: 'test' }], options: { direction: 'back', contextFilter: expect.any(Function) } },
        ])
    })
})