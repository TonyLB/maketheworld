import { jest, expect } from '@jest/globals'

jest.mock('../clients.js')
jest.mock('@tonylb/mtw-utilities/dist/stream.js')
import { streamToString } from '@tonylb/mtw-utilities/dist/stream.js'

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
                <Condition if={active}>
                    <Depend on=(active) />
                    <Room key=(ABC)>
                        <Description>
                            The lights are on
                        </Description>
                    </Room>
                </Condition>
                <Variable key=(powered) default={false} />
                <Variable key=(switchedOn) default={true} />
                <Computed key=(active) src={powered && switchedOn}>
                    <Depend on=(switchedOn) />
                    <Depend on=(powered) />
                </Computed>
                <Action key=(toggleSwitch) src={switchedOn = !switchedOn} />
            </Asset>
        `)
        const parseOutput = await parseWMLFile('test')
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }
        expect(parseOutput).toMatchSnapshot()
    })
})