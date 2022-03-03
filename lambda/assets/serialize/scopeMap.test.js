import { jest, describe, expect, it } from '@jest/globals'

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'
import ScopeMap from './scopeMap.js'

describe('ScopeMap class', () => {
    describe('serialize', () => {
        it('should return empty on uninitialized class', () => {
            const testScope = new ScopeMap()
            expect(testScope.serialize()).toEqual({})
        })

        it('should return map initialized', () => {
            const testScope = new ScopeMap({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            })
            expect(testScope.serialize()).toEqual({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            })
        })
    })

    describe('translateNormalForm', () => {

        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }
        const testNormalForm = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'Village',
                        tag: 'Map',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'clockTower',
                        tag: 'Feature',
                        index: 0
                    },
                    {
                        key: 'Welcome',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            clockTower: {
                key: 'clockTower',
                tag: 'Feature',
                appearances: [topLevelAppearance]
            },
            Village: {
                key: 'Village',
                tag: 'Map',
                appearances: [{
                    ...topLevelAppearance,
                    contents: [
                        { key: 'VORTEX', tag: 'Room', index: 0 }
                    ]
                }]
            },
            VORTEX: {
                key: 'VORTEX',
                tag: 'Room',
                appearances: [{
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Village', tag: 'Map', index: 0 }],
                    errors: [],
                    props: {},
                    global: false,
                    name: 'Vortex',
                    render: [],
                    contents: [
                        { key: 'VORTEX#Welcome', tag: 'Exit', index: 0 }
                    ]
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
                        key: 'VORTEX',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            },
            Welcome: {
                key: 'Welcome',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    global: false,
                    name: 'Welcome Area',
                    render: [],
                    contents: [
                        { key: 'Welcome#VORTEX', tag: 'Exit', index: 0 }
                    ]
                }]
            },
            'VORTEX#Welcome': {
                key: 'VORTEX#Welcome',
                tag: 'Exit',
                to: 'Welcome',
                from: 'VORTEX',
                name: 'welcome',
                appearances: [{
                    contextStack: [
                        { key: 'test', tag: 'Asset', index: 0},
                        { key: 'VORTEX', tag: 'Room', index: 0}
                    ]
                }]
            },
            'Welcome#VORTEX': {
                key: 'Welcome#VORTEX',
                tag: 'Exit',
                to: 'VORTEX',
                from: 'Welcome',
                name: 'vortex',
                appearances: [{
                    contextStack: [
                        { key: 'test', tag: 'Asset', index: 0},
                        { key: 'Welcome', tag: 'Room', index: 0}
                    ]
                }]
            }
        }

        it('should translate without change to scope map when all keys already scoped', () => {
            const testScope = new ScopeMap({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456',
                clockTower: 'FEATURE#ABCDEF',
                Village: 'MAP#XYZ'
            })
            expect(testScope.translateNormalForm(testNormalForm)).toEqual({
                ...testNormalForm,
                'VORTEX#Welcome': {
                    ...testNormalForm['VORTEX#Welcome'],
                    toEphemeraId: '123456'
                },
                'Welcome#VORTEX': {
                    ...testNormalForm['Welcome#VORTEX'],
                    toEphemeraId: 'VORTEX'
                },
                Village: {
                    ...testNormalForm.Village,
                    EphemeraId: 'MAP#XYZ'
                },
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#123456'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
                },
                clockTower: {
                    ...testNormalForm.clockTower,
                    EphemeraId: 'FEATURE#ABCDEF'
                }
            })
        })

        it('should update unmapped keys from UUID before translating', () => {
            uuidv4.mockReturnValue('UUID')
            const testScope = new ScopeMap({
                VORTEX: 'ROOM#VORTEX'
            })
            expect(testScope.translateNormalForm(testNormalForm)).toEqual({
                ...testNormalForm,
                'VORTEX#Welcome': {
                    ...testNormalForm['VORTEX#Welcome'],
                    toEphemeraId: 'UUID'
                },
                'Welcome#VORTEX': {
                    ...testNormalForm['Welcome#VORTEX'],
                    toEphemeraId: 'VORTEX'
                },
                Village: {
                    ...testNormalForm.Village,
                    EphemeraId: 'MAP#UUID'
                },
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#UUID'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
                },
                clockTower: {
                    ...testNormalForm.clockTower,
                    EphemeraId: 'FEATURE#UUID'
                }
            })
            expect(testScope.serialize()).toEqual({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#UUID',
                clockTower: 'FEATURE#UUID',
                Village: 'MAP#UUID'
            })
        })

        it('should update embedded links', () => {
            const linksNormalForm = {
                test: {
                    key: 'test',
                    tag: 'Asset',
                    fileName: 'test',
                    appearances: [{
                        contextStack: [],
                        errors: [],
                        props: {},
                        contents: [{
                            key: 'VORTEX',
                            tag: 'Room',
                            index: 0
                        },
                        {
                            key: 'Condition-0',
                            tag: 'Condition',
                            index: 0
                        },
                        {
                            key: 'testOne',
                            tag: 'Feature',
                            index: 0
                        },
                        {
                            key: 'testTwo',
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
                'Import-0': {
                    key: 'Import-0',
                    from: 'Somewhere',
                    mapping: {
                        testThree: 'testThree'
                    }
                },
                testOne: {
                    key: 'testOne',
                    tag: 'Feature',
                    appearances: [topLevelAppearance]
                },
                testTwo: {
                    key: 'testTwo',
                    tag: 'Action',
                    appearances: [topLevelAppearance]
                },
                VORTEX: {
                    key: 'VORTEX',
                    tag: 'Room',
                    appearances: [{
                        ...topLevelAppearance,
                        global: false,
                        name: 'Vortex',
                        render: [{
                            tag: 'Link',
                            key: 'linkOne',
                            to: 'testOne',
                            text: 'Test One'
                        },
                        {
                            tag: 'Link',
                            key: 'linkTwo',
                            to: 'testTwo',
                            text: 'Test Two'
                        },
                        {
                            tag: 'Link',
                            key: 'linkThree',
                            to: 'testThree',
                            text: 'Test Three'
                        }],
                        contents: []
                    }]
                },
            }
            uuidv4.mockReturnValue('UUID')
            const testScope = new ScopeMap({
                VORTEX: 'ROOM#VORTEX',
                testOne: 'FEATURE#TESTONE',
                testThree: 'FEATURE#TESTTHREE'
            })
            expect(testScope.translateNormalForm(linksNormalForm)).toEqual({
                ...linksNormalForm,
                VORTEX: {
                    ...linksNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX',
                    appearances: [{
                        ...topLevelAppearance,
                        global: false,
                        name: 'Vortex',
                        render: [{
                            tag: 'Link',
                            key: 'linkOne',
                            to: 'testOne',
                            toFeatureId: 'TESTONE',
                            text: 'Test One',
                            targetTag: 'Feature'
                        },
                        {
                            tag: 'Link',
                            key: 'linkTwo',
                            to: 'testTwo',
                            toAssetId: 'test',
                            toAction: 'testTwo',
                            text: 'Test Two',
                            targetTag: 'Action'
                        },
                        {
                            tag: 'Link',
                            key: 'linkThree',
                            to: 'testThree',
                            toFeatureId: 'TESTTHREE',
                            text: 'Test Three',
                            targetTag: 'Feature'
                        }],
                        contents: []

                    }]
                },
                testOne: {
                    ...linksNormalForm.testOne,
                    EphemeraId: 'FEATURE#TESTONE'
                }
            })
        })
    })
})