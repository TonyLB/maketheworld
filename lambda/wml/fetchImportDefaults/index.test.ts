import Normalizer from '@tonylb/mtw-wml/ts/normalize'
import { fetchImports } from '.'

jest.mock('../clients')
import { snsClient } from '../clients'
jest.mock('./baseClasses')
import { FetchImportsJSONHelper } from './baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'
import { SerializableStandardForm } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>

const testStandardFromWML = (wml: string): SerializableStandardForm => {
    const schema = new Schema()
    schema.loadWML(wml)
    const standardizer = new Standardizer(schema.schema)
    return standardizer.stripped
}

describe('fetchImports', () => {
    const testFinal = testStandardFromWML(`<Asset key=(testFinal)>
        <Room key=(testNonImport)>
            <Description>
                DescriptionOne
            </Description>
            <Exit to=(testNonImportStub)>test exit</Exit>
        </Room>
        <Room key=(testNonImportStub)>
            <ShortName>StubOne</ShortName>
        </Room>
        <Room key=(testImportOne)>
            <Description>
                Two
            </Description>
            <Exit to=(testImportStubOne)>test exit one</Exit>
        </Room>
        <Room key=(testImportStubOne) />
        <Room key=(testImportTwo) />
        <Room key=(testNonImportTwo)>
            <Exit to=(testImportTwo)>test exit</Exit>
        </Room>
        <Room key=(testImportThree) />
        <Import from=(testImportAssetOne)>
            <Room key=(testImportOne) />
            <Room key=(testImportStubOne) />
            <Room key=(testImportTwo) from=(testImportFoo) />
        </Import>
        <Import from=(testImportAssetTwo)>
            <Room key=(testImportThree) from=(basic) />
        </Import>
        <Room key=(testFeatures)>
            <Description>
                <Link to=(featureImport)>Test</Link>
            </Description>
        </Room>
        <Import from=(testImportAssetFour)>
            <Feature key=(featureImport) from=(testFeature) />
            <Room key=(testRoomWithFeatures) />
        </Import>
    </Asset>`)
    const testImportOne = testStandardFromWML(`<Asset key=(testImportAssetOne)>
        <Room key=(testImportOne)>
            <Description>
                One
            </Description>
        </Room>
        <Room key=(testImportStubOne)>
            <ShortName>StubTwo</ShortName>
        </Room>
        <Room key=(testImportFoo)>
            <ShortName>StubFoo</ShortName>
            <Description>
                Foo
            </Description>
        </Room>
    </Asset>`)
    const testImportTwo = testStandardFromWML(`<Asset key=(testImportAssetTwo)>
        <Room key=(basic)>
            <Description>
                Asset Two
            </Description>
            <Exit to=(stub)>test exit</Exit>
        </Room>
        <Room key=(stub) />
        <Import from=(testImportAssetThree)>
            <Room key=(stub) from=(basicTwo) />
            <Room key=(basic) from=(basicOne) />
        </Import>
    </Asset>`)
    const testImportThree = testStandardFromWML(`<Asset key=(testImportAssetThree)>
        <Room key=(basicOne)>
            <Exit to=(stub)>test exit</Exit>
        </Room>
        <Room key=(basicTwo)><ShortName>Asset Three</ShortName></Room>
        <Room key=(stub)><ShortName>AssetThreeStub</ShortName></Room>
    </Asset>`)
    const testImportFour = testStandardFromWML(`<Asset key=(testImportAssetFour)>
        <Feature key=(testFeature)>
            <Description>Feature test</Description>
        </Feature>
        <Room key=(testRoomWithFeatures)>
            <Description><Link to=(testFeature)>Test</Link></Description>
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
            let standard: SerializableStandardForm = { key: '', tag: 'Asset', byId: {}, metaData: [] }
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
            return {
                standard,
                namespaceIdToDB: []
            }
        })
    })

    it('should return empty when passed no keys', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: [] }] })
        console.log(`clientMock: ${JSON.stringify(snsClientMock.send.mock.calls[0][0], null, 4)}`)
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testNonImport'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testImportOne'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testNonImportTwo'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testImportThree'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should properly stub out features in room description', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testRoomWithFeatures'] }] })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

})