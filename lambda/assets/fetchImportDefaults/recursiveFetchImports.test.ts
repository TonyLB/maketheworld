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
        <Import from=(testImportAssetOne)>
            <Use type="Room" key=(testImportOne) />
            <Use type="Room" key=(testImportStubOne) />
            <Use type="Room" key=(testImportFoo) as=(testImportTwo) />
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
            <Description>
                Foo
            </Description>
        </Room>
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
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testNonImport'], []) })).toEqual([{
            tag: 'Room',
            key: 'testNonImport',
            name: [],
            render: [{ tag: 'String', value: 'DescriptionOne' }],
            contents: [{
                key: 'testNonImport#testNonImportStub',
                tag: 'Exit',
                name: 'test exit',
                from: 'testNonImport',
                to: 'testNonImportStub',
                contents: []
            }]
        },
        {
            tag: 'Room',
            key: 'testNonImportStub',
            name: [{ tag: 'String', value: 'StubOne' }],
            render: [],
            contents: []
        }])
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#testFinal', translate: new NestedTranslateImportToFinal(['testImportOne'], []) })).toEqual([{
            tag: 'Room',
            key: 'testImportOne',
            name: [],
            render: [{ tag: 'String', value: 'One' }],
            contents: []
        },
        {
            tag: 'Room',
            key: 'testImportStubOne',
            name: [{ tag: 'String', value: 'StubTwo' }],
            render: [],
            contents: []
        },
        {
            tag: 'Room',
            key: 'testImportOne',
            name: [],
            render: [{ tag: 'String', value: 'Two' }],
            contents: [{
                key: 'testImportOne#testImportStubOne',
                tag: 'Exit',
                name: 'test exit one',
                from: 'testImportOne',
                to: 'testImportStubOne',
                contents: []
            }]
        },
        {
            tag: 'Room',
            key: 'testImportStubOne',
            name: [],
            render: [],
            contents: []
        }])
    })

})