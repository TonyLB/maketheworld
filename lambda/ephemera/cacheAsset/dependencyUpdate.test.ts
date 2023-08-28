jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update/index'

import { updateDependenciesFromMergeActions } from './dependencyUpdate'

const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<typeof internalCacheMock._graphCache, string>>

describe('dependencyUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        internalCacheMock.CharacterConnections.get.mockResolvedValue([])
        GraphUpdateMock.mockClear()
    })

    it('should create internal connections when merging ephemera', async () => {
        await updateDependenciesFromMergeActions('test', new GraphUpdateMock({ internalCache: internalCacheMock, dbHandler: {} }))([
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
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(5)
        const testSetEdge = (itemId: string, edges: any[]) => ([{ itemId, edges, options: { direction: 'back', contextFilter: expect.any(Function) } }])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#ABC', []))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#DEF', [{ target: 'ASSET#test', context: 'test' }, { target: 'COMPUTED#XYZ', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('MAP#LMNO', [{ target: 'ASSET#test', context: 'test' }, { target: 'ROOM#DEF', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('KNOWLEDGE#GHI', [{ target: 'ASSET#test', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('COMPUTED#XYZ', [{ target: 'ASSET#test', context: 'test' }, { target: 'VARIABLE#TUV', context: 'test' }, { target: 'VARIABLE#QRS', context: 'test' }]))
    })
})