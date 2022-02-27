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
jest.mock('./mergeEntries.js')
import mergeEntries from './mergeEntries.js'
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
        expect(mergeEntries).toHaveBeenCalledTimes(0)
        expect(recalculateComputes).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should skip processing when asset is an instanced story', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        assetDB.getItem
            .mockResolvedValueOnce({
                fileName: 'test',
                importTree: { BASE: {} },
                instance: true
            })
        await cacheAsset('Test')

        expect(parseWMLFile).toHaveBeenCalledTimes(0)
        expect(globalizeDBEntries).toHaveBeenCalledTimes(0)
        expect(initializeRooms).toHaveBeenCalledTimes(0)
        expect(mergeEntries).toHaveBeenCalledTimes(0)
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
        const testAsset = {
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
        }
        globalizeDBEntries.mockResolvedValue(testAsset)
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

        await cacheAsset('test')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('test', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith(['ROOM#DEF'])
        expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
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
            EphemeraId: "ASSET#test",
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
        const testAsset = {
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
        }
        globalizeDBEntries.mockResolvedValue(testAsset)
        recalculateComputes.mockReturnValue({ state: {
            power: {
                imported: true,
                asset: 'BASE',
                key: 'powered',
                value: 'On'
            }
        } })

        await cacheAsset('test')
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('test', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
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
            EphemeraId: "ASSET#test",
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
                            asset: 'test',
                            key: 'power'
                        }]
                    }
                }
            }
        })
    })

    it('should recursively cache when recursive option set true', async () => {
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
        const testAsset = {
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
        }
        const baseAsset = {
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
        }
        globalizeDBEntries
            .mockResolvedValueOnce(baseAsset)
            .mockResolvedValueOnce(testAsset)
            
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('test', { recursive: true })
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('test', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
        expect(mergeEntries).toHaveBeenCalledWith('BASE', baseAsset)
        expect(recalculateComputes).toHaveBeenCalledWith(
            {},
            {},
            []
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
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

    it('recursive cache should not reload present assets', async () => {
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
            .mockResolvedValueOnce({ EphemeraId: 'ASSET#BASE' })
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
        const testAsset = {
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
        }
        globalizeDBEntries
            .mockResolvedValueOnce(testAsset)
            
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('test', { recursive: true })
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('test', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeEntries).toHaveBeenCalledTimes(1)
        expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
        expect(recalculateComputes).toHaveBeenCalledWith(
            {},
            {},
            []
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            Actions: {},
            State: {},
            Dependencies: {},
            importTree: { BASE: {} }
        })
    })

    it('should recursively cache all when forceCache option set true', async () => {
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
        const testAsset = {
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
        }
        const baseAsset = {
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
        }
        globalizeDBEntries
            .mockResolvedValueOnce(baseAsset)
            .mockResolvedValueOnce(testAsset)
            
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAsset('test', { recursive: true, forceCache: true })
        expect(parseWMLFile).toHaveBeenCalledWith('test')
        expect(globalizeDBEntries).toHaveBeenCalledWith('test', ['Test'])
        expect(initializeRooms).toHaveBeenCalledWith([])
        //
        // TODO:  Figure out whether there's something important to store when a room
        // is imported but not altered ... can the import just be a straight include?
        //
        expect(mergeEntries).toHaveBeenCalledWith('test', testAsset)
        expect(mergeEntries).toHaveBeenCalledWith('BASE', baseAsset)
        expect(recalculateComputes).toHaveBeenCalledWith(
            {},
            {},
            []
        )
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
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
        expect(ephemeraDB.getItem).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#test',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        })
    })
})