import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('@tonylb/mtw-utilities/dist/graphStorage/update', () => {
    return jest.fn().mockImplementation(() => {
        return {
            setEdges: mockSetEdges,
            flush: jest.fn()
        }
    })
})
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'

jest.mock('../clients')
import { snsClient } from '../clients'

import { dbRegister } from './dbRegister'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const mockSetEdges = jest.fn()

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        mockSetEdges.mockClear()
    })
    it('should put a single element for a Character file', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library',
            },
            namespaceIdToDB: [{ internalKey: 'TESS', universalKey: 'CHARACTER#12345' }],
            universalKey: jest.fn().mockImplementation((key) => (key === 'TESS' ? 'CHARACTER#12345' : undefined )),
            status: {
                json: 'Clean'
            },
            properties: {
                TESSIcon: { fileName: 'IMAGE-123' }
            },
            standard: {
                key: 'TESS',
                tag: 'Character',
                byId: {
                    TESS: {
                        key: 'TESS',
                        tag: 'Character',
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
                        pronouns: {
                            subject: 'she',
                            object: 'her',
                            possessive: 'her',
                            adjective: 'hers',
                            reflexive: 'herself'
                        },
                        firstImpression: { data: { tag: 'FirstImpression', value: 'Frumpy Goth' }, children: [] },
                        oneCoolThing: { data: { tag: 'OneCoolThing', value: 'Fuchsia eyes' }, children: [] },
                        outfit: { data: { tag: 'Outfit', value: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.' }, children: [] },
                        image: { data: { tag: 'Image', key: 'TESSIcon' }, children: [] }
                    },
                    TESSIcon: {
                        tag: 'Image',
                        key: 'TESSIcon'
                    }
                },
                metaData: [
                    { data: { tag: 'Import', from: 'primitives' }, children: [] }
                ]
            },
            normal: {
                TESS: {
                    tag: 'Character',
                    key: 'TESS',
                    Name: 'Tess',
                    fileURL: 'testIcon.png',
                    Pronouns: {
                        subject: 'she',
                        object: 'her',
                        possessive: 'her',
                        adjective: 'hers',
                        reflexive: 'herself'
                    },
                    FirstImpression: 'Frumpy Goth',
                    OneCoolThing: 'Fuchsia eyes',
                    Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
                    images: ['TESSIcon']
                },
                TESSIcon: {
                    tag: 'Image',
                    key: 'TESSIcon'
                },
                'Import-0': {
                    tag: 'Import',
                    key: 'Import-0',
                    appearances: [{
                        contextStack: [{ key: 'TESS', tag: 'Character', index: 0 }],
                        contents: []
                    }],
                    from: 'primitives',
                }
            }
        } as any)
        expect(assetDBMock.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(mockSetEdges).toHaveBeenCalledTimes(1)
        expect(mockSetEdges).toHaveBeenCalledWith([{
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
            standard: {
                key: 'TEST',
                tag: 'Asset',
                byId: {
                    Village: {
                        tag: 'Map',
                        key: 'Village',
                        name: { data: { tag: 'Name' }, children: [] },
                        positions: [{ data: { tag: 'Room', key: 'Welcome' }, children: [{ data: { tag: 'Position', x:0, y:100 }, children: [] }]}],
                    },
                    Welcome: {
                        tag: 'Room',
                        key: 'Welcome',
                        shortName: [{ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Welcome' } }]}],
                        name: [{ data: { tag: 'Name' }, children: [] }],
                        summary: [{ data: { tag: 'Summary' }, children: [] }],
                        description: [{ data: { tag: 'Description' }, children: [] }],
                        exits: []
                    },
                    clockTower: {
                        tag: 'Feature',
                        key: 'clockTower',
                        name: [{ data: { tag: 'Name' }, children: [] }],
                        description: [{ data: { tag: 'Description' }, children: [] }]
                    },
                    power: {
                        tag: 'Variable',
                        key: 'power',
                        default: true
                    },
                    togglePower: {
                        tag: 'Action',
                        key: 'togglePower',
                        src: 'power = !power'
                    }
                },
                metaData: []
            },
            normal: {
                TEST: {
                    tag: 'Asset',
                    key: 'TEST',
                    name: 'Test',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'Map',
                            key: 'Village',
                            index: 0
                        },
                        {
                            tag: 'Room',
                            key: 'Welcome',
                            index: 0
                        },
                        {
                            tag: 'Feature',
                            key: 'clockTower',
                            index: 0
                        },
                        {
                            tag: 'Variable',
                            key: 'power',
                            index: 0
                        },
                        {
                            tag: 'Action',
                            key: 'togglePower',
                            index: 0
                        }]
                    }]
                },
                Village: {
                    tag: 'Map',
                    key: 'Village',
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        rooms: [
                            { key: 'Welcome', x: 0, y: 100 }
                        ]
                    }]
                },
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        name: [{ tag: 'String', value: 'Welcome' }],
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        contents: []
                    }]
                },
                clockTower: {
                    tag: 'Feature',
                    key: 'clockTower',
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        contents: []
                    }]
                },
                power: {
                    tag: 'Variable',
                    key: 'power',
                    default: true,
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        contents: []
                    }]
                },
                togglePower: {
                    tag: 'Action',
                    key: 'togglePower',
                    src: 'power = !power',
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        contents: []
                    }]
                }
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
            standard: {
                key: 'test',
                tag: 'Asset',
                byId: {
                    VORTEX: {
                        key: 'VORTEX',
                        tag: 'Room',
                        shortName: [{ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Welcome' } }]}],
                        name: [{ data: { tag: 'Name' }, children: [] }],
                        summary: [{ data: { tag: 'Summary' }, children: [] }],
                        description: [{ data: { tag: 'Description' }, children: [] }],
                        exits: []
                    }
                },
                metaData: [
                    { data: { tag: 'Import', from: 'primitives' }, children: [{ data: { tag: 'Room', key: 'VORTEX' }, children: [] }] }
                ]
            },
            normal: {
                test: {
                    tag: 'Asset',
                    key: 'test',
                    name: 'test',
                    zone: 'Library',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'Import',
                            key: 'Import-0',
                            index: 0
                        },
                        {
                            tag: 'Room',
                            key: 'VORTEX',
                            index: 1
                        }]
                    }]
                },
                'Import-0': {
                    tag: 'Import',
                    key: 'Import-0',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                        contents: [{
                            key: 'VORTEX',
                            tag: 'Room',
                            index: 0
                        }]
                    }],
                    from: 'primitives',
                    mapping: { VORTEX: { key: 'VORTEX', type: 'Room' } }
                },
                VORTEX: {
                    tag: 'Room',
                    key: 'VORTEX',
                    appearances: [{
                        contextStack: [
                            { key: 'test', tag: 'Asset', index: 0 },
                            { key: 'Import-0', tag: 'Import', index: 0 }
                        ],
                        contents: [],
                        render: [],
                        name: []
                    },
                    {
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                        contents: [],
                        render: [],
                        name: []
                    }]
                }
            }
        } as any)
        expect(mockSetEdges).toHaveBeenCalledTimes(1)
        expect(mockSetEdges).toHaveBeenCalledWith([{
            itemId: 'ASSET#test',
            edges: [{ target: 'ASSET#primitives', context: '' }],
            options: { direction: 'back' }
        }])
    })

})