jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB, multiTableTransactWrite, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

import dependencyCascadeMessage from './dependencyCascade'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)
const transactMock = multiTableTransactWrite as jest.Mock
const exponentialBackoffMock = exponentialBackoffWrapper as jest.Mock

describe('DependencyCascadeMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        exponentialBackoffMock.mockImplementation(async (func) => { await func() })
    })

    it('should update a computed item and cascade', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            Ancestry: [{
                EphemeraId: 'VariableOne',
                tag: 'Variable',
                key: 'a',
                assets: [],
                connections: []
            },
            {
                EphemeraId: 'VariableTwo',
                tag: 'Variable',
                key: 'b',
                assets: [],
                connections: []
            }],
            src: 'a + b',
            value: 4
        })
        internalCacheMock.AssetState.get.mockResolvedValue({
            a: 1,
            b: 2
        })
        internalCacheMock.AssetState.isOverridden.mockReturnValue(false)
        internalCacheMock.EvaluateCode.get.mockResolvedValue(3)
        await dependencyCascadeMessage({
            payloads: [
                {
                    type: 'DependencyCascade',
                    targetId: 'TestOne',
                    tag: 'Computed',
                    Descent: [
                        {
                            EphemeraId: 'CascadeOne',
                            tag: 'Computed',
                            key: 'testOne',
                            assets: [],
                            connections: [{
                                EphemeraId: 'CascadeThree',
                                tag: 'Computed',
                                key: 'cascadeOne',
                                assets: [],
                                connections: [{
                                    EphemeraId: 'TestTwo',
                                    tag: 'Computed',
                                    key: 'cascadeThree',
                                    connections: [],
                                    assets: []
                                }]
                            }]
                        },
                        {
                            EphemeraId: 'CascadeTwo',
                            tag: 'Computed',
                            key: 'testOne',
                            assets: [],
                            connections: []
                        }
                    ]
                },
                {
                    type: 'DependencyCascade',
                    targetId: 'TestTwo',
                    tag: 'Computed',
                    Descent: []
                }
            ],
            messageBus: messageBusMock
        })
        expect(transactMock).toHaveBeenCalledTimes(1)
        expect(transactMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(3)
        expect(messageBusMock.send.mock.calls.map(([item]) => (item))).toMatchSnapshot()

    })

    it('should update in parallel and combine cascades', async () => {
        ephemeraDBMock.getItem.mockImplementation(async ({ EphemeraId }) => {
            if (EphemeraId === 'TestOne') {
                return {
                    Ancestry: [{
                        EphemeraId: 'VariableOne',
                        tag: 'Variable',
                        key: 'a',
                        assets: [],
                        connections: []
                    },
                    {
                        EphemeraId: 'VariableTwo',
                        tag: 'Variable',
                        key: 'b',
                        assets: [],
                        connections: []
                    }],
                    src: 'a + b',
                    value: 4
                }
            }
            else {
                return {
                    Ancestry: [],
                    src: '2 * 4',
                    value: 7
                }
            }
        })
        internalCacheMock.AssetState.get.mockImplementation(async (addresses) => (Object.keys(addresses).length ? {
            a: 1,
            b: 2
        }: {}))
        internalCacheMock.AssetState.isOverridden.mockReturnValue(false)
        internalCacheMock.EvaluateCode.get.mockImplementation(async ({ source }) => (source === 'a + b' ? 3 : 8))
        await dependencyCascadeMessage({
            payloads: [
                {
                    type: 'DependencyCascade',
                    targetId: 'TestOne',
                    tag: 'Computed',
                    Descent: [
                        {
                            EphemeraId: 'CascadeOne',
                            tag: 'Computed',
                            key: 'testOne',
                            assets: [],
                            connections: []
                        },
                        {
                            EphemeraId: 'CascadeTwo',
                            tag: 'Computed',
                            key: 'testOne',
                            assets: [],
                            connections: []
                        }
                    ]
                },
                {
                    type: 'DependencyCascade',
                    targetId: 'TestTwo',
                    tag: 'Computed',
                    Descent: [{
                        EphemeraId: 'CascadeOne',
                        tag: 'Computed',
                        key: 'testTwo',
                        assets: [],
                        connections: []
                    }]
                }
            ],
            messageBus: messageBusMock
        })
        expect(transactMock).toHaveBeenCalledTimes(2)
        expect(transactMock.mock.calls[0][0]).toMatchSnapshot()
        expect(transactMock.mock.calls[1][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send.mock.calls.map(([item]) => (item))).toMatchSnapshot()

    })
})