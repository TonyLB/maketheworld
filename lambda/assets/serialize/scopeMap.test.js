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
                        key: 'Welcome',
                        tag: 'Room',
                        index: 0
                    }]
                }]
            },
            VORTEX: {
                key: 'VORTEX',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
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
                Welcome: 'ROOM#123456'
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
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#123456'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
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
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#UUID'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
                }
            })
            expect(testScope.serialize()).toEqual({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#UUID'
            })
        })
    })
})