jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('@tonylb/mtw-utilities/ts/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update/index'

import { updateDependenciesFromMergeActions } from './dependencyUpdate'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<typeof internalCacheMock._graphCache, string>>

describe('dependencyUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.CharacterSessions.get.mockResolvedValue([])
        // @ts-ignore
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
                    EphemeraId: 'EXAMPLE#DEF',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'EXAMPLE#DEF',
                    DataCategory: 'ASSET#test',
                    key: 'GHI.base',
                    tag: 'Example',
                    name: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }],
                    description: [{
                        data: { tag: 'If', conditions: [{ if: 'active' }] },
                        children: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }]
                    }],
                    keyMapping: {}
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
                    tag: 'Map',
                    positions: [{ data: { tag: 'Room', key: 'room1' }, children: [] }],
                    keyMapping: { room1: 'ROOM#DEF' }
                }
            }
        ])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(3) // Only Room, Example, Map processed - Variable/Computed removed
        const testSetEdge = (itemId: string, edges: any[]) => ([{ itemId, edges, options: { direction: 'back', contextFilter: expect.any(Function) } }])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#ABC', []))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('EXAMPLE#DEF', [{ target: 'ASSET#test', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('MAP#LMNO', [{ target: 'ASSET#test', context: 'test' }, { target: 'ROOM#DEF', data: { scopedId: 'room1' }, context: 'test' }]))
    })

    it('should create internal connections from links', async () => {
        await updateDependenciesFromMergeActions('test', new GraphUpdateMock({ internalCache: internalCacheMock, dbHandler: {} }))([
            {
                key: {
                    EphemeraId: 'FEATURE#Base',
                    DataCategory: 'ASSET#test'
                },
                action: 'ignore'
            },
            {
                key: {
                    EphemeraId: 'EXAMPLE#BaseEx',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'EXAMPLE#BaseEx',
                    DataCategory: 'ASSET#test',
                    key: 'Base.base',
                    tag: 'Example',
                    name: [{ tag: 'String', value: 'Feature Base Test' }],
                    keyMapping: {}
                }
            },
            {
                key: {
                    EphemeraId: 'FEATURE#ABC',
                    DataCategory: 'ASSET#test'
                },
                action: 'ignore'
            },
            {
                key: {
                    EphemeraId: 'EXAMPLE#DEF',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'EXAMPLE#DEF',
                    DataCategory: 'ASSET#test',
                    key: 'ABC.base',
                    tag: 'Example',
                    name: [{ data: { tag: 'String', value: 'Feature Test' }, children: [] }],
                    description: [{ data: { tag: 'Link', to: 'Base', text: 'Forward' }, children: [] }],
                    keyMapping: { Base: 'FEATURE#Base' }
                }
            },
            {
                key: {
                    EphemeraId: 'ROOM#GHI',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'ROOM#GHI',
                    DataCategory: 'ASSET#test',
                    key: 'GHI',
                    tag: 'Room',
                    exits: [{ tag: 'Exit', from: 'GHI', to: 'MNO', key: 'GHI#MNO' }],
                    // stateMapping removed - Variable/Computed functionality no longer exists
                    keyMapping: { MNO: 'ROOM#MNO' }
                },
            },
            {
                key: {
                    EphemeraId: 'EXAMPLE#JKL',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'EXAMPLE#JKL',
                    DataCategory: 'ASSET#test',
                    key: 'GHI.base',
                    tag: 'Example',
                    name: [{ data: { tag: 'String', value: 'VORTEX' }, children: [] }],
                    description: [{ data: { tag: 'String', value: 'Description with ' }, children: [] }, { data: { tag: 'Link', to: 'ABC', text: 'link' }, children: [] }],
                    // stateMapping removed - Variable/Computed functionality no longer exists
                    keyMapping: { ABC: 'FEATURE#ABC' }
                }
            },
            {
                key: {
                    EphemeraId: 'ROOM#MNO',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'ROOM#MNO',
                    DataCategory: 'ASSET#test',
                    key: 'MNO',
                    tag: 'Room',
                    exits: [{ tag: 'Exit', from: 'MNO', to: 'GHI', key: 'MNO#GHI' }],
                    stateMapping: {},
                    keyMapping: { GHI: 'ROOM#GHI' }
                }
            }
        ])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(5)
        const testSetEdge = (itemId: string, edges: any[]) => ([{ itemId, edges, options: { direction: 'back', contextFilter: expect.any(Function) } }])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('EXAMPLE#BaseEx', [{ target: 'ASSET#test', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('EXAMPLE#DEF', [{ target: 'ASSET#test', data: { scopedId: 'ABC.base' }, context: 'test' }, { target: 'FEATURE#Base', context: 'test', data: { scopedId: 'Base' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#GHI', [{ target: 'ASSET#test', data: { scopedId: 'GHI' }, context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('EXAMPLE#JKL', [{ target: 'ASSET#test', data: { scopedId: 'GHI.base' }, context: 'test' }, { target: 'FEATURE#ABC', context: 'test', data: { scopedId: 'ABC' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#MNO', [{ target: 'ASSET#test', data: { scopedId: 'MNO' }, context: 'test' }]))
    })
})