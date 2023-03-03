import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import recursiveFetchImports, { NestedTranslateImportToFinal } from './recursiveFetchImports'

jest.mock('../internalCache')
import internalCache from '../internalCache'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

const internalCacheMock = jest.mocked(internalCache, true)

const testNormalFromWML = (wml: string): NormalForm => {
    const normalizer = new Normalizer()
    normalizer.loadWML(wml)
    return normalizer.normal

}

describe('recursiveFetchImports', () => {
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
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal([], []) })).toEqual([])
    })

    it('should return element and stubs when passed non-import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testNonImport'], []) })).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testImportOne'], []) })).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testNonImportTwo'], []) })).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testImportThree'], []) })).toMatchSnapshot()
    })

})