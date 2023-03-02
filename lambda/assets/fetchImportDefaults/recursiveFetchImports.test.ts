import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import recursiveFetchImports from './recursiveFetchImports'

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
    const testNormal = testNormalFromWML(`<Asset key=(Test)>
        <Room key=(testNonImport)>
            <Description>
                DescriptionOne
            </Description>
            <Exit to=(testNonImportStub)>test exit</Exit>
        </Room>
        <Room key=(testNonImportStub)>
            <Name>StubOne</Name>
        </Room>
    </Asset>`)
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCacheMock.JSONFile.get.mockResolvedValue({
            normal: testNormal,
            namespaceIdToDB: {}
        })
    })

    it('should return empty when passed no keys', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#Test', keys: [], stubKeys: [] })).toEqual([])
    })

    it('should return element and stubs when passed non-import key', async () => {
        expect(await recursiveFetchImports({ assetId: 'ASSET#Test', keys: ['testNonImport'], stubKeys: [] })).toEqual([{
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

})