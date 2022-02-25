import { jest, expect } from '@jest/globals'

import {
    ephemeraDB,
    assetDB
} from '/opt/utilities/dynamoDB/index.js'

jest.mock('./parseWMLFile.js')
import parseWMLFile from './parseWMLFile.js'
jest.mock('./globalize.js')
import globalizeDBEntries from './globalize.js'
jest.mock('./initializeRooms.js')
import initializeRooms from './initializeRooms.js'
import { mergeIntoDataRange } from '/opt/utilities/dynamoDB/index.js'
import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'

import { cacheAsset } from './index.js'

describe('cacheAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should skip processing when check option and already present', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        await cacheAsset('Test', { check: true })

        expect(parseWMLFile).toHaveBeenCalledTimes(0)
        expect(globalizeDBEntries).toHaveBeenCalledTimes(0)
        expect(initializeRooms).toHaveBeenCalledTimes(0)
        expect(mergeIntoDataRange).toHaveBeenCalledTimes(0)
        expect(recalculateComputes).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should send rooms in need of update', async () => {
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCode.mockReturnValue(mockEvaluate)

        assetDB.getItem
            .mockResolvedValueOnce({
                fileName: 'test',
                importTree: { BASE: {} }
            })
        ephemeraDB.getItem
            .mockResolvedValueOnce({ State: {} })
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries.mockResolvedValue({
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'powered',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'switchedOn',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'active',
                        tag: 'Computed',
                        index: 0
                    },
                    {
                        key: 'toggleSwitch',
                        tag: 'Action',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                EphemeraId: 'ROOM#DEF',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    global: false,
                    name: 'Vortex',
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    errors: [],
                    global: false,
                    props: {},
                    render: ['The lights are on '],
                    contents: []
                }]
            },
            powered: {
                key: 'powered',
                tag: 'Variable',
                default: 'false',
                appearances: [topLevelAppearance]
            },
            switchedOn: {
                key: 'switchedOn',
                tag: 'Variable',
                default: 'true',
                appearances: [topLevelAppearance]
            },
            active: {
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                appearances: [topLevelAppearance]
            },
            toggleSwitch: {
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                appearances: [topLevelAppearance]
            },
            ['Condition-0']: {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'active',
                dependencies: ['active'],
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            }
        })
        recalculateComputes.mockReturnValue({ state: {
            active: {
                computed: true,
                key: 'active',
                src: 'powered && switchedOn',
            },
            powered: {
                value: true
            },
            switchedOn: {
                value: true
            }
        } })

        await cacheAsset('ABC')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('ABC', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith(['ROOM#DEF'])
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#ABC' },
            items: [{
                EphemeraId: 'ROOM#DEF',
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: [],
                    exits: []
                },
                {
                    conditions: [{
                        dependencies: ['active'],
                        if: 'active'
                    }],
                    render: ['The lights are on '],
                    exits: []
                }
                ]
            }],
            mergeFunction: expect.any(Function)
        })
        expect(recalculateComputes).toHaveBeenCalledWith(
            {
                active: {
                    computed: true,
                    key: 'active',
                    src: 'powered && switchedOn'
                },
                powered: {
                    value: true
                },
                switchedOn: {
                    value: true
                }
            },
            {
                active: {
                    room: ['DEF']
                },
                powered: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            },
            ['powered', 'switchedOn']
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#ABC",
            DataCategory: "Meta::Asset",
            Actions: {
                toggleSwitch: {
                    src: 'switchedOn = !switchedOn'
                }
            },
            State: {
                active: {
                    computed: true,
                    key: 'active',
                    src: 'powered && switchedOn'
                },
                powered: {
                    value: true
                },
                switchedOn: {
                    value: true
                }
            },
            Dependencies: {
                active: {
                    room: ['DEF']
                },
                powered: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            },
            importTree: {
                BASE: {}
            }
        })
    })

    it('should attach exits to correct room appearances', async () => {
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCode.mockReturnValue(mockEvaluate)

        assetDB.getItem
            .mockResolvedValueOnce({ fileName: 'test', importTree: {} })
        ephemeraDB.getItem
            .mockResolvedValueOnce({ State: {} })
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries.mockResolvedValue({
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'DEF',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                EphemeraId: 'ROOM#XABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    global: false,
                    name: 'Vortex',
                    render: [],
                    contents: [{
                        key: 'ABC#DEF',
                        tag: 'Exit',
                        index: 0
                    }]
                }]
            },
            DEF: {
                key: 'DEF',
                EphemeraId: 'ROOM#XDEF',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    global: false,
                    name: 'Welcome',
                    render: [],
                    contents: [{
                        key: 'DEF#ABC',
                        tag: 'Exit',
                        index: 0
                    }]
                }]
            },
            ['ABC#DEF']: {
                key: 'ABC#DEF',
                tag: 'Exit',
                from: 'ABC',
                to: 'DEF',
                toEphemeraId: 'XDEF',
                name: 'welcome',
                appearances: [topLevelAppearance, { key: 'ABC', tag: 'Room', index: 0 }]
            },
            ['DEF#ABC']: {
                key: 'DEF#ABC',
                tag: 'Exit',
                from: 'DEF',
                to: 'ABC',
                toEphemeraId: 'XABC',
                name: 'vortex',
                appearances: [topLevelAppearance, { key: 'DEF', tag: 'Room', index: 0 }]
            }
        })
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('ABC')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('ABC', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith(['ROOM#XABC', 'ROOM#XDEF'])
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#ABC' },
            items: [{
                EphemeraId: 'ROOM#XABC',
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: [],
                    exits: [{
                        name: 'welcome',
                        to: 'XDEF',
                    }]
                }]
            },
            {
                EphemeraId: 'ROOM#XDEF',
                key: 'DEF',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Welcome',
                    render: [],
                    exits: [{
                        name: 'vortex',
                        to: 'XABC',
                    }]
                }]
            }],
            mergeFunction: expect.any(Function)
        })
    })

    it('should fetch imported variables', async () => {
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }

        const mockEvaluate = jest.fn().mockReturnValue(true)
        evaluateCode.mockReturnValue(mockEvaluate)

        assetDB.getItem
            .mockResolvedValueOnce({ fileName: 'test', importTree: {} })
        ephemeraDB.getItem
            .mockResolvedValueOnce({ State: {} })
        ephemeraDB.batchGetItem
            .mockResolvedValueOnce([{
                EphemeraId: 'ASSET#BASE',
                State: {
                    powered: {
                        value: 'On'
                    }
                },
                Dependencies: {}
            }])
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries.mockResolvedValue({
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'Import-0',
                        tag: 'Import',
                        index: 0
                    }]
                }]
            },
            ['Import-0']: {
                key: 'Import-0',
                tag: 'Import',
                from: 'BASE',
                tag: 'Import',
                mapping: {
                    welcome: 'ABC',
                    power: 'powered'
                },
                appearances: [topLevelAppearance]
            }
        })
        recalculateComputes.mockReturnValue({ state: {
            power: {
                imported: true,
                asset: 'BASE',
                key: 'powered',
                value: 'On'
            }
        } })

        await cacheAsset('ABC')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('ABC', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#ABC' },
            items: [],
            mergeFunction: expect.any(Function)
        })
        expect(recalculateComputes).toHaveBeenCalledWith(
            {
                power: {
                    imported: true,
                    asset: 'BASE',
                    key: 'powered',
                    value: 'On'
                }
            },
            {},
            ['power']
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#ABC",
            DataCategory: "Meta::Asset",
            Actions: {},
            State: {
                power: {
                    imported: true,
                    asset: 'BASE',
                    key: 'powered',
                    value: 'On'
                }
            },
            Dependencies: {},
            importTree: {}
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET Dependencies = :dependencies',
            ExpressionAttributeValues: {
                ':dependencies': {
                    powered: {
                        imported: [{
                            asset: 'ABC',
                            key: 'power'
                        }]
                    }
                }
            }
        })
    })

    it('should recursively cache when recusive option set true', async () => {
        const topLevelAppearance = (key) => ({
            contextStack: [{ key, tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        })

        assetDB.getItem
            .mockResolvedValueOnce({ fileName: 'test', importTree: { BASE: {} } })
            .mockResolvedValueOnce({ fileName: 'BASE', importTree: {} })
        ephemeraDB.getItem
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ State: {} })
        ephemeraDB.batchGetItem
            .mockResolvedValueOnce([{
                EphemeraId: 'ASSET#BASE',
                State: {
                    powered: {
                        value: 'On'
                    }
                },
                Dependencies: {}
            }])
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries
            .mockResolvedValueOnce({
                test: {
                    key: 'test',
                    tag: 'Asset',
                    fileName: 'test',
                    appearances: [{
                        contextStack: [],
                        errors: [],
                        props: {},
                        contents: [{
                            key: 'Import-0',
                            tag: 'Import',
                            index: 0
                        }]
                    }]
                },
                ['Import-0']: {
                    key: 'Import-0',
                    tag: 'Import',
                    from: 'BASE',
                    tag: 'Import',
                    mapping: {},
                    appearances: [topLevelAppearance('test')]
                }
            })
            .mockResolvedValueOnce({
                test: {
                    key: 'BASE',
                    tag: 'Asset',
                    fileName: 'Base',
                    appearances: [{
                        contextStack: [],
                        errors: [],
                        props: {},
                        contents: []
                    }]
                }
            })
            
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('ABC', { recursive: true })
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('ABC', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#ABC' },
            items: [],
            mergeFunction: expect.any(Function)
        })
        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#BASE' },
            items: [],
            mergeFunction: expect.any(Function)
        })
        expect(recalculateComputes).toHaveBeenCalledWith(
            {},
            {},
            []
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#ABC",
            DataCategory: "Meta::Asset",
            Actions: {},
            State: {},
            Dependencies: {},
            importTree: { BASE: {} }
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#BASE",
            DataCategory: "Meta::Asset",
            Actions: {},
            State: {},
            Dependencies: {},
            importTree: {}
        })
    })
})