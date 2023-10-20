import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { fetchImports } from '.'

jest.mock('../clients')
import { apiClient } from '../clients'
jest.mock('./baseClasses')
import { FetchImportsJSONHelper } from './baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace'

const apiClientMock = apiClient as jest.Mocked<typeof apiClient>

const testNormalFromWML = (wml: string): NormalForm => {
    const normalizer = new Normalizer()
    normalizer.loadWML(wml)
    return normalizer.normal
}

describe('fetchImports', () => {
    const testFinal = testNormalFromWML(`<Asset key=(testFinal)>
        <Room key=(testNonImport)>
            <Description>
                DescriptionOne
            </Description>
            <Exit to=(testNonImportStub)>test exit</Exit>
        </Room>
        <Room key=(testNonImportStub)>
            <Name>StubOne</Name>
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
            <Use type="Room" key=(testImportOne) />
            <Use type="Room" key=(testImportStubOne) />
            <Use type="Room" key=(testImportFoo) as=(testImportTwo) />
        </Import>
        <Import from=(testImportAssetTwo)>
            <Use type="Room" key=(basic) as=(testImportThree) />
        </Import>
        <Room key=(testFeatures)>
            <Description>
                <Link to=(featureImport)>Test</Link>
            </Description>
        </Room>
        <Import from=(testImportAssetFour)>
            <Use type="Feature" key=(testFeature) as=(featureImport) />
            <Use type="Room" key=(testRoomWithFeatures) />
        </Import>
    </Asset>`)
    const testImportOne = testNormalFromWML(`<Asset key=(testImportAssetOne)>
        <Room key=(testImportOne)>
            <Description>
                One
            </Description>
        </Room>
        <Room key=(testImportStubOne)>
            <Name>StubTwo</Name>
        </Room>
        <Room key=(testImportFoo)>
            <Name>StubFoo</Name>
            <Description>
                Foo
            </Description>
        </Room>
    </Asset>`)
    const testImportTwo = testNormalFromWML(`<Asset key=(testImportAssetTwo)>
        <Room key=(basic)>
            <Description>
                Asset Two
            </Description>
            <Exit to=(stub)>test exit</Exit>
        </Room>
        <Room key=(stub) />
        <Import from=(testImportAssetThree)>
            <Use type="Room" key=(basicTwo) as=(stub) />
            <Use type="Room" key=(basicOne) as=(basic) />
        </Import>
    </Asset>`)
    const testImportThree = testNormalFromWML(`<Asset key=(testImportAssetThree)>
        <Room key=(basicOne)>
            <Exit to=(stub)>test exit</Exit>
        </Room>
        <Room key=(basicTwo)><Name>Asset Three</Name></Room>
        <Room key=(stub)><Name>AssetThreeStub</Name></Room>
    </Asset>`)
    const testImportFour = testNormalFromWML(`<Asset key=(testImportAssetFour)>
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
        jest.spyOn(FetchImportsJSONHelper.prototype, 'get').mockImplementation(async (assetId: string) => {
            let normal: NormalForm = {}
            switch(assetId) {
                case 'ASSET#testFinal':
                    normal = testFinal
                    break
                case 'ASSET#testImportAssetOne':
                    normal = testImportOne
                    break
                case 'ASSET#testImportAssetTwo':
                    normal = testImportTwo
                    break
                case 'ASSET#testImportAssetThree':
                    normal = testImportThree
                    break
                case 'ASSET#testImportAssetFour':
                    normal = testImportFour
                    break
            }
            return {
                normal,
                namespaceIdToDB: []
            }
        })
    })

    it('should return empty when passed no keys', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: [] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testNonImport'] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testImportOne'] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testNonImportTwo'] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testImportThree'] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should properly stub out features in room description', async () => {
        await fetchImports({ ConnectionId: '123', RequestId: '456', inheritanceGraph, payloads: [{ assetId: 'ASSET#testFinal', keys: ['testRoomWithFeatures'] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

})