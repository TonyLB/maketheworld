jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB, multiTableTransactWrite, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

import dependencyCascadeMessage from './dependencyCascade'
import { DependencyNode } from '../internalCache/baseClasses'
import { extractTree } from '../internalCache/dependencyGraph'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const internalCacheMock = jest.mocked(internalCache, true)
const transactMock = multiTableTransactWrite as jest.Mock
const exponentialBackoffMock = exponentialBackoffWrapper as jest.Mock

describe('DependencyCascadeMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        exponentialBackoffMock.mockImplementation(async (func) => { await func() })
    })

    it('should update a computed item and cascade', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            src: 'a + b',
            value: 4
        })
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo'
        })
        internalCacheMock.AssetState.get.mockResolvedValue({
            a: 1,
            b: 2
        })
        internalCacheMock.AssetState.isOverridden.mockReturnValue(false)
        internalCacheMock.EvaluateCode.get.mockResolvedValue(3)
        internalCacheMock.Descent.generationOrder.mockReturnValue([['COMPUTED#TestOne'], ['COMPUTED#TestTwo']])
        const testDescent: DependencyNode[] = [
            {
                EphemeraId: 'COMPUTED#TestOne',
                completeness: 'Partial',
                connections: [
                    { EphemeraId: 'COMPUTED#CascadeOne', key: 'testOne', assets: ['base'] },
                    { EphemeraId: 'COMPUTED#CascadeTwo', key: 'testOne', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'COMPUTED#CascadeOne',
                completeness: 'Partial',
                connections: [{
                    EphemeraId: 'COMPUTED#CascadeThree',
                    key: 'cascadeOne',
                    assets: ['base'],
                }]
            },
            {
                EphemeraId: 'COMPUTED#CascadeTwo',
                completeness: 'Partial',
                connections: []
            },
            {
                EphemeraId: 'COMPUTED#CascadeThree',
                completeness: 'Partial',
                connections: [{
                    EphemeraId: 'COMPUTED#TestTwo',
                    key: 'cascadeThree',
                    assets: ['base']
                }]
            },
            {
                EphemeraId: 'COMPUTED#TestTwo',
                completeness: 'Partial',
                connections: []
            }
        ]
        internalCacheMock.Descent.getBatch.mockResolvedValue(testDescent)
        internalCacheMock.Descent.getPartial.mockImplementation((targetId) => (extractTree(testDescent, targetId)))
        await dependencyCascadeMessage({
            payloads: [
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestOne' },
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestTwo' }
            ],
            messageBus: messageBusMock
        })
        expect(transactMock).toHaveBeenCalledTimes(1)
        expect(transactMock.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(4)
        expect(messageBusMock.send.mock.calls.map(([item]) => (item))).toMatchSnapshot()

    })

    it('should update in parallel and combine cascades', async () => {
        ephemeraDBMock.getItem.mockImplementation(async ({ EphemeraId }) => {
            if (EphemeraId === 'COMPUTED#TestOne') {
                return {
                    src: 'a + b',
                    value: 4
                }
            }
            else {
                return {
                    src: '2 * 4',
                    value: 7
                }
            }
        })
        internalCacheMock.AssetMap.get.mockImplementation(async (EphemeraId) => (EphemeraId === 'COMPUTED#TestOne' ? {
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo'
        }: {} as any))
        internalCacheMock.AssetState.get.mockImplementation(async (addresses) => (Object.keys(addresses).length ? {
            a: 1,
            b: 2
        }: {}))
        internalCacheMock.AssetState.isOverridden.mockReturnValue(false)
        internalCacheMock.EvaluateCode.get.mockImplementation(async ({ source }) => (source === 'a + b' ? 3 : 8))
        internalCacheMock.Descent.generationOrder.mockReturnValue([['COMPUTED#TestOne', 'COMPUTED#TestTwo']])
        const testDescent: DependencyNode[] = [
            {
                EphemeraId: 'COMPUTED#TestOne',
                completeness: 'Partial',
                connections: [
                    { EphemeraId: 'COMPUTED#CascadeOne', key: 'testOne', assets: ['base'] },
                    { EphemeraId: 'COMPUTED#CascadeTwo', key: 'testOne', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'COMPUTED#CascadeOne',
                completeness: 'Partial',
                connections: []
            },
            {
                EphemeraId: 'COMPUTED#CascadeTwo',
                completeness: 'Partial',
                connections: []
            },
            {
                EphemeraId: 'COMPUTED#TestTwo',
                completeness: 'Partial',
                connections: [
                    { EphemeraId: 'COMPUTED#CascadeOne', key: 'testTwo', assets: ['base'] }
                ]
            }
        ]
        internalCacheMock.Descent.getBatch.mockResolvedValue(testDescent)
        internalCacheMock.Descent.getPartial.mockImplementation((targetId) => (extractTree(testDescent, targetId)))
        await dependencyCascadeMessage({
            payloads: [
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestOne' },
                { type: 'DependencyCascade', targetId: 'COMPUTED#TestTwo' }
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