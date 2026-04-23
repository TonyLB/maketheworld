import { fetchImportsMessage } from '.'

jest.mock('../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() }
}))
import { snsClient } from '../clients'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('./baseClasses')
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import { FetchImportsJSONHelper } from './baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

describe('fetchImportsMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        //
        // Room prose: prefer <Situation uuid=(DEFAULT)> over <Example ref={0}> (Gate D). Exception for
        // testRoomWithFeatures (Link in copy) — see the "should properly stub out features" test comment.
        //
        const testFinal = new StandardForm(`<Asset uuid=(testFinal)>
            <Room uuid=(testNonImport) key=(testNonImport)>
                <Situation uuid=(DEFAULT)>
                    <Description>
                        DescriptionOne
                    </Description>
                </Situation>
                <Exit to=(testNonImportStub)>test exit</Exit>
            </Room>
            <Room uuid=(testNonImportStub) key=(testNonImportStub)>
                <ShortName>StubOne</ShortName>
            </Room>
            <Room uuid=(testImportOne) key=(testImportOne) from=(ASSET#testImportAssetOne)>
                <Situation uuid=(DEFAULT)>
                    <Description>
                        Two
                    </Description>
                </Situation>
                <Exit to=(testImportStubOne)>test exit one</Exit>
            </Room>
            <Room uuid=(testImportStubOne) key=(testImportStubOne)  from=(ASSET#testImportAssetOne) />
            <Room uuid=(testImportFoo) key=(testImportFoo) from=(ASSET#testImportAssetOne) />
            <Room uuid=(testImportTwo) key=(testImportTwo) />
            <Room uuid=(testNonImportTwo) key=(testNonImportTwo)>
                <Exit to=(testImportFoo)>test exit</Exit>
            </Room>
            <Room uuid=(testImportThree) key=(testImportThree) from=(ASSET#testImportAssetTwo) />
            <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures) from=(ASSET#testImportAssetFour)>
                <Example ref={0} uuid=(testRoomWithFeaturesExample)>
                    <Description>
                        <Link to=(featureImport)>Test</Link>
                    </Description>
                </Example>
            </Room>
            <Feature uuid=(testFeature) key=(featureImport) from=(ASSET#testImportAssetFour) />
        </Asset>`)
        const testImportOne = new StandardForm(`<Asset uuid=(testImportAssetOne)>
            <Room uuid=(testImportOne)>
                <Situation uuid=(DEFAULT)>
                    <Description>
                        One
                    </Description>
                </Situation>
            </Room>
            <Room uuid=(testImportStubOne)>
                <ShortName>StubTwo</ShortName>
            </Room>
            <Room uuid=(testImportFoo)>
                <ShortName>StubFoo</ShortName>
                <Situation uuid=(DEFAULT)>
                    <Description>
                        Foo
                    </Description>
                </Situation>
            </Room>
        </Asset>`)
        const testImportTwo = new StandardForm(`<Asset uuid=(testImportAssetTwo)>
            <Room uuid=(testImportThree) key=(basic) from=(ASSET#testImportAssetThree)>
                <Situation uuid=(DEFAULT)>
                    <Description>
                        Asset Two
                    </Description>
                </Situation>
                <Exit to=(stub)>test exit</Exit>
            </Room>
            <Room uuid=(testStubOne) key=(stub) from=(ASSET#testImportAssetThree) />
        </Asset>`)
        const testImportThree = new StandardForm(`<Asset uuid=(testImportAssetThree)>
            <Room uuid=(testImportThree) key=(basicOne)>
                <Exit to=(stub)>test exit</Exit>
            </Room>
            <Room uuid=(testStubOne) key=(basicTwo)>
                <ShortName>Asset Three</ShortName>
            </Room>
            <Room uuid=(stub) key=(stub)>
                <ShortName>AssetThreeStub</ShortName>
            </Room>
        </Asset>`)
        const testImportFour = new StandardForm(`<Asset uuid=(testImportAssetFour)>
            <Feature uuid=(testFeature) key=(featureImport)>
                <Example uuid=(testFeatureExample)>
                    <Description>Feature test</Description>
                </Example>
            </Feature>
            <Room uuid=(testRoomWithFeatures) key=(testRoomWithFeatures)>
                <Example ref={0} uuid=(testRoomWithFeaturesExample)>
                    <Description><Link to=(testFeature)>Test</Link></Description>
                </Example>
            </Room>
        </Asset>`)
        internalCacheMock.Graph.get.mockResolvedValue(new Graph<string, { key: string }, {}>({
            'ASSET#importTestOne': { key: 'ASSET#importTestOne' },
            'ASSET#importTestTwo': { key: 'ASSET#importTestTwo' },
            'ASSET#importTestThree': { key: 'ASSET#importTestThree' },
            'ASSET#importTestFour': { key: 'ASSET#importTestFour' }
        }, [
            { from: 'ASSET#importTestOne', to: 'ASSET#importTestTwo' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestThree' },
            { from: 'ASSET#importTestTwo', to: 'ASSET#importTestFour' }
        ], {}))
        internalCacheMock.AssetMetaData.get.mockResolvedValue([
            { AssetId: 'ASSET#importTestOne', zone: 'Canon' },
            { AssetId: 'ASSET#importTestTwo', zone: 'Canon' },
            { AssetId: 'ASSET#importTestThree', zone: 'Canon' },
            { AssetId: 'ASSET#importTestFour', zone: 'Canon' }
        ])
        
        // Mock the internalCache.Connection.get method to return different values based on the key
        internalCacheMock.Connection.get.mockImplementation((key: string) => {
            if (key === 'connectionId') {
                return Promise.resolve("TestConnection")
            } else if (key === 'RequestId') {
                return Promise.resolve("TestRequestId")
            }
            return Promise.resolve(undefined)
        })
        jest.spyOn(FetchImportsJSONHelper.prototype, 'get').mockImplementation(async (assetId: `ASSET#${string}`) => {
            let standard: StandardForm = new StandardForm('ASSET#test')
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
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: [] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should return element and stubs when passed non-import key', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImport'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should recursive fetch one level of element and stubs when passed import key', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportOne'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should follow dynamic renames in imports', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImportTwo'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should import multilevel and avoid colliding stub names', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testImportThree'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    //
    // Provisional: fixtures still use Room-hosted Example + Link because subset/import cascade
    // resolves imported Features via Example referencedKeys. SituationFacet/Situation room prose does
    // not yet raise Link references from Description for that traversal — once it does, switch
    // testFinal / testImportFour testRoomWithFeatures to Situation like the other rooms.
    //
    it('should properly stub out features in room description', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testRoomWithFeatures'] }] }], messageBus })
        expect(JSON.parse((snsClientMock.send.mock.calls[0][0].input as any).Message)).toMatchSnapshot()
    })

    it('should send SNS message with Targets format instead of ConnectionIds', async () => {
        await fetchImportsMessage({ payloads: [{ type: 'FetchImports', importsFromAsset: [{ assetId: 'ASSET#testFinal', keys: ['ROOM#testNonImport'] }] }], messageBus })
        
        // Check the SNS message attributes format
        const messageAttributes = (snsClientMock.send.mock.calls[0][0].input as any).MessageAttributes
        
        // Should have Targets instead of ConnectionIds
        expect(messageAttributes.Targets).toBeDefined()
        expect(messageAttributes.Targets.DataType).toEqual('String.Array')
        expect(messageAttributes.Targets.StringValue).toEqual('["CONNECTION#TestConnection"]')
        
        // Should not have ConnectionIds
        expect(messageAttributes.ConnectionIds).toBeUndefined()
        
        // Check other required attributes
        expect(messageAttributes.RequestId.DataType).toEqual('String')
        expect(messageAttributes.RequestId.StringValue).toEqual('TestRequestId')
        expect(messageAttributes.Type.DataType).toEqual('String')
        expect(messageAttributes.Type.StringValue).toEqual('Success')
    })

})