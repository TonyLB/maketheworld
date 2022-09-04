import { jest, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB,
    assetDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('./initializeRooms.js')
import initializeRooms from './initializeRooms.js'
jest.mock('./mergeEntries.js')
import mergeEntries from './mergeEntries.js'
jest.mock('@tonylb/mtw-utilities/dist/executeCode/recalculateComputes')
import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes'
jest.mock('@tonylb/mtw-utilities/dist/computation/sandbox')
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox'
jest.mock('@tonylb/mtw-utilities/dist/perception/assetRender')
import assetRender from '@tonylb/mtw-utilities/dist/perception/assetRender'

import { cacheAssetMessage } from '.'
import { MessageBus } from '../messageBus/baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const evaluateCodeMock = evaluateCode as jest.Mock

xdescribe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should skip processing when check option and already present', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: { check: true }
            }],
            messageBus: messageBusMock
        })

        expect(initializeRooms).toHaveBeenCalledTimes(0)
        expect(mergeEntries).toHaveBeenCalledTimes(0)
        expect(recalculateComputes).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(0)
    })

    it('should skip processing when asset is an instanced story', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            EphemeraId: 'ASSET#Test'
        })
        assetDB.getItem
            .mockResolvedValueOnce({
                fileName: 'test',
                importTree: { BASE: {} },
                instance: true
            })
        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
    
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
        evaluateCodeMock.mockReturnValue(mockEvaluate)

        assetDB.getItem
            .mockResolvedValueOnce({
                fileName: 'test',
                importTree: { BASE: {} }
            })
        ephemeraDBMock.getItem
            .mockResolvedValueOnce({ State: {} })
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
        assetRender.mockResolvedValue({ foo: 'bar' })

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: {}
            }],
            messageBus: messageBusMock
        })
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
        const expectedState = {
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
        }
        expect(assetRender).toHaveBeenCalledWith({
            assetId: 'test',
            existingNormalFormsByAsset: { test: testAsset },
            existingStatesByAsset: { test: expectedState }
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#test",
            DataCategory: "Meta::Asset",
            Actions: {
                toggleSwitch: {
                    src: 'switchedOn = !switchedOn'
                }
            },
            State: expectedState,
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
            mapCache: { foo: 'bar' },
            importTree: {
                BASE: {}
            }
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#test',
            DataCategory: 'Meta::AssetNormalized',
            normalForm: testAsset
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
        ephemeraDBMock.getItem
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ State: {} })
        ephemeraDBMock.batchGetItem
            .mockResolvedValueOnce([{
                EphemeraId: 'ASSET#BASE',
                State: {
                    powered: {
                        value: 'On'
                    }
                },
                Dependencies: {}
            }])
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
            
        recalculateComputes.mockReturnValue({ state: {} })

        await cacheAssetMessage({
            payloads: [{
                type: 'CacheAsset',
                address: { fileName: 'Test', zone: 'Library' },
                options: { recursive: true }
            }],
            messageBus: messageBusMock
        })
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
            mapCache: {},
            importTree: { BASE: {} }
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: "ASSET#BASE",
            DataCategory: "Meta::Asset",
            Actions: {},
            State: {},
            Dependencies: {},
            mapCache: {},
            importTree: {}
        })
    })

})