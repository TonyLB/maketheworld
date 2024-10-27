jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update/index'

import { updateDependenciesFromMergeActions } from './dependencyUpdate'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<typeof internalCacheMock._graphCache, string>>

describe('dependencyUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
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
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test',
                    key: 'ABC',
                    tag: 'Room',
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Vortex' }, children: [] }] },
                    description: {
                        data: { tag: 'Description' },
                        children: [{
                            data: { tag: 'If', conditions: [{ if: 'active' }] },
                            children: [{ data: { tag: 'String', value: 'The lights are on ' }, children: [] }]
                        }]
                    },
                    exits: [],
                    themes: [],
                    stateMapping: { active: 'COMPUTED#XYZ' },
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
                    stateMapping: {},
                    keyMapping: { room1: 'ROOM#DEF' }
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
                    tag: 'Knowledge',
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Knowledge is power' }, children: [] }] },
                    render: [{ data: { tag: 'String', value: 'There is so much to learn!' }, children: [] }],
                    stateMapping: {},
                    keyMapping: {}
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
                    tag: 'Variable',
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
                    tag: 'Variable',
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
                    tag: 'Computed',
                    src: 'powered && switchedOn',
                    // dependencies: [
                    //     { key: 'switchedOn', EphemeraId: 'VARIABLE#TUV' },
                    //     { key: 'powered', EphemeraId: 'VARIABLE#QRS' }
                    // ],
                    stateMapping: {
                        switchedOn: 'VARIABLE#TUV',
                        powered: 'VARIABLE#QRS'
                    }
                }
            }
        ])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(7)
        const testSetEdge = (itemId: string, edges: any[]) => ([{ itemId, edges, options: { direction: 'back', contextFilter: expect.any(Function) } }])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#ABC', []))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#DEF', [{ target: 'ASSET#test', context: 'test', data: { scopedId: 'ABC' } }, { target: 'COMPUTED#XYZ', context: 'test', data: { scopedId: 'active' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('MAP#LMNO', [{ target: 'ASSET#test', context: 'test' }, { target: 'ROOM#DEF', data: { scopedId: 'room1' }, context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('KNOWLEDGE#GHI', [{ target: 'ASSET#test', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('VARIABLE#QRS', [{ target: 'ASSET#test', context: 'test', data: { scopedId: 'powered' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('VARIABLE#TUV', [{ target: 'ASSET#test', context: 'test', data: { scopedId: 'switchedOn' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('COMPUTED#XYZ', [
            { target: 'ASSET#test', context: 'test', data: { scopedId: 'active' } },
            { target: 'VARIABLE#TUV', context: 'test', data: { scopedId: 'switchedOn' } },
            { target: 'VARIABLE#QRS', context: 'test', data: { scopedId: 'powered' } }
        ]))
    })

    it('should create internal connections from links', async () => {
        await updateDependenciesFromMergeActions('test', new GraphUpdateMock({ internalCache: internalCacheMock, dbHandler: {} }))([
            {
                key: {
                    EphemeraId: 'FEATURE#Base',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'FEATURE#Base',
                    DataCategory: 'ASSET#test',
                    key: 'Base',
                    tag: 'Feature',
                    name: { data: { tag: 'Name' }, children: [{ tag: 'String', value: 'Feature Base Test' }] },
                    stateMapping: {},
                    keyMapping: {}
                }
            },
            {
                key: {
                    EphemeraId: 'FEATURE#ABC',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'FEATURE#ABC',
                    DataCategory: 'ASSET#test',
                    key: 'ABC',
                    tag: 'Feature',
                    name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Feature Test' }, children: [] }] },
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'Link', to: 'Base', text: 'Forward' }, children: [] }] },
                    stateMapping: {},
                    keyMapping: { Base: 'FEATURE#Base' }
                }
            },
            {
                key: {
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test'
                },
                action: {
                    EphemeraId: 'ROOM#DEF',
                    DataCategory: 'ASSET#test',
                    key: 'DEF',
                    tag: 'Room',
                    exits: [{ tag: 'Exit', from: 'DEF', to: 'GHI', key: 'DEF#GHI' }],
                    name: { data: { tag: 'Name' }, children: [{ tag: 'String', value: 'Vortex' }] },
                    description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description with ' }, children: [] }, { data: { tag: 'Link', to: 'ABC', text: 'link' }, children: [] }] },
                    stateMapping: {},
                    keyMapping: { ABC: 'FEATURE#ABC', GHI: 'ROOM#GHI' }
                },
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
                    exits: [{ tag: 'Exit', from: 'GHI', to: 'DEF', key: 'GHI#DEF' }],
                    stateMapping: {},
                    keyMapping: { DEF: 'ROOM#DEF' }
                }
            }
        ])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(4)
        const testSetEdge = (itemId: string, edges: any[]) => ([{ itemId, edges, options: { direction: 'back', contextFilter: expect.any(Function) } }])
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('FEATURE#Base', [{ target: 'ASSET#test', context: 'test' }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('FEATURE#ABC', [{ target: 'ASSET#test', context: 'test' }, { target: 'FEATURE#Base', context: 'test', data: { scopedId: 'Base' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#DEF', [{ target: 'ASSET#test', context: 'test', data: { scopedId: 'DEF' } }, { target: 'FEATURE#ABC', context: 'test', data: { scopedId: 'ABC' } }]))
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith(testSetEdge('ROOM#GHI', [{ target: 'ASSET#test', context: 'test', data: { scopedId: 'GHI' } }]))
    })
})