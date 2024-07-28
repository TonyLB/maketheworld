import recursiveFetchImports, { NestedTranslateImportToFinal } from './recursiveFetchImports'

import { FetchImportsJSONHelper } from './baseClasses'
import { SerializableStandardForm } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'

const testStandardFromWML = (wml: string): SerializableStandardForm => {
    const schema = new Schema()
    schema.loadWML(wml)
    const standardizer = new Standardizer(schema.schema)
    return standardizer.stripped
}

describe('recursiveFetchImports', () => {
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
    const jsonHelper: jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>> = {
        get: jest.fn()
    } as unknown as jest.Mocked<InstanceType<typeof FetchImportsJSONHelper>>
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jsonHelper.get.mockImplementation(async (assetId: string) => {
            let standard: SerializableStandardForm = { key: 'Test', tag: 'Asset', byId: {}, metaData: [] }
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
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal([], []) })).toEqual([])
    })

    it('should return element and stubs when passed non-import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal(['testNonImport'], []) })).toEqual([
            { 
                data: { tag: 'Room', key: 'testNonImport' },
                children: [
                    { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'DescriptionOne' }, children: [] }]},
                    {
                        data: { tag: 'Exit', key: 'testNonImport#testNonImportStub', from: 'testNonImport', to: 'testNonImportStub' },
                        children: [{ data: { tag: 'String', value: 'test exit' }, children: [] }]
                    }
                ]
            },
            {
                data: { tag: 'Room', key: 'testNonImportStub' },
                children: [
                    { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'StubOne' }, children: [] }] }
                ]
            },
        ])
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal(['testImportOne'], []) })).toEqual([
            {
                data: { tag: 'Room', key: 'testImportOne' },
                children: [
                    {
                        data: { tag: 'Description' },
                        children: [
                            { data: { tag: 'String', value: 'One' }, children: [] },
                            { data: { tag: 'String', value: 'Two' }, children: [] }
                        ]
                    },
                    {
                        data: { tag: 'Exit', key: 'testImportOne#testImportStubOne', from: 'testImportOne', to: 'testImportStubOne' },
                        children: [{ data: { tag: 'String', value: 'test exit one' }, children: [] }]
                    }
                ]
            },
            {
                data: { tag: 'Room', key: 'testImportStubOne' },
                children: [
                    { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'StubTwo' }, children: [] }] }
                ]
            },
        ])
    })

    it('should follow dynamic renames in imports', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal(['testNonImportTwo'], []) })).toEqual([
            {
                data: { tag: 'Room', key: 'testImportTwo' },
                children: [
                    { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'StubFoo' }, children: [] }] }
                ]
            },
            {
                data: { tag: 'Room', key: 'testNonImportTwo' },
                children: [{
                    data: { tag: 'Exit', key: 'testNonImportTwo#testImportTwo', from: 'testNonImportTwo', to: 'testImportTwo' },
                    children: [{ data: { tag: 'String', value: 'test exit' }, children: [] }]
                }]
            },
        ])
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal(['testImportThree'], []) })).toEqual([
            {
                data: { tag: 'Room', key: 'testImportAssetThree.stub' },
                children: [
                    { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'AssetThreeStub' }, children: [] }] }
                ]
            },
            {
                data: { tag: 'Room', key: 'testImportAssetTwo.stub' },
                children: [
                    { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Asset Three' }, children: [] }] }
                ]
            },
            {
                data: { tag: 'Room', key: 'testImportThree' },
                children: [
                    { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Asset Two' }, children: [] }] },
                    {
                        data: { tag: 'Exit', key: 'testImportThree#testImportAssetThree.stub', from: 'testImportThree', to: 'testImportAssetThree.stub' },
                        children: [{ data: { tag: 'String', value: 'test exit' }, children: [] }]
                    },
                    {
                        data: { tag: 'Exit', key: 'testImportThree#testImportAssetTwo.stub', from: 'testImportThree', to: 'testImportAssetTwo.stub' },
                        children: [{ data: { tag: 'String', value: 'test exit' }, children: [] }]
                    },
                ]
            }
        ])
    })

    it('should properly stub out features in room description', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', jsonHelper, translate: new NestedTranslateImportToFinal(['testRoomWithFeatures'], []) })).toEqual([
            {
                data: { tag: 'Room', key: 'testRoomWithFeatures' },
                children: [{
                    data: { tag: 'Description' },
                    children: [{
                        data: { tag: 'Link', text: 'Test', to: 'testFeature' },
                        children: [{ data: { tag: 'String', value: 'Test' }, children: [] }]
                    }]
                }]
            },
            { data: { tag: 'Feature', key: 'testFeature' }, children: [] },
        ])
    })

})