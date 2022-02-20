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
                <Condition if={active}>
                    <Depend on=(active) />
                    <Room key=(ABC)>
                        The lights are on
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
        }])
    })
})