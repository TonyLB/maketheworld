import { jest, expect } from '@jest/globals'

const mockV4 = jest.fn()
jest.mock('uuid', () => {
    return {
        v4: mockV4
    }
})
import { v4 as uuidv4 } from 'uuid'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
    assetDB
} from '/opt/utilities/dynamoDB/index.js'

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
            }]
        }]
        assetDB.query.mockResolvedValue([{
            AssetId: 'ROOM#DEF',
            scopedId: 'ABC'
        }])
        const globalizeOutput = await globalizeDBEntries('test', testEntries)
        expect(globalizeOutput).toEqual([{
            EphemeraId: 'ROOM#DEF',
            appearances: [{
                conditions: [],
                name: 'Vortex'
            }]
        }])
    })
})