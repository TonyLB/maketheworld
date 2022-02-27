import { jest, expect } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
    assetDB,
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'
import { v4 as uuidv4 } from 'uuid'

import localizeDBEntries from './localize.js'

describe('localizeDBEntries', () => {
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
            isGlobal: true,
            appearances: [{
                ...topLevelAppearance,
                name: 'Vortex',
                render: [],
                contents: [
                    { key: 'VORTEX#Welcome', tag: 'Exit', index: 0 }
                ]
            },
            {
                contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                errors: [],
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

    it('should return localized output when none yet exists', async () => {
        ephemeraDB.query.mockResolvedValue([{}])
        uuidv4.mockReturnValue('UUID')
        const localizeOutput = await localizeDBEntries({
            assetId: 'test',
            normalizedDBEntries: testNormalForm
        })
        expect(localizeOutput).toEqual({
            scopeMap: {
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#UUID'
            },
            mappedNormalForm: {
                ...testNormalForm,
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#UUID'
                },
                'VORTEX#Welcome': {
                    ...testNormalForm['VORTEX#Welcome'],
                    toEphemeraId: 'UUID'
                },
                'Welcome#VORTEX': {
                    ...testNormalForm['Welcome#VORTEX'],
                    toEphemeraId: 'VORTEX'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
                }
            }
        })
    })

    it('should map localized output where it exists', async () => {
        ephemeraDB.query.mockResolvedValue([{
            EphemeraId: 'ROOM#123456',
            key: 'Welcome'
        }])
        uuidv4.mockReturnValue('UUID')
        const localizeOutput = await localizeDBEntries({
            assetId: 'test',
            normalizedDBEntries: testNormalForm
        })
        expect(localizeOutput).toEqual({
            scopeMap: {
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            },
            mappedNormalForm: {
                ...testNormalForm,
                Welcome: {
                    ...testNormalForm.Welcome,
                    EphemeraId: 'ROOM#123456'
                },
                'VORTEX#Welcome': {
                    ...testNormalForm['VORTEX#Welcome'],
                    toEphemeraId: '123456'
                },
                'Welcome#VORTEX': {
                    ...testNormalForm['Welcome#VORTEX'],
                    toEphemeraId: 'VORTEX'
                },
                VORTEX: {
                    ...testNormalForm.VORTEX,
                    EphemeraId: 'ROOM#VORTEX'
                }
            }
        })
    })

    it('should map imported non-instance assets', async () => {
        const testImportAsset = {
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
            'Import-0': {
                key: 'Import-0',
                tag: 'Import',
                from: 'BASE',
                mapping: {
                    VORTEX: 'VORTEX'
                },
                appearances: [topLevelAppearance]
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
        ephemeraDB.query.mockResolvedValue([])
        assetDB.query.mockResolvedValue([{
            AssetId: 'ROOM#BASEVORTEX',
            scopedId: 'VORTEX'
        }])
        uuidv4.mockReturnValue('UUID')
        const localizeOutput = await localizeDBEntries({
            assetId: 'test',
            normalizedDBEntries: testImportAsset
        })
        expect(localizeOutput).toEqual({
            scopeMap: {
                VORTEX: 'ROOM#BASEVORTEX',
                Welcome: 'ROOM#UUID'
            },
            mappedNormalForm: {
                ...testImportAsset,
                Welcome: {
                    ...testImportAsset.Welcome,
                    EphemeraId: 'ROOM#UUID'
                },
                'Welcome#VORTEX': {
                    ...testImportAsset['Welcome#VORTEX'],
                    toEphemeraId: 'BASEVORTEX'
                },
                'VORTEX#Welcome': {
                    ...testImportAsset['VORTEX#Welcome'],
                    toEphemeraId: 'UUID'
                }
            }
        })
    })

})