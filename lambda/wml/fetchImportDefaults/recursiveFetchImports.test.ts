import recursiveFetchImports from './recursiveFetchImports'

import { FetchImportsJSONHelper } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { stripImportAndExport } from './utils'

const jsonHelperMock = (assets: StandardForm[]): jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>> => ({
    get: jest.fn().mockImplementation(async (assetId: string): Promise<StandardForm> => {
        const assetById = assets.find((asset) => (asset.key === assetId.split('#').slice(1)[0]))
        if (!assetById) {
            throw new Error('jsonHelperMock failure')
        }
        return assetById
    })
} as unknown as jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>>)

const testResult = async (...args: Parameters<typeof recursiveFetchImports>) => (schemaToWML([stripImportAndExport(await recursiveFetchImports(...args)).schema]))

describe('recursiveFetchImports', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty when passed no keys', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset key=(testFinal)>
                    <Room key=(testNonImport)>
                        <Description>
                            DescriptionOne
                        </Description>
                        <Exit to=(testNonImportStub)>test exit</Exit>
                    </Room>
                    <Room key=(testNonImportStub)>
                        <ShortName>StubOne</ShortName>
                    </Room>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: [], stubKeys: [] })).toEqual(deIndentWML(`
            <Asset key=(testFinal) />
        `))
    })

    it('should return element and stubs when passed non-import key', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset key=(testFinal)>
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
                    <Import from=(testImportAssetOne)>
                        <Room key=(testImportOne) />
                        <Room key=(testImportStubOne) />
                    </Import>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testNonImport'], stubKeys: []  })).toEqual(deIndentWML(`
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
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset key=(testFinal)>
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
                    <Import from=(testImportAsset)>
                        <Room key=(testImportOne) />
                        <Room key=(testImportStubOne) />
                        <Room key=(testImportFoo) as=(testImportTwo) />
                    </Import>
                </Asset>
            `),
            new StandardForm(`
                <Asset key=(testImportAsset)>
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
                </Asset>
            `)])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testImportOne'], stubKeys: [] }))
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
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset key=(testFinal)>
                    <Room key=(testImport) />
                    <Room key=(testNonImport)>
                        <Exit to=(testImport)>test exit</Exit>
                    </Room>
                    <Import from=(testImportAsset)>
                        <Room key=(testImportFoo) as=(testImport) />
                    </Import>
                </Asset>
            `),
            new StandardForm(`<Asset key=(testImportAsset)>
                <Room key=(testImportFoo)>
                    <ShortName>StubFoo</ShortName>
                    <Description>
                        Foo
                    </Description>
                </Room>
            </Asset>`)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testNonImport'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(testImport)><ShortName>StubFoo</ShortName></Room>
                    <Room key=(testNonImport)><Exit to=(testImport)>test exit</Exit></Room>
                </Asset>
            `))
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset key=(testFinal)>
                    <Room key=(testImport) />
                    <Import from=(testImportAssetOne)>
                        <Room key=(basic) as=(testImport) />
                    </Import>
                </Asset>
            `),
            new StandardForm(`
                <Asset key=(testImportAssetOne)>
                    <Room key=(basic)>
                        <Description>
                            Asset One
                        </Description>
                        <Exit to=(Stub1)>test exit one</Exit>
                    </Room>
                    <Room key=(Stub1) />
                    <Import from=(testImportAssetTwo)>
                        <Room key=(basicTwo) as=(Stub1) />
                        <Room key=(basicOne) as=(basic) />
                    </Import>
                </Asset>
            `),
            new StandardForm(`
                <Asset key=(testImportAssetTwo)>
                    <Room key=(basicOne)>
                        <Exit to=(Stub1)>test exit two</Exit>
                    </Room>
                    <Room key=(basicTwo)><ShortName>Asset Two</ShortName></Room>
                    <Room key=(Stub1)><ShortName>AssetTwoStub</ShortName></Room>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testImport'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(Stub1)><ShortName>Asset Two</ShortName></Room>
                    <Room key=(Stub2)><ShortName>AssetTwoStub</ShortName></Room>
                    <Room key=(testImport)>
                        <Description>Asset One</Description>
                        <Exit to=(Stub2)>test exit two</Exit>
                        <Exit to=(Stub1)>test exit one</Exit>
                    </Room>
                </Asset>
            `))
    })

    it('should properly stub out features in room description', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`<Asset key=(testFinal)>
                <Import from=(testImport)>
                    <Feature key=(testFeature) as=(featureImport) />
                    <Room key=(testRoomWithFeatures) />
                </Import>
            </Asset>`),
            new StandardForm(`<Asset key=(testImport)>
                <Feature key=(testFeature)>
                    <Description>Feature test</Description>
                </Feature>
                <Room key=(testRoomWithFeatures)>
                    <Description><Link to=(testFeature)>Test</Link></Description>
                </Room>
            </Asset>`)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['testRoomWithFeatures'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset key=(testFinal)>
                    <Room key=(testRoomWithFeatures)>
                        <Description><Link to=(featureImport)>Test</Link></Description>
                    </Room>
                    <Feature key=(featureImport) />
                </Asset>
            `))
    })

})