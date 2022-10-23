import { jest, describe, it, expect } from '@jest/globals'

import { BaseAppearance, ComponentAppearance, NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { MessageBus } from '../messageBus/baseClasses'
import StateSynthesizer from './stateSynthesis'


describe('stateSynthesis', () => {

    const messageBusMock = { send: jest.fn() } as unknown as jest.Mocked<MessageBus>

    const topLevelAppearance: BaseAppearance = {
        contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
        contents: []
    }

    const testNamespaceIdToDB = {
        ABC: 'ROOM#DEF',
        power: 'VARIABLE#QRS',
        switchedOn: 'VARIABLE#TUV',
        active: 'COMPUTED#XYZ'
    }
    const testAsset: NormalForm = {
        test: {
            key: 'test',
            tag: 'Asset',
            fileName: 'test',
            appearances: [{
                contextStack: [],
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
                },
                {
                    key: 'Import-0',
                    tag: 'Import',
                    index: 0
                }]
            }]
        },
        ABC: {
            key: 'ABC',
            tag: 'Room',
            appearances: [{
                ...topLevelAppearance,
                name: 'Vortex',
                render: []
            },
            {
                contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'Condition-0', tag: 'Condition', index: 0 }],
                name: [{ tag: 'String', value: '(lit)' }],
                render: [{ tag: 'String', value: 'The lights are on ' }],
                contents: []
            }] as ComponentAppearance[]
        },
        power: {
            key: 'power',
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
            src: 'power && switchedOn',
            dependencies: ['switchedOn', 'power'],
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
        },
        ['Import-0']: {
            key: 'Import-0',
            tag: 'Import',
            from: 'BASE',
            mapping: {
                welcome: { key: 'ABC', type: 'Room' },
                power: { key: 'powered', type: 'Variable' }
            },
            appearances: [topLevelAppearance]
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should correctly execute sendDependencyMessages', () => {

        const testSynthesizer = new StateSynthesizer({ namespaceIdToDB: testNamespaceIdToDB, normal: testAsset } as any, messageBusMock)

        testSynthesizer.sendDependencyMessages()
        expect(messageBusMock.send.mock.calls).toMatchSnapshot()
    })
})