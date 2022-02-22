import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('./updateRooms.js')
import { updateRooms } from './updateRooms.js'
jest.mock('./dependencyCascade.js')
import dependencyCascade from './dependencyCascade.js'
import { testAssetsFactory, testMockImplementation } from './testAssets.js'

import { executeInAsset } from './index.js'

describe('executeInAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should post no changes on an empty change list', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        const output = await executeInAsset('BASE')('return foo')
        expect(output).toBe(true)
        expect(dependencyCascade).not.toHaveBeenCalled
        expect(ephemeraDB.batchGetItem).not.toHaveBeenCalled
        expect(ephemeraDB.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: { value: true },
                    antiFoo: {
                        computed: true,
                        src: '!foo',
                        value: false
                    }
                }
            }
        })
        expect(updateRooms).toHaveBeenCalledWith([])
    })
})