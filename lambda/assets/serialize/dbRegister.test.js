import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { assetDB, mergeIntoDataRange } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import { dbRegister } from './dbRegister'

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    xit('should put a single element for a Character file', async () => {
        await dbRegister({
            address: {
                fileName: 'test',
                zone: 'Library',
            },
            namespaceIdToDB: { TESS: 'CHARACTER#12345' },
            status: {
                json: 'Clean'
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
                    Outfit: 'A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.'
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
                        rooms: {
                            Welcome: { x: 0, y: 100 }
                        }
                    }]
                },
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
                        name: 'Welcome',
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
        expect(mergeIntoDataRange.mock.calls[0][0]).toMatchSnapshot()
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
        expect(mergeIntoDataRange.mock.calls[0][0]).toMatchSnapshot()
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
        expect(mergeIntoDataRange.mock.calls[0][0]).toMatchSnapshot()
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
                            tag: 'Condition',
                            key: 'Condition-0',
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
                ['Condition-0']: {
                    tag: 'Condition',
                    key: 'Condition-0',
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
                        name: 'Test'
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        contents: [],
                        render: ['Should not render'],
                        name: 'Should not'
                    }]
                },
                clockTower: {
                    tag: 'Feature',
                    key: 'clockTower',
                    appearances: [{
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                        name: 'TestFeature',
                        render: ['Test feature render']
                    },
                    {
                        contextStack: [{ tag: 'Asset', key: 'TEST', index: 0 }],
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        render: ['Should not render'],
                        name: 'Should not'
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(mergeIntoDataRange.mock.calls[0][0]).toMatchSnapshot()
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
                            tag: 'Condition',
                            key: 'Condition-0',
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
                ['Condition-0']: {
                    tag: 'Condition',
                    key: 'Condition-0',
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
                        name: 'Test'
                    },
                    {
                        contextStack: [{ key: 'TEST', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        contents: [],
                        render: ['Should not render'],
                        name: 'Should not',
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
                        name: 'Entry'
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
                            { key: 'Condition-0', tag: 'Condition', index: 0 },
                            { key: 'Welcome', tag: 'Room', index: 0 },
                        ],
                        contents: []
                    }]
                }
            }
        })
        expect(assetDB.putItem.mock.calls[0][0]).toMatchSnapshot()
        expect(mergeIntoDataRange.mock.calls[0][0]).toMatchSnapshot()
    })
})