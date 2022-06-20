import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index.js')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import StateSynthesizer from './stateSynthesis.js'

describe('stateSynthesis', () => {
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
                },
                {
                    key: 'Import-0',
                    tag: 'Import',
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
                name: ['(lit)'],
                render: ['The lights are on '],
                contents: []
            }]
        },
        power: {
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
            src: 'power && switchedOn',
            dependencies: ['switchedOn', 'power'],
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
        },
        ['Import-0']: {
            key: 'Import-0',
            tag: 'Import',
            from: 'BASE',
            mapping: {
                welcome: { key: 'ABC', type: 'Room' },
                power: { key: 'powered', type: 'Variable' }
            },
            appearances: [topLevelAppearance]
        }
    }

    describe('constructor', () => {
        it('should extract computed, room, and mapCache dependencies', () => {
            const testSynthesizer = new StateSynthesizer('test', testAsset)

            expect(testSynthesizer.dependencies).toEqual({
                active: {
                    room: ['DEF'],
                    mapCache: ['DEF']
                },
                power: {
                    computed: ['active']
                },
                switchedOn: {
                    computed: ['active']
                }
            })
        })

        it('should extract map dependencies', () => {
            const mapAsset = {
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
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        errors: [],
                        global: false,
                        props: {},
                        name: ['(lit)'],
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
                ['Condition-0']: {
                    key: 'Condition-0',
                    tag: 'Condition',
                    if: 'powered',
                    dependencies: ['powered'],
                    appearances: [{
                        ...topLevelAppearance,
                        contents: [{
                            key: 'TestMap',
                            tag: 'Map',
                            index: 0
                        }]
                    }]
                },
                TestMap: {
                    key: 'TestMap',
                    tag: 'Map',
                    EphemeraId: 'MAP#TESTMAP',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        errors: [],
                        props: {},
                        name: ['Test Map'],
                        rooms: {
                            'ABC': {
                                x: 200,
                                y: 150
                            }
                        },
                        contents: [{
                            tag: 'Room',
                            key: 'ABC',
                            index: 1
                        }]
                    }]
                }
            }
            const mapSynthesizer = new StateSynthesizer('test', mapAsset)

            expect(mapSynthesizer.dependencies).toEqual({
                powered: {
                    room: ['DEF'],
                    mapCache: ['DEF'],
                    map: ['TESTMAP']
                }
            })
        })

        it('should extract computed variables', () => {
            const testSynthesizer = new StateSynthesizer('test', testAsset)

            expect(testSynthesizer.state).toEqual({
                active: {
                    key: 'active',
                    computed: true,
                    src: 'power && switchedOn'
                }
            })
        })
    })

    describe('fetchFromEphemera', () => {
        it('should fetch and merge state from ephemera', async () => {
            const testSynthesizer = new StateSynthesizer('test', testAsset)
            ephemeraDB.getItem.mockResolvedValue({
                State: {
                    power: {
                        key: 'power',
                        value: true
                    },
                    switchedOn: {
                        key: 'switchedOn',
                        value: true
                    }
                }
            })
            await testSynthesizer.fetchFromEphemera()
            expect(ephemeraDB.getItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#test',
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['#state'],
                ExpressionAttributeNames: {
                    '#state': 'State'
                }    
            })
            expect(testSynthesizer.state).toEqual({
                active: {
                    key: 'active',
                    computed: true,
                    src: 'power && switchedOn'
                },
                power: {
                    key: 'power',
                    value: true
                },
                switchedOn: {
                    key: 'switchedOn',
                    value: true
                }
            })
        })

        it('should remove variables from ephemera when they are removed from source', async () => {
            const testSynthesizer = new StateSynthesizer('test', testAsset)
            ephemeraDB.getItem.mockResolvedValue({
                State: {
                    power: {
                        key: 'power',
                        value: true
                    },
                    switchedOn: {
                        key: 'switchedOn',
                        value: true
                    },
                    obsolete: {
                        key: 'obsolete',
                        value: 'Widget'
                    }
                }
            })
            await testSynthesizer.fetchFromEphemera()
            expect(ephemeraDB.getItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#test',
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['#state'],
                ExpressionAttributeNames: {
                    '#state': 'State'
                }    
            })
            expect(testSynthesizer.state).toEqual({
                active: {
                    key: 'active',
                    computed: true,
                    src: 'power && switchedOn'
                },
                power: {
                    key: 'power',
                    value: true
                },
                switchedOn: {
                    key: 'switchedOn',
                    value: true
                }
            })
        })

        it('should update computed source as needed', async () => {
            const testSynthesizer = new StateSynthesizer('test', testAsset)
            ephemeraDB.getItem.mockResolvedValue({
                State: {
                    active: {
                        key: 'active',
                        computed: true,
                        src: 'power'
                    },
                    power: {
                        key: 'power',
                        value: true
                    },
                    switchedOn: {
                        key: 'switchedOn',
                        value: true
                    }
                }
            })
            await testSynthesizer.fetchFromEphemera()
            expect(ephemeraDB.getItem).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#test',
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['#state'],
                ExpressionAttributeNames: {
                    '#state': 'State'
                }    
            })
            expect(testSynthesizer.state).toEqual({
                active: {
                    key: 'active',
                    computed: true,
                    src: 'power && switchedOn'
                },
                power: {
                    key: 'power',
                    value: true
                },
                switchedOn: {
                    key: 'switchedOn',
                    value: true
                }
            })
        })
    })

    describe('fetchImportedValues', () => {
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

            const testSynthesizer = new StateSynthesizer('test', testAsset)
            await testSynthesizer.fetchImportedValues()

            expect(testSynthesizer.state).toEqual({
                active: {
                    key: 'active',
                    computed: true,
                    src: 'power && switchedOn'
                },
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

    describe('updateImportedDependencies', () => {
        it('should update asset dependencies on fetched imports', async () => {
            ephemeraDB.batchGetItem
                .mockResolvedValueOnce([{
                    EphemeraId: 'ASSET#BASE',
                    State: {
                        powered: {
                            value: 'On'
                        }
                    },
                    Dependencies: {
                        powered: {
                            imported: [{
                                asset: 'somethingElse',
                                key: 'powered'
                            }]
                        }
                    }
                }])

            const testSynthesizer = new StateSynthesizer('test', testAsset)
            await testSynthesizer.fetchImportedValues()
            await testSynthesizer.updateImportedDependencies()

            expect(ephemeraDB.update).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#BASE',
                DataCategory: 'Meta::Asset',
                UpdateExpression: 'SET Dependencies = :dependencies',
                ExpressionAttributeValues: {
                    ':dependencies': {
                        powered: {
                            imported: [{
                                asset: 'somethingElse',
                                key: 'powered'
                            },
                            {
                                asset: 'test',
                                key: 'power'
                            }]
                        }
                    }
                }
            })

        })

        it('should remove asset dependencies when they are removed from source', async () => {
            ephemeraDB.batchGetItem
                .mockResolvedValueOnce([{
                    EphemeraId: 'ASSET#BASE',
                    State: {
                        powered: {
                            value: 'On'
                        },
                        widget: {
                            value: 'Widget'
                        }
                    },
                    Dependencies: {
                        powered: {
                            imported: [{
                                asset: 'somethingElse',
                                key: 'powered'
                            }]
                        },
                        widget: {
                            imported: [{
                                asset: 'test',
                                key: 'obsolete'
                            }]
                        }
                    }
                }])

            const testSynthesizer = new StateSynthesizer('test', testAsset)
            await testSynthesizer.fetchImportedValues()
            await testSynthesizer.updateImportedDependencies()

            expect(ephemeraDB.update).toHaveBeenCalledWith({
                EphemeraId: 'ASSET#BASE',
                DataCategory: 'Meta::Asset',
                UpdateExpression: 'SET Dependencies = :dependencies',
                ExpressionAttributeValues: {
                    ':dependencies': {
                        powered: {
                            imported: [{
                                asset: 'somethingElse',
                                key: 'powered'
                            },
                            {
                                asset: 'test',
                                key: 'power'
                            }]
                        }
                    }
                }
            })

        })

        it('should update room dependencies on map entries', async () => {
            const mapAsset = {
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
                            key: 'TestMap',
                            tag: 'Map',
                            index: 0
                        }]
                    }]
                },
                ABC: {
                    key: 'ABC',
                    EphemeraId: 'ROOM#DEF',
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        errors: [],
                        global: false,
                        props: {},
                        name: 'Vortex',
                        render: []
                    }]
                },
                TestMap: {
                    key: 'TestMap',
                    tag: 'Map',
                    EphemeraId: 'MAP#TESTMAP',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                        errors: [],
                        props: {},
                        name: ['Test Map'],
                        rooms: {
                            'ABC': {
                                x: 200,
                                y: 150
                            }
                        },
                        contents: [{
                            tag: 'Room',
                            key: 'ABC',
                            index: 0
                        }]
                    }]
                }
            }

            ephemeraDB.batchGetItem
                .mockResolvedValueOnce([])
            
            ephemeraDB.getItem
                .mockResolvedValueOnce({
                    Dependencies: {}
                })

            const testSynthesizer = new StateSynthesizer('test', mapAsset)
            await testSynthesizer.fetchImportedValues()
            await testSynthesizer.updateImportedDependencies()

            expect(ephemeraDB.update).toHaveBeenCalledWith({
                EphemeraId: 'ROOM#DEF',
                DataCategory: 'Meta::Room',
                UpdateExpression: 'SET Dependencies = :dependencies',
                ExpressionAttributeValues: {
                    ':dependencies': {
                        map: ['MAP#TESTMAP']
                    }
                }
            })

        })
    })

})