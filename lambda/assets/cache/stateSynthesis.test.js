import { jest, describe, it, expect } from '@jest/globals'

import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import {
    extractDependencies,
    extractStartingState
} from './stateSynthesis.js'

describe('stateSynthesis', () => {
    const topLevelAppearance = {
        contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
        contents: [],
        errors: [],
        props: {}
    }

    describe('extractDependencies', () => {
        it('should extract computed and room dependencies', () => {
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

            expect(extractDependencies(testAsset)).toEqual({
                active: {
                    room: ['DEF']
                },
                powered: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            })
        })
    })

    describe('extractStartingState', () => {
        it('should fetch imported values', async () => {
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

            const stateOutput = await extractStartingState(testAsset)

            expect(stateOutput).toEqual({
                power: {
                    imported: true,
                    asset: 'BASE',
                    key: 'powered',
                    value: 'On'
                }
            })
            expect(ephemeraDB.batchGetItem).toHaveBeenCalledWith({
                Items: [{
                    EphemeraId: 'ASSET#BASE',
                    DataCategory: 'Meta::Asset'
                }],
                ProjectionFields: ['#state', 'Dependencies', 'EphemeraId'],
                ExpressionAttributeNames: {
                    '#state': 'State'
                }
            })
        })
    })
})