import { jest, describe, it, expect } from '@jest/globals'

import { assetDB, mergeIntoDataRange } from '/opt/utilities/dynamoDB/index.js'

import { dbRegister } from './dbRegister.js'

describe('dbRegister', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should put a single element for a Character file', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: { TESS: '12345' },
            assets: {
                TESS: {
                    tag: 'Character',
                    key: 'TESS',
                    zone: 'Library',
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
                    player: 'TEST'
                }
            }
        })
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'CHARACTER#12345',
            DataCategory: 'Meta::Character',
            zone: 'Library',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopedId: 'TESS',
            player: 'TEST',
            fileURL: 'testIcon.png',
            Name: 'Tess',
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
        })
    })

    it('should save meta, rooms for Asset type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: {
                TEST: {
                    tag: 'Asset',
                    key: 'TEST',
                    name: 'Test',
                    zone: 'Library',
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
                        contents: []
                    }]
                },
                Welcome: {
                    tag: 'Room',
                    key: 'Welcome',
                    appearances: [{
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
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [{
                tag: 'Map',
                key: 'Village'
            },
            {
                tag: 'Room',
                key: 'Welcome',
                defaultAppearances: []
            },
            {
                tag: 'Feature',
                key: 'clockTower',
                defaultAppearances: []
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    it('should save meta, rooms for Story type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: {
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
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            Story: true,
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [{
                tag: 'Room',
                key: 'Welcome',
                defaultAppearances: []
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    it('should save meta only for instanced Story type', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: {
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
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            Story: true,
            instance: true,
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })

    //
    // Tests to confirm correct saving of default appearance on Room and Feature Asset records
    //

    it('should save correct default appearance for Rooms and Features', async () => {
        await dbRegister({
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            scopeMap: {
                Welcome: '12345',
                power: 'ABC',
                togglePower: 'DEF'
            },
            assets: {
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
        expect(assetDB.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#TEST',
            DataCategory: 'Meta::Asset',
            fileName: 'test.wml',
            translateFile: 'test.translate.json',
            name: 'Test',
            zone: 'Library'
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'assets',
            search: { DataCategory: 'ASSET#TEST' },
            items: [{
                tag: 'Room',
                key: 'Welcome',
                defaultAppearances: [{
                    render: [
                        'Test render!',
                        {
                            tag: 'Link',
                            to: 'clockTower',
                            text: '(clock tower)',
                            targetTag: 'Feature'
                        }
                    ],
                    name: 'Test',
                    contents: []
                }]
            },
            {
                tag: 'Feature',
                key: 'clockTower',
                defaultAppearances: [{
                    name: 'TestFeature',
                    render: ['Test feature render']
                }]
            }],
            mergeFunction: expect.any(Function),
            extractKey: expect.any(Function)
        })
    })
})