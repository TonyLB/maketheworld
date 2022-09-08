import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    mergeIntoDataRange
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

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
        await mergeEntries('test', [
            {
                key: 'ABC',
                EphemeraId: 'ROOM#XABC',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: [],
                    exits: [{
                        name: 'welcome',
                        to: 'XDEF'
                    }]
                }]
            },
            {
                key: 'DEF',
                EphemeraId: 'ROOM#XDEF',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    name: 'Welcome',
                    render: [],
                    exits: [{
                        name: 'vortex',
                        to: 'XABC'
                    }]
                }]
            },
        ])

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
        await mergeEntries('test', [
            {
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
                    conditions: [{
                        dependencies: ["active"],
                        if: "active"
                    }],
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }],
                    exits: []
                }]
            }
        ])

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
        await mergeEntries('test', [
            {
                key: 'ABC',
                EphemeraId: 'FEATURE#DEF',
                tag: 'Feature',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: []
                },
                {
                    conditions: [],
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    conditions: [{
                        dependencies: [],
                        if: 'true'
                    }],
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'The lights are on '
                    }]
                }]
            },
            {
                key: 'MNO',
                EphemeraId: 'ROOM#PQR',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    conditions: [],
                    name: 'Wherever',
                    render: []
                }]
            }
        ])

        expect(mergeIntoDataRange).toHaveBeenCalledWith({
            table: 'ephemera',
            search: { DataCategory: 'ASSET#test' },
            items: [{
                EphemeraId: 'FEATURE#DEF',
                key: 'ABC',
                tag: 'Feature',
                appearances: [{
                    conditions: [],
                    name: 'Vortex',
                    render: []
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
        await mergeEntries('test', [
            {
                key: 'MNO',
                EphemeraId: 'ROOM#PQR',
                tag: 'Room',
                appearances: [{
                    conditions: [],
                    render: [],
                    name: 'Wherever',
                    exits: [],
                },
                {
                    conditions: [],
                    render: [],
                    exits: []
                }]
            },
            {
                key: 'TestMap',
                tag: 'Map',
                EphemeraId: 'MAP#TEST',
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
                }]
            }
        ])

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