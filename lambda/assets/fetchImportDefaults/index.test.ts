import { fetchImportsMessage } from '.'

jest.mock('../clients')
import { sfnClient } from '../clients'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('./baseClasses')
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

const sfnClientMock = sfnClient as jest.Mocked<typeof sfnClient>
const internalCacheMock = jest.mocked(internalCache, true)

describe('fetchImportsMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.Graph.get.mockResolvedValue(new Graph<string, { key: string }, {}>({
            'ASSET#importTestOne': { key: 'ASSET#importTestOne' },
            'ASSET#importTestTwo': { key: 'ASSET#importTestTwo' },
            'ASSET#importTestThree': { key: 'ASSET#importTestThree' },
            'ASSET#importTestFour': { key: 'ASSET#importTestFour' }
        }, [
            { from: 'ASSET#importTestOne', to: 'ASSET#importTestTwo' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestThree' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestFour' }
        ], {}))
        internalCacheMock.Meta.get.mockResolvedValue([
            { AssetId: 'ASSET#importTestOne', address: { zone: 'Canon', fileName: 'testOne' } },
            { AssetId: 'ASSET#importTestTwo', address: { zone: 'Canon', fileName: 'testTwo' } },
            { AssetId: 'ASSET#importTestThree', address: { zone: 'Canon', fileName: 'testThree' } },
            { AssetId: 'ASSET#importTestFour', address: { zone: 'Canon', fileName: 'testFour' } }
        ])
    })

    it('should pass inheritanceGraph to step function', async () => {
        await fetchImportsMessage({
            payloads: [{
                type: 'FetchImports',
                importsFromAsset: [
                    { assetId: 'ASSET#importTestOne', keys: ['testOne', 'testTwo'] },
                    { assetId: 'ASSET#importTestTwo', keys: ['testThree'] }
                ]
            }],
            messageBus
        })
        expect(JSON.parse((sfnClientMock.send.mock.calls[0][0].input as any).input).inheritanceNodes).toEqual([
            { key: 'ASSET#importTestOne', address: { zone: 'Canon', fileName: 'testOne' } },
            { key: 'ASSET#importTestTwo', address: { zone: 'Canon', fileName: 'testTwo' } },
            { key: 'ASSET#importTestThree', address: { zone: 'Canon', fileName: 'testThree' } },
            { key: 'ASSET#importTestFour', address: { zone: 'Canon', fileName: 'testFour' } }
        ])
        expect(JSON.parse((sfnClientMock.send.mock.calls[0][0].input as any).input).inheritanceEdges).toEqual([
            { from: 'ASSET#importTestOne', to: 'ASSET#importTestTwo' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestThree' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestFour' }
        ])
    })

})