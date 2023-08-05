import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { assetDB, mergeIntoDataRange } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../internalCache', () => ({
    PlayerLibrary: {
        set: jest.fn().mockResolvedValue({})
    },
    Library: {
        set: jest.fn().mockResolvedValue({})
    }
}))

import { dbRegister } from './dbRegister'

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should put a single element for a Character file', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library',
            },
            namespaceIdToDB: { TESS: 'CHARACTER#12345' },
            status: {
                json: 'Clean'
            },
            properties: {
                TESSIcon: { fileName: 'IMAGE-123' }
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
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save meta, rooms for Asset type', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {
                Welcome: 'ROOM#12345'
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
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save meta, rooms for Story type', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {
                Welcome: 'ROOM#12345'
            },
            normal: {
                TEST: {
                    tag: 'Asset',
                    Story: true,
                    key: 'TEST',
                    name: 'Test',
                    zone: 'Library',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'Room',
                            key: 'Welcome',
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
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                },
                power: {
                    tag: 'Variable',
                    key: 'power',
                    default: true,
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                },
                togglePower: {
                    tag: 'Action',
                    key: 'togglePower',
                    src: 'power = !power',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save meta only for instanced Story type', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {
                Welcome: 'ROOM#12345'
            },
            normal: {
                TEST: {
                    tag: 'Asset',
                    Story: true,
                    instance: true,
                    key: 'TEST',
                    name: 'Test',
                    zone: 'Library',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'Room',
                            key: 'Welcome',
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
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                },
                power: {
                    tag: 'Variable',
                    key: 'power',
                    default: true,
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                },
                togglePower: {
                    tag: 'Action',
                    key: 'togglePower',
                    src: 'power = !power',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })

    //
    // Tests to confirm correct saving of default appearance on Room and Feature Asset records
    //

    it('should save correct default appearance for Rooms and Features', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {
                Welcome: 'ROOM#12345'
            },
            normal: {
                TEST: {
                    tag: 'Asset',
                    key: 'TEST',
                    name: 'Test',
                    zone: 'Library',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'If',
                            key: 'If-0',
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
                        }]
                    }]
                },
                ['If-0']: {
                    tag: 'If',
                    key: 'If-0',
                    if: 'false',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [{
                            tag: 'Room',
                            key: 'Welcome',
                            index: 1
                        },
                        {
                            tag: 'Feature',
                            key: 'clockTower',
                            index: 1
                        }]
                    }]
                },
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                        render: ['Test render!', { tag: 'Link', to: 'clockTower', text: '(clock tower)'}],
                        name: [{ tag: 'String', value: 'Test' }]
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }],
                        contents: [],
                        render: ['Should not render'],
                        name: [{ tag: 'String', value: 'Should not' }]
                    }]
                },
                clockTower: {
                    tag: 'Feature',
                    key: 'clockTower',
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        name: [{ tag: 'String', value: 'TestFeature' }],
                        render: ['Test feature render']
                    },
                    {
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }],
                        render: ['Should not render'],
                        name: [{ tag: 'String', value: 'Should not' }]
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save exits in default appearance for Rooms', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {
                Welcome: 'ROOM#12345'
            },
            normal: {
                TEST: {
                    tag: 'Asset',
                    key: 'TEST',
                    name: 'Test',
                    zone: 'Library',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'If',
                            key: 'If-0',
                            index: 0
                        },
                        {
                            tag: 'Room',
                            key: 'Welcome',
                            index: 0
                        },
                        {
                            tag: 'Room',
                            key: 'Entry',
                            index: 0
                        }]
                    }]
                },
                ['If-0']: {
                    tag: 'If',
                    key: 'If-0',
                    if: 'false',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [{
                            tag: 'Room',
                            key: 'Welcome',
                            index: 1
                        }]
                    }]
                },
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [],
                        render: ['Test render!'],
                        name: [{ tag: 'String', value: 'Test' }]
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'If-0', tag: 'If', index: 0 }],
                        contents: [],
                        render: ['Should not render'],
                        name: [{ tag: 'String', value: 'Should not' }],
                        contents: [{
                            tag: 'Exit',
                            key: 'Welcome#Entry',
                            index: 0
                        }]
                    }]
                },
                Entry: {
                    tag: 'Room',
                    key: 'Entry',
                    appearances: [{
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }],
                        contents: [{
                            tag: 'Exit',
                            key: 'Entry#Welcome',
                            index: 0
                        }],
                        render: ['Entry render!'],
                        name: [{ tag: 'String', value: 'Entry' }]
                    }]
                },
                ['Entry#Welcome']: {
                    tag: 'Exit',
                    key: 'Entry#Welcome',
                    from: 'Entry',
                    to: 'Welcome',
                    name: 'welcome',
                    appearances: [{
                        contextStack: [
                            { key: 'TEST', tag: 'Asset', index: 0 },
                            { key: 'Entry', tag: 'Room', index: 0 },
                        ],
                        contents: []
                    }]
                },
                ['Welcome#Entry']: {
                    tag: 'Exit',
                    key: 'Welcome#Entry',
                    from: 'Welcome',
                    to: 'Entry',
                    name: 'entry',
                    appearances: [{
                        contextStack: [
                            { key: 'TEST', tag: 'Asset', index: 0 },
                            { key: 'If-0', tag: 'If', index: 0 },
                            { key: 'Welcome', tag: 'Room', index: 0 },
                        ],
                        contents: []
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should save primitive elements in global keys', async () => {
        await dbRegister({
            address: {
                fileName: 'primitives',
                zone: 'Canon'
            },
            status: {
                json: 'Clean'
            },
            namespaceIdToDB: {},
            normal: {
                TEST: {
                    tag: 'Asset',
                    key: 'primitives',
                    name: 'primitives',
                    zone: 'Canon',
                    appearances: [{
                        contextStack: [],
                        contents: [{
                            tag: 'Room',
                            key: 'VORTEX',
                            index: 0
                        }]
                    }]
                },
                VORTEX: {
                    tag: 'Room',
                    key: 'VORTEX',
                    appearances: [{
                        contextStack: [{ key: 'primitives', tag: 'Asset', index: 0 }],
                        contents: [],
                        render: [],
                        name: []
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(assetDB.merge.mock.calls[0][0]).toMatchSnapshot()
    })
})