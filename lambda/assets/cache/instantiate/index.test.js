import { jest, describe, it, expect } from '@jest/globals'

jest.mock('/opt/utilities/dynamoDB/index.js')
import {
    assetDB
} from '/opt/utilities/dynamoDB/index.js'

import instantiateAsset from './index.js'

describe('instantiate Asset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should skip processing when no asset', async () => {
        await instantiateAsset()

        expect(assetDB.getItem).toHaveBeenCalledTimes(0)
    })
})