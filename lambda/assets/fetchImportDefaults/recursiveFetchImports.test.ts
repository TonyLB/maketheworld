jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})
import recursiveFetchImports from './recursiveFetchImports'

import { FetchImportsJSONHelper } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

const jsonHelperMock = (assets: StandardForm[]): jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>> => ({
    get: jest.fn().mockImplementation(async (assetId: string): Promise<StandardForm> => {
        const assetById = assets.find((asset) => (asset.universalKey === assetId))
        if (!assetById) {
            throw new Error('jsonHelperMock failure')
        }
        return assetById
    })
} as unknown as jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>>)

const testResult = async (...args: Parameters<typeof recursiveFetchImports>) => (schemaToWML([(await recursiveFetchImports(...args)).schema]))

//
// Prefer <Situation uuid=(DEFAULT)> for room prose (Gate D). Exception: "should properly stub out features"
// — provisional until SituationFacet prose raises Link references for nested import traversal (same as index.test.ts).
//

describe('recursiveFetchImports', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return empty when passed no keys', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(testNonImport)>
                        <Situation uuid=(DEFAULT)>
                            <Description>DescriptionOne</Description>
                        </Situation>
                        <Exit to=(testNonImportStub)>test exit</Exit>
                    </Room>
                    <Room uuid=(testNonImportStub)>
                        <ShortName>StubOne</ShortName>
                    </Room>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: [], stubKeys: [] })).toEqual(deIndentWML(`
            <Asset uuid=(testFinal) />
        `))
    })

    it('should return element and stubs when passed non-import key', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(testNonImport) key=(testNonImport)>
                        <Situation uuid=(DEFAULT)>
                            <Description>DescriptionOne</Description>
                        </Situation>
                        <Exit to=(ROOM#testNonImportStub)>test exit</Exit>
                    </Room>
                    <Room uuid=(testNonImportStub)>
                        <ShortName>StubOne</ShortName>
                    </Room>
                    <Room uuid=(testImportOne) from=(ASSET#testImportAssetOne)>
                        <Situation uuid=(DEFAULT)>
                            <Description>Two</Description>
                        </Situation>
                        <Exit to=(ROOM#testImportStubOne)>test exit one</Exit>
                    </Room>
                    <Room uuid=(testImportStubOne) from=(ASSET#testImportAssetOne) />
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['ROOM#testNonImport'], stubKeys: []  })).toEqual(deIndentWML(`
            <Asset uuid=(testFinal)>
                <Room uuid=(testNonImportStub) origin=(ASSET#testFinal)>
                    <ShortName>StubOne</ShortName>
                </Room>
                <Room uuid=(testNonImport) key=(testNonImport) origin=(ASSET#testFinal)>
                    <Situation uuid=(DEFAULT) origin=(ASSET#testFinal) ref={0} />
                    <Situation uuid=(DEFAULT)>
                        <Description>DescriptionOne</Description>
                    </Situation>
                    <Exit to=(ROOM#testNonImportStub)>test exit</Exit>
                </Room>
            </Asset>
        `))
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(testImportOne) key=(testImportOne) from=(ASSET#testImportAsset)>
                        <Situation uuid=(DEFAULT)>
                            <Description>
                                Two
                            </Description>
                        </Situation>
                        <Exit to=(ROOM#testImportStubOne)>test exit one</Exit>
                    </Room>
                    <Room uuid=(testImportStubOne) from=(ASSET#testImportAsset) />
                    <Room uuid=(testImportTwo) from=(ASSET#testImportAsset) />
                    <Room uuid=(testNonImportTwo)>
                        <Exit to=(ROOM#testImportTwo)>test exit</Exit>
                    </Room>
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAsset)>
                    <Room uuid=(testImportOne)>
                        <Situation uuid=(DEFAULT)>
                            <Description>One</Description>
                        </Situation>
                    </Room>
                    <Room uuid=(testImportStubOne)>
                        <ShortName>StubTwo</ShortName>
                    </Room>
                    <Room uuid=(testImportFoo)>
                        <ShortName>StubFoo</ShortName>
                        <Situation uuid=(DEFAULT)>
                            <Description>Foo</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['ROOM#testImportOne'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset uuid=(testFinal)>
                    <Room
                        uuid=(testImportStubOne)
                        origin=(ASSET#testImportAsset,ASSET#testFinal)
                    >
                        <ShortName>StubTwo</ShortName>
                    </Room>
                    <Room
                        uuid=(testImportOne)
                        key=(testImportOne)
                        origin=(ASSET#testImportAsset,ASSET#testFinal)
                    >
                        <Situation
                            uuid=(DEFAULT)
                            origin=(ASSET#testImportAsset,ASSET#testFinal)
                            ref={0}
                        />
                        <Situation uuid=(DEFAULT) ref={2}>
                            <Description>OneTwo</Description>
                        </Situation>
                        <Exit to=(ROOM#testImportStubOne)>test exit one</Exit>
                    </Room>
                </Asset>
            `))
    })

    it('should import multilevel', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(testImport) key=(testImport) from=(ASSET#testImportAssetOne) />
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAssetOne)>
                    <Room uuid=(testImport) from=(ASSET#testImportAssetTwo)>
                        <Situation uuid=(DEFAULT)>
                            <Description>
                                Asset One
                            </Description>
                        </Situation>
                        <Exit to=(Stub)>test exit one</Exit>
                    </Room>
                    <Room uuid=(Stub1) key=(Stub)><ShortName>Asset One</ShortName></Room>
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAssetTwo)>
                    <Room uuid=(testImport) key=(testImport)>
                        <Exit to=(Stub)>test exit two</Exit>
                    </Room>
                    <Room uuid=(Stub2) key=(Stub)><ShortName>Asset Two</ShortName></Room>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['ROOM#testImport'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(Stub1) origin=(ASSET#testImportAssetOne) ref={0}>
                        <ShortName>Asset One</ShortName>
                    </Room>
                    <Room uuid=(Stub2) origin=(ASSET#testImportAssetTwo) ref={0}>
                        <ShortName>Asset Two</ShortName>
                    </Room>
                    <Room
                        uuid=(testImport)
                        key=(testImport)
                        origin=(ASSET#testImportAssetTwo,ASSET#testImportAssetOne,ASSET#testFinal)
                    >
                        <Situation uuid=(DEFAULT) origin=(ASSET#testImportAssetOne) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <Description>Asset One</Description>
                        </Situation>
                        <Exit to=(ROOM#Stub2)>test exit two</Exit>
                        <Exit to=(ROOM#Stub1)>test exit one</Exit>
                    </Room>
                </Asset>
            `))
    })

    //
    // Provisional — Room-hosted Example + Link until SituationFacet prose exposes Link refs for subset (see index.test.ts).
    //
    it('should properly stub out features in room description', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`<Asset uuid=(testFinal)>
                <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures) from=(ASSET#testImport) />
            </Asset>`),
            new StandardForm(`<Asset uuid=(testImport)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(DEFAULT)>
                        <Description>Feature test</Description>
                    </Situation>
                </Feature>
                <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures)>
                    <Example ref={0} uuid=(testRoomBase)>
                        <Description><Link to=(testFeature)>Test</Link></Description>
                    </Example>
                </Room>
            </Asset>`)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['ROOM#testRoomWithFeatures'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset uuid=(testFinal)>
                    <Example uuid=(testRoomBase) origin=(ASSET#testImport) ref={0}>
                        <Description><Link to=(FEATURE#testFeature)>Test</Link></Description>
                    </Example>
                    <Feature uuid=(testFeature) origin=(ASSET#testImport) ref={0} />
                    <Room
                        uuid=(testRoomWithFeatures)
                        key=(testRoomWithFeatures)
                        origin=(ASSET#testImport,ASSET#testFinal)
                    />
                </Asset>
            `))
    })

    it('should handle imported components with their own deep inheritance chains', async () => {
        const jsonHelper = jsonHelperMock([
            new StandardForm(`
                <Asset uuid=(testFinal)>
                    <Room uuid=(testImportRoom) key=(testImportRoom) from=(ASSET#testImportAssetC) />
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAssetC)>
                    <Room uuid=(testImportRoom)>
                        <Exit to=(ROOM#testImportRoomStub)>test exit</Exit>
                    </Room>
                    <Room uuid=(testImportRoomStub) from=(ASSET#testImportAssetB) />
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAssetB)>
                    <Room uuid=(testImportRoomStub) from=(ASSET#testImportAssetA) />
                </Asset>
            `),
            new StandardForm(`
                <Asset uuid=(testImportAssetA)>
                    <Room uuid=(testImportRoomStub)>
                        <ShortName>Deep Ancestor Room</ShortName>
                    </Room>
                </Asset>
            `)
        ])
        expect(await testResult({ assetId: 'ASSET#testFinal', jsonHelper, fullKeys: ['ROOM#testImportRoom'], stubKeys: [] }))
            .toEqual(deIndentWML(`
                <Asset uuid=(testFinal)>
                    <Room
                        uuid=(testImportRoomStub)
                        origin=(ASSET#testImportAssetA,ASSET#testImportAssetB,ASSET#testImportAssetC)
                        ref={0}
                    >
                        <ShortName>Deep Ancestor Room</ShortName>
                    </Room>
                    <Room
                        uuid=(testImportRoom)
                        key=(testImportRoom)
                        origin=(ASSET#testImportAssetC,ASSET#testFinal)
                    >
                        <Exit to=(ROOM#testImportRoomStub)>test exit</Exit>
                    </Room>
                </Asset>
            `))
    })

})