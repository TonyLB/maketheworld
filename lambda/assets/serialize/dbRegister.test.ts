import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../internalCache', () => ({
    PlayerLibrary: {
        set: jest.fn()
    },
    Library: {
        set: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update/index')
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update/index'

import { dbRegister } from './dbRegister'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const GraphUpdateMock = GraphUpdate as jest.Mock<GraphUpdate<any, string>>

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        GraphUpdateMock.mockClear()
    })
    it('should put a single element for a Character file', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library',
            },
            namespaceIdToDB: [
                { internalKey: 'TESS', universalKey: 'CHARACTER#12345' }
            ],
            universalKey: jest.fn().mockImplementation((key) => (key === 'TESS' ? 'CHARACTER#12345' : undefined )),
            status: {
                json: 'Clean'
            },
            properties: {
                TESSIcon: { fileName: 'IMAGE-123' }
            },
            standard: {
                tag: 'Character',
                key: 'TESS',
                byId: {
                    TESS: {
                        tag: 'Character',
                        key: 'TESS',
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
                        pronouns: {
                            data: {
                                tag: 'Pronouns',
                                subject: 'she',
                                object: 'her',
                                possessive: 'her',
                                adjective: 'hers',
                                reflexive: 'herself'
                            },
                            children: []
                        },
                        image: { data: { tag: 'Image', key: 'TESSIcon' }, children: [] }
                    }
                },
                metaData: [{ data: { tag: 'Import', from: 'primitives' }, children: [] }]
            }
        } as any)
        expect(assetDBMock.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(1)
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'CHARACTER#TESS',
            edges: [{ target: 'ASSET#primitives', context: '' }],
            options: { direction: 'back' }
        }])
    })

    it('should save meta for Asset type', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: [
                { internalKey: 'Welcome', universalKey: 'ROOM#12345' }
            ],
            universalKey: jest.fn().mockImplementation((key) => (key === 'Welcome' ? 'ROOM#12345' : undefined )),
            standard: {
                tag: 'Asset',
                key: 'TEST',
                byId: {
                    Village: {
                        tag: 'Map',
                        key: 'Village',
                        name: { data: { tag: 'Name' }, children: [] },
                        rooms: [
                            { data: { tag: 'Room', key: 'Welcome' }, children: [{ data: { tag: 'Position', x: 0, y: 100 }, children: [] }]}
                        ]
                    },
                    Welcome: {
                        tag: 'Room',
                        key: 'Welcome',
                        name: { data: { tag: 'Name' }, children: [{ tag: 'String', value: 'Welcome' }] },
                        shortName: { data: { tag: 'ShortName' }, children: [] },
                        summary: { data: { tag: 'Summary' }, children: [] },
                        description: { data: { tag: 'Description' }, children:[] },
                        exits: [],
                        themes: []
                    },
                    clockTower: {
                        tag: 'Feature',
                        key: 'clockTower',
                        name: { data: { tag: 'Name' }, children: [] },
                        description: { data: { tag: 'Description' }, children:[] }
                    },
                    power: {
                        tag: 'Variable',
                        key: 'power',
                        default: 'true'
                    },
                    togglePower: {
                        tag: 'Action',
                        key: 'togglePower',
                        src: 'power = !power'
                    }
                },
                metaData: []
            }
        } as any)
        expect(assetDBMock.putItem.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save asset graph edges when asset has imports', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: [],
            universalKey: jest.fn().mockReturnValue(undefined),
            standard: {
                tag: 'Asset',
                key: 'test',
                byId: {
                    VORTEX: {
                        tag: 'Room',
                        key: 'VORTEX',
                        name: { data: { tag: 'Name' }, children: [] },
                        shortName: { data: { tag: 'ShortName' }, children: [] },
                        summary: { data: { tag: 'Summary' }, children: [] },
                        description: { data: { tag: 'Description' }, children:[] },
                        exits: [],
                        themes: []
                    }
                },
                metaData: [{ data: { tag: 'Import', from: 'primitives' }, children: [{ data: { tag: 'Room', key: 'VORTEX' }, children: [] }]}]
            }
        } as any)
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledTimes(1)
        expect(GraphUpdateMock.mock.instances[0].setEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#primitives', context: '' }],
            options: { direction: 'back' }
        }])
    })

})