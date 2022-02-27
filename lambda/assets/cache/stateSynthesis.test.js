import { jest, describe, it, expect } from '@jest/globals'

import { extractDependencies } from './stateSynthesis.js'

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
})