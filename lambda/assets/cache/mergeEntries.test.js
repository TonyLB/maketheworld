import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dynamoDB/index.js')
import {
    mergeIntoDataRange
} from '@tonylb/mtw-utilities/dynamoDB/index.js'

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
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }],
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
                    render: []
                },
                {
                    conditions: [{
                        dependencies: ['active'],
                        if: 'active'
                    }],
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }]
                }
                ]
            }],
            mergeFunction: expect.any(Function)
        })
    })

    it('should correctly handle Features', async () => {
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
                        tag: 'Feature',
                        index: 0
                    },
                    {
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                EphemeraId: 'FEATURE#DEF',
                tag: 'Feature',
                name: 'Vortex',
                appearances: [{
                    ...topLevelAppearance,
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'MNO', tag: 'Room', index: 0 }],
                    errors: [],
                    props: {},
                    render: [],
                    contents: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    errors: [],
                    props: {},
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }],
                    contents: []
                }]
            },
            MNO: {
                key: 'MNO',
                EphemeraId: 'ROOM#PQR',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    ...topLevelAppearance,
                    render: [],
                    contents: [{
                        key: 'ABC',
                        tag: 'Feature',
                        index: 1
                    }]
                }]
            },
            ['Condition-0']: {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'true',
                dependencies: [],
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'ABC',
                        tag: 'Feature',
                        index: 2
                    }]
                }]
            }
        })

        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#test' },
            items: [{
                EphemeraId: 'FEATURE#DEF',
                key: 'ABC',
                tag: 'Feature',
                name: 'Vortex',
                appearances: [{
                    conditions: [],
                    render: [],
                },
                {
                    conditions: [],
                    render: [],
                },
                {
                    conditions: [{
                        dependencies: [],
                        if: 'true'
                    }],
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }],
                }]
            },
            {
                EphemeraId: 'ROOM#PQR',
                key: 'MNO',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    conditions: [],
                    render: [],
                    features: [{
                        name: 'Vortex',
                        EphemeraId: 'FEATURE#DEF'
                    }]
                }],
            }],
            mergeFunction: expect.any(Function)
        })
    })

    it('should correctly handle Maps', async () => {
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
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'TestMap',
                        tag: 'Map',
                        index: 0
                    }]
                }]
            },
            MNO: {
                key: 'MNO',
                EphemeraId: 'ROOM#PQR',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    ...topLevelAppearance,
                    render: [],
                    contents: [],
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                    errors: [],
                    props: {},
                    contents: []
                }]
            },
            TestImage: {
                key: 'TestImage',
                tag: 'Image',
                fileURL: 'https://test.com/testImage.png',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                    errors: [],
                    props: {},
                    contents: []
                }]
            },
            TestMap: {
                key: 'TestMap',
                tag: 'Map',
                EphemeraId: 'MAP#TEST',
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'TestImage',
                        tag: 'Image',
                        index: 0
                    },
                    {
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    }],
                    rooms: {
                        MNO: { x: 300, y: 200 }
                    }
                }]
            }
        })

        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#test' },
            items: [{
                EphemeraId: 'ROOM#PQR',
                key: 'MNO',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    conditions: [],
                    render: []
                },
                {
                    conditions: [],
                }]
            },
            {
                EphemeraId: 'MAP#TEST',
                key: 'TestMap',
                tag: 'Map',
                appearances: [{
                    conditions: [],
                    fileURL: 'https://test.com/testImage.png',
                    rooms: {
                        MNO: {
                            EphemeraId: 'ROOM#PQR',
                            x: 300,
                            y: 200
                        }
                    }
                }],
            }],
            mergeFunction: expect.any(Function)
        })
    })
})