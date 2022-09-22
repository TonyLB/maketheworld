import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { BaseAppearance, ComponentAppearance, MapAppearance, NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import StateSynthesizer from './stateSynthesis'

const getItemMock = ephemeraDB.getItem as jest.Mock
const batchGetItemMock = ephemeraDB.batchGetItem as jest.Mock

describe('stateSynthesis', () => {

    const topLevelAppearance: BaseAppearance = {
        contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
        contents: []
    }

    const testNamespaceIdToDB = {
        ABC: 'ROOM#DEF'
    }
    const testAsset: NormalForm = {
        test: {
            key: 'test',
            tag: 'Asset',
            fileName: 'test',
            appearances: [{
                contextStack: [],
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
            tag: 'Room',
            appearances: [{
                ...topLevelAppearance,
                name: 'Vortex',
                render: []
            },
            {
                contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                name: '(lit)',
                render: [{ type: 'String', value: 'The lights are on ' }],
                contents: []
            }] as ComponentAppearance[]
        },
        power: {
            key: 'power',
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

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('constructor', () => {
        it('should extract computed, room, and mapCache dependencies', () => {
            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)

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
            const mapNamespace = {
                ABC: 'ROOM#DEF',
                TestMap: 'MAP#TESTMAP'
            }
            const mapAsset: NormalForm = {
                test: {
                    key: 'test',
                    tag: 'Asset',
                    fileName: 'test',
                    appearances: [{
                        contextStack: [],
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
                            key: 'power',
                            tag: 'Variable',
                            index: 0
                        }]
                    }]
                },
                ABC: {
                    key: 'ABC',
                    tag: 'Room',
                    appearances: [{
                        ...topLevelAppearance,
                        name: 'Vortex',
                        render: []
                    },
                    {
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        errors: [],
                        global: false,
                        props: {},
                        name: '(lit)',
                        render: [{ type: 'String', value: 'The lights are on ' }],
                        contents: []
                    }] as ComponentAppearance[]
                },
                power: {
                    key: 'power',
                    tag: 'Variable',
                    default: 'false',
                    appearances: [topLevelAppearance]
                },
                ['Condition-0']: {
                    key: 'Condition-0',
                    tag: 'Condition',
                    if: 'power',
                    dependencies: ['power'],
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
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                        name: 'Test Map',
                        rooms: {
                            'ABC': {
                                x: 200,
                                y: 150,
                                location: []
                            }
                        },
                        images: [],
                        contents: [{
                            tag: 'Room',
                            key: 'ABC',
                            index: 1
                        }]
                    }] as MapAppearance[]
                }
            }
            const mapSynthesizer = new StateSynthesizer({ namespaceIdToDB: mapNamespace, normal: mapAsset } as any)

            expect(mapSynthesizer.dependencies).toEqual({
                power: {
                    room: ['DEF'],
                    mapCache: ['DEF'],
                    map: ['TESTMAP']
                }
            })
        })

        it('should extract computed variables', () => {
            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)

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
            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
            getItemMock.mockResolvedValue({
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
            expect(getItemMock).toHaveBeenCalledWith({
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
            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
            getItemMock.mockResolvedValue({
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
            expect(getItemMock).toHaveBeenCalledWith({
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
            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
            getItemMock.mockResolvedValue({
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
            batchGetItemMock
                .mockResolvedValueOnce([{
                    EphemeraId: 'ASSET#BASE',
                    State: {
                        powered: {
                            value: 'On'
                        }
                    },
                    Dependencies: {}
                }])

            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
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
            expect(batchGetItemMock).toHaveBeenCalledWith({
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
            batchGetItemMock
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

            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
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
            batchGetItemMock
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

            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any)
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

            const mapNamespace = {
                ABC: 'ROOM#DEF',
                TestMap: 'MAP#TESTMAP'
            }

            const mapAsset: NormalForm = {
                test: {
                    key: 'test',
                    tag: 'Asset',
                    fileName: 'test',
                    appearances: [{
                        contextStack: [],
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
                    tag: 'Room',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                        name: 'Vortex',
                        render: [],
                        contents: []
                    }] as ComponentAppearance[]
                },
                TestMap: {
                    key: 'TestMap',
                    tag: 'Map',
                    appearances: [{
                        contextStack: [{ key: 'test', tag: 'Asset', index: 0 }],
                        name: 'Test Map',
                        rooms: {
                            'ABC': {
                                x: 200,
                                y: 150,
                                location: []
                            }
                        },
                        contents: [{
                            tag: 'Room',
                            key: 'ABC',
                            index: 0
                        }],
                        images: []
                    }] as MapAppearance[]
                }
            }

            batchGetItemMock
                .mockResolvedValueOnce([])
            
            getItemMock
                .mockResolvedValueOnce({
                    Dependencies: {}
                })

            const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: mapNamespace, normal: mapAsset } as any)
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