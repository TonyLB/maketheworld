import { fetchImportsMessage } from '.'

jest.mock('../clients')
import { snsClient } from '../clients'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('./baseClasses')
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import { FetchImportsJSONHelper } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

describe('fetchImportsMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        const testFinal = new StandardForm(`<Asset key=(testFinal)>
            <Room uuid=(testNonImport) key=(testNonImport)>
                <Example uuid=(testNonImportExample)>
                    <Description>
                        DescriptionOne
                    </Description>
                </Example>
                <Exit to=(testNonImportStub)>test exit</Exit>
            </Room>
            <Room uuid=(testNonImportStub) key=(testNonImportStub)>
                <ShortName>StubOne</ShortName>
            </Room>
            <Room uuid=(testImportOne) key=(testImportOne) from=(ASSET#testImportAssetOne)>
                <Example uuid=(testImportOneExample)>
                    <Description>
                        Two
                    </Description>
                </Example>
                <Exit to=(testImportStubOne)>test exit one</Exit>
            </Room>
            <Room uuid=(testImportStubOne) key=(testImportStubOne)  from=(ASSET#testImportAssetOne) />
            <Room uuid=(testImportFoo) key=(testImportFoo) from=(ASSET#testImportAssetOne) />
            <Room uuid=(testImportTwo) key=(testImportTwo) />
            <Room uuid=(testNonImportTwo) key=(testNonImportTwo)>
                <Exit to=(testImportFoo)>test exit</Exit>
            </Room>
            <Room uuid=(testImportThree) key=(testImportThree) from=(ASSET#testImportAssetTwo) />
            <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures) from=(ASSET#testImportAssetFour)>
                <Example uuid=(testRoomWithFeaturesExample)>
                    <Description>
                        <Link to=(featureImport)>Test</Link>
                    </Description>
                </Example>
            </Room>
            <Feature uuid=(testFeature) key=(featureImport) from=(ASSET#testImportAssetFour) />
        </Asset>`)
        const testImportOne = new StandardForm(`<Asset key=(testImportAssetOne)>
            <Room uuid=(testImportOne)>
                <Example uuid=(testImportOneExample)>
                    <Description>
                        One
                    </Description>
                </Example>
            </Room>
            <Room uuid=(testImportStubOne)>
                <ShortName>StubTwo</ShortName>
            </Room>
            <Room uuid=(testImportFoo)>
                <ShortName>StubFoo</ShortName>
                <Example uuid=(testImportFooExample)>
                    <Description>
                        Foo
                    </Description>
                </Example>
            </Room>
        </Asset>`)
        const testImportTwo = new StandardForm(`<Asset key=(testImportAssetTwo)>
            <Room uuid=(testImportThree) key=(basic) from=(ASSET#testImportAssetThree)>
                <Example uuid=(testImportTwoExample)>
                    <Description>
                        Asset Two
                    </Description>
                </Example>
                <Exit to=(stub)>test exit</Exit>
            </Room>
            <Room uuid=(testStubOne) key=(stub) from=(ASSET#testImportAssetThree) />
        </Asset>`)
        const testImportThree = new StandardForm(`<Asset key=(testImportAssetThree)>
            <Room uuid=(testImportThree) key=(basicOne)>
                <Exit to=(stub)>test exit</Exit>
            </Room>
            <Room uuid=(testStubOne) key=(basicTwo)>
                <ShortName>Asset Three</ShortName>
            </Room>
            <Room uuid=(stub) key=(stub)>
                <ShortName>AssetThreeStub</ShortName>
            </Room>
        </Asset>`)
        const testImportFour = new StandardForm(`<Asset key=(testImportAssetFour)>
            <Feature uuid=(testFeature) key=(featureImport)>
                <Example uuid=(testFeatureExample)>
                    <Description>Feature test</Description>
                </Example>
            </Feature>
            <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures)>
                <Example uuid=(testRoomWithFeaturesExample)>
                    <Description><Link to=(testFeature)>Test</Link></Description>
                </Example>
            </Room>
        </Asset>`)
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
        jest.spyOn(FetchImportsJSONHelper.prototype, 'get').mockImplementation(async (assetId: `ASSET#${string}`) => {
            let standard: StandardForm = new StandardForm('test')
            switch(assetId) {
                case 'ASSET#testFinal':
                    standard = testFinal
                    break
                case 'ASSET#testImportAssetOne':
                    standard = testImportOne
                    break
                case 'ASSET#testImportAssetTwo':
                    standard = testImportTwo
                    break
                case 'ASSET#testImportAssetThree':
                    standard = testImportThree
                    break
                case 'ASSET#testImportAssetFour':
                    standard = testImportFour
                    break
            }
            return standard
        })
    })

    it('should return empty when passed no keys', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: [] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImport'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportOne'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImportTwo'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportThree'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should properly stub out features in room description', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testRoomWithFeatures'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

})