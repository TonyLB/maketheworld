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
import { recalculateComputes } from '/opt/utilities/executeCode/index.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'

import { cacheAsset } from './index.js'

describe('cacheAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
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
            .mockResolvedValueOnce({ fileName: 'test' })
        ephemeraDB.getItem
            .mockResolvedValueOnce({ State: {} })
        parseWMLFile.mockResolvedValue(['Test'])
        globalizeDBEntries.mockResolvedValue({
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                importMap: {},
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
                    conditions: []
                },
                {
                    conditions: [{
                        dependencies: ['active'],
                        if: 'active'
                    }]
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
            }
        })
    })
})