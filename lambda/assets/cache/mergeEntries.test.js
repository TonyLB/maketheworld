import { jest, describe, it, expect } from '@jest/globals'

import {
    mergeIntoDataRange
} from '/opt/utilities/dynamoDB/index.js'

import mergeEntries from './mergeEntries.js'

describe('Asset cache mergeEntries', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const topLevelAppearance = {
        contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
        contents: [],
        errors: [],
        props: {}
    }

    it('should attach exits to correct room appearances', async () => {
        await mergeEntries('test', {
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

        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#test' },
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

    it('should correctly attach conditions', async () => {
        await mergeEntries('test', {
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

        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#test' },
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
    })
})