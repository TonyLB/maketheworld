import recursiveFetchImports, { NestedTranslateImportToFinal } from './recursiveFetchImports'

import { FetchImportsJSONHelper } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('recursiveFetchImports', () => {
    const testFinal = new StandardForm(`<Asset key=(testFinal)>
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
    const testImportOne = new StandardForm(`<Asset key=(testImportAssetOne)>
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
    const testImportTwo = new StandardForm(`<Asset key=(testImportAssetTwo)>
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
    const testImportThree = new StandardForm(`<Asset key=(testImportAssetThree)>
        <Room key=(basicOne)>
            <Exit to=(stub)>test exit</Exit>
        </Room>
        <Room key=(basicTwo)><ShortName>Asset Three</ShortName></Room>
        <Room key=(stub)><ShortName>AssetThreeStub</ShortName></Room>
    </Asset>`)
    const testImportFour = new StandardForm(`<Asset key=(testImportAssetFour)>
        <Feature key=(testFeature)>
            <Description>Feature test</Description>
        </Feature>
        <Room key=(testRoomWithFeatures)>
            <Description><Link to=(testFeature)>Test</Link></Description>
        </Room>
    </Asset>`)
    const jsonHelper: jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>> = {
        get: jest.fn()
    } as unknown as jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>>
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jsonHelper.get.mockImplementation(async (assetId: string) => {
            let standard: StandardForm = new StandardForm('Test')
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
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: [], stubKeys: [] })).schema])).toEqual(deIndentWML(`
            <Asset key=(testFinal) />
        `))
    })

    it('should return element and stubs when passed non-import key', async () => {
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testNonImport'], stubKeys: []  })).schema])).toEqual(deIndentWML(`
            <Asset key=(testFinal)>
                <Room key=(testNonImport)>
                    <Description>DescriptionOne</Description>
                    <Exit to=(testNonImportStub)>test exit</Exit>
                </Room>
                <Room key=(testNonImportStub)><ShortName>StubOne</ShortName></Room>
            </Asset>
        `))
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testImportOne'], stubKeys: [] })).schema]))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(testImportOne)>
                        <Description>OneTwo</Description>
                        <Exit to=(testImportStubOne)>test exit one</Exit>
                    </Room>
                    <Room key=(testImportStubOne)><ShortName>StubTwo</ShortName></Room>
                </Asset>
            `))
    })

    it('should follow dynamic renames in imports', async () => {
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testNonImportTwo'], stubKeys: [] })).schema]))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(testImportTwo)><ShortName>StubFoo</ShortName></Room>
                    <Room key=(testNonImportTwo)>
                        <Exit to=(testImportTwo)>test exit</Exit>
                    </Room>
                </Asset>
            `))
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testImportThree'], stubKeys: [] })).schema]))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(stub1)><ShortName>AssetThreeStub</ShortName></Room>
                    <Room key=(stub2)><ShortName>AssetThree</ShortName</Room>
                    <Room key=(testImportThree)>
                        <Description>Asset Two</Description>
                        <Exit to=(stub1)>test exit</Exit>
                        <Exit to=(stub2)>test exit</Exit>
                    </Room>
                </Asset>
            `))
    })

    it('should properly stub out features in room description', async () => {
        expect(schemaToWML([(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testRoomWithFeatures'], stubKeys: [] })).schema]))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(testRoomWithFeatures)>
                        <Description><Link to=(testFeature)>Test</Link></Description>
                    </Room>
                    <Feature key=(testFeature) />
                </Asset>
            `))
    })

})