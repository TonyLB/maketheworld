import { jest, expect } from '@jest/globals'

// jest.mock('/opt/utilities/stream.js')
// jest.mock('/opt/utilities/dynamoDB/index.js')
jest.mock('./clients.js')

import {
    assetDB,
    // ephemeraDB,
    // mergeIntoDataRange,
    // batchWriteDispatcher
} from '/opt/utilities/dynamoDB/index.js'
import { streamToString } from '/opt/utilities/stream.js'

import {
    parseWMLFile
} from './cache.js'
import { s3Client, GetObjectCommand } from './clients.js'

describe('parseWMLFile', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should return parsed output', async () => {
        s3Client.send.mockResolvedValue({})
        streamToString.mockResolvedValue(`
            <Asset key=(test) fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                </Room>
            </Asset>
        `)
        const parseOutput = await parseWMLFile('test')
        expect(parseOutput).toEqual({})
    })
})