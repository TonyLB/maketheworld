jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

import { InternalCache } from '.'

const uuidv4Mock = uuidv4 as jest.Mock

describe ('OrchestrateMessages', () => {
    const testCache = new InternalCache()

    beforeEach(() => {
        jest.clearAllMocks()
        testCache.clear()
        let uuidv4Index = 1
        uuidv4Mock.mockImplementation(() => (`UUID#${uuidv4Index++}`))
    })

    it('should assign offset 0 to every flat, unrelated message group', () => {
        const rootOne = testCache.OrchestrateMessages.newMessageGroup()
        const rootTwo = testCache.OrchestrateMessages.newMessageGroup()
        const rootThree = testCache.OrchestrateMessages.newMessageGroup()

        expect(testCache.OrchestrateMessages.allOffsets()).toEqual({
            [rootOne]: 0,
            [rootTwo]: 0,
            [rootThree]: 0
        })
    })
})

