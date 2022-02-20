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
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }
        expect(parseOutput).toEqual({
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                importMap: {},
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'Condition-0',
                        tag: 'Condition',
                        index: 0
                    },
                    {
                        key: 'powered',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'switchedOn',
                        tag: 'Variable',
                        index: 0
                    },
                    {
                        key: 'active',
                        tag: 'Computed',
                        index: 0
                    },
                    {
                        key: 'toggleSwitch',
                        tag: 'Action',
                        index: 0
                    }]
                }]
            },
            ABC: {
                key: 'ABC',
                tag: 'Room',
                appearances: [{
                    ...topLevelAppearance,
                    global: false,
                    name: 'Vortex',
                    render: []
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                    errors: [],
                    global: false,
                    props: {},
                    render: ['The lights are on '],
                    contents: []
                }]
            },
            powered: {
                key: 'powered',
                tag: 'Variable',
                default: 'false',
                appearances: [topLevelAppearance]
            },
            switchedOn: {
                key: 'switchedOn',
                tag: 'Variable',
                default: 'true',
                appearances: [topLevelAppearance]
            },
            active: {
                key: 'active',
                tag: 'Computed',
                src: 'powered && switchedOn',
                dependencies: ['switchedOn', 'powered'],
                appearances: [topLevelAppearance]
            },
            toggleSwitch: {
                key: 'toggleSwitch',
                tag: 'Action',
                src: 'switchedOn = !switchedOn',
                appearances: [topLevelAppearance]
            },
            ['Condition-0']: {
                key: 'Condition-0',
                tag: 'Condition',
                if: 'active',
                dependencies: ['active'],
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'ABC',
                        tag: 'Room',
                        index: 1
                    }]
                }]
            }
        })
    })
})