import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { fetchImportsMessage } from '.'

jest.mock('@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient')
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('../internalCache')
import internalCache from '../internalCache'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

const messageBusMock = jest.mocked(messageBus, true)
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
const internalCacheMock = jest.mocked(internalCache, true)

const testNormalFromWML = (wml: string): NormalForm => {
    const normalizer = new Normalizer()
    normalizer.loadWML(wml)
    return normalizer.normal
}

describe('fetchImportsMessage', () => {
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
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.JSONFile.get.mockImplementation(async (assetId: string) => {
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
            }
            return {
                normal,
                namespaceIdToDB: {}
            }
        })
    })

    it('should return empty when passed no keys', async () => {
        await fetchImportsMessage({ messageBus: messageBusMock, payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: [] }] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImportsMessage({ messageBus: messageBusMock, payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['testNonImport'] }] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImportsMessage({ messageBus: messageBusMock, payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['testImportOne'] }] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImportsMessage({ messageBus: messageBusMock, payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['testNonImportTwo'] }] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImportsMessage({ messageBus: messageBusMock, payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['testImportThree'] }] }] })
        expect(JSON.parse(apiClientMock.send.mock.calls[0][0].Data)).toMatchSnapshot()
    })

})