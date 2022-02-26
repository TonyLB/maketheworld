import { jest, expect } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
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
            }
        })
    })
})