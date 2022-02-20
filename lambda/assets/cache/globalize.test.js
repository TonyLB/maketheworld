import { jest, expect } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
    assetDB
} from '/opt/utilities/dynamoDB/index.js'
import { v4 as uuidv4 } from 'uuid'

import globalizeDBEntries from './globalize.js'

describe('globalizeDBEntries', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should return globalized output', async () => {
        const testEntries = [{
            key: 'ABC',
            tag: 'Room',
            appearances: [{
                conditions: [],
                errors: [],
                global: false,
                name: 'Vortex',
                props: {},
                render: []
            },
            {
                conditions: [{
                    dependencies: ['active'],
                    if: 'active'
                }],
                global: false,
                errors: [],
                props: {},
                render: ['The lights are on ']
            }]
        },
        {
            key: 'powered',
            tag: 'Variable',
            default: 'false'
        },
        {
            key: 'switchedOn',
            tag: 'Variable',
            default: 'true'
        },
        {
            key: 'active',
            tag: 'Computed',
            dependencies: ['switchedOn', 'powered'],
            src: 'powered && switchedOn'
        },
        {
            key: 'toggleSwitch',
            tag: 'Action',
            src: 'switchedOn = !switchedOn'
        }]
        assetDB.query.mockResolvedValue([{
            AssetId: 'ROOM#DEF',
            scopedId: 'ABC'
        }])
        uuidv4.mockReturnValue('UUID')
        const globalizeOutput = await globalizeDBEntries('test', testEntries)
        expect(globalizeOutput).toEqual([{
            EphemeraId: 'ROOM#DEF',
            appearances: [{
                conditions: [],
                name: 'Vortex'
            },
            {
                conditions: [{
                    dependencies: ['active'],
                    if: 'active'
                }],
                render: ['The lights are on ']
            }]
        },
        {
            EphemeraId: 'VARIABLE#UUID',
            defaultValue: 'false',
            scopedId: 'powered',
        },
        {
            EphemeraId: 'VARIABLE#UUID',
            defaultValue: 'true',
            scopedId: 'switchedOn',
        },
        {
            EphemeraId: 'ACTION#UUID',
            scopedId: 'toggleSwitch',
            src: 'switchedOn = !switchedOn'
        }])
    })
})