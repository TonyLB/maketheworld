import { jest, expect } from '@jest/globals'

jest.mock('../clients.js')
import { streamToString } from '/opt/utilities/stream.js'

import {
    parseWMLFile
} from './parseWMLFile.js'
import { s3Client } from '../clients.js'

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
        expect(parseOutput).toEqual([{
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
        }])
    })
})