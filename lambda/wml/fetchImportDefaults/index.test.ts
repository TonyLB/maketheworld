import { fetchImports } from '.'

jest.mock('../clients')
import { snsClient } from '../clients'
jest.mock('./baseClasses')
import { FetchImportsJSONHelper } from './baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>

describe('fetchImports', () => {
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
    const inheritanceGraph = new Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}>(
        {
            'ASSET#testImportAssetOne': { key: 'ASSET#testImportAssetOne', address: { zone: 'Canon', fileName: 'testOne' }},
            'ASSET#testImportAssetTwo': { key: 'ASSET#testImportAssetTwo', address: { zone: 'Canon', fileName: 'testTwo' }},
            'ASSET#testImportAssetThree': { key: 'ASSET#testImportAssetThree', address: { zone: 'Canon', fileName: 'testThree' }},
            'ASSET#testImportAssetFour': { key: 'ASSET#testImportAssetFour', address: { zone: 'Canon', fileName: 'testFour' }},
            'ASSET#testFinal': { key: 'ASSET#testFinal', address: { zone: 'Canon', fileName: 'testFinal' }}
        },
        [
            { from: 'ASSET#testFinal', to: 'ASSET#testImportAssetOne' },
            { from: 'ASSET#testFinal', to: 'ASSET#testImportAssetTwo' },
            { from: 'ASSET#testFinal', to: 'ASSET#testImportAssetFour' },
            { from: 'ASSET#testImportAssetTwo', to: 'ASSET#testImportAssetThree' }
        ],
        { address: {} as any }
    )
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
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
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: [] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImport'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportOne'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImportTwo'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportThree'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should properly stub out features in room description', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testRoomWithFeatures'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

})