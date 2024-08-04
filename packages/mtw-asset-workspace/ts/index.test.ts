jest.mock('./clients')
import { s3Client } from './clients'
jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'
import { AssetWorkspaceException } from './errors'

import AssetWorkspace, { parseAssetWorkspaceAddress } from '.'
import { SerializableStandardAsset, SerializableStandardComponent, StandardNDJSON } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>
const uuidv4Mock = uuidv4 as jest.Mock

const uuidMockFactory = () => {
    let index = 0
    return () => {
        const returnValue = `UUID-${index}`
        index += 1
        return returnValue
    }
}

describe('parseAssetWorkspaceAddress', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks();
    })
    
    it('should reject a Personal zone address without player', () => {
        expect(() => { parseAssetWorkspaceAddress('Personal/Test')}).toThrow(AssetWorkspaceException)
    })

    it('should reject address without fileName', () => {
        expect(() => { parseAssetWorkspaceAddress('Library/')}).toThrow(AssetWorkspaceException)
    })

    it('should reject illegal zone', () => {
        expect(() => { parseAssetWorkspaceAddress('Wrong/Test/TestB')}).toThrow(AssetWorkspaceException)
    })

    it('should properly parse Personal zone address', () => {
        expect(parseAssetWorkspaceAddress('Personal/Test/TestB')).toEqual({
            zone: 'Personal',
            player: 'Test',
            fileName: 'TestB'
        })
    })

    it('should properly parse Library zone address', () => {
        expect(parseAssetWorkspaceAddress('Library/TestB')).toEqual({
            zone: 'Library',
            fileName: 'TestB'
        })
    })

    it('should properly extract subfolders', () => {
        expect(parseAssetWorkspaceAddress('Library/Test/Another/TestB')).toEqual({
            zone: 'Library',
            subFolder: 'Test/Another',
            fileName: 'TestB'
        })
        expect(parseAssetWorkspaceAddress('Personal/Test/Another/TestB')).toEqual({
            zone: 'Personal',
            player: 'Test',
            subFolder: 'Another',
            fileName: 'TestB'
        })
    })

})

describe('AssetWorkspace', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks();
        s3ClientMock.get.mockResolvedValue('')
        s3ClientMock.put.mockResolvedValue()
    })

    describe('loadJSON', () => {
        it('should correctly parse and assign JSON properties', async () => {
            const lines: StandardNDJSON = [
                { tag: "Asset", key: 'Test' },
                {
                    tag: 'Room',
                    key: 'testRoom',
                    universalKey: 'ROOM#001',
                    shortName: { data: { tag: 'ShortName' }, children: [] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    name: { data: { tag: 'Name' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                    exits: [],
                    themes: []
                }
            ]
            s3ClientMock.get.mockResolvedValue(lines.map((line) => (JSON.stringify(line))).join('\n'))
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.standard).toMatchSnapshot()
            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })
    
        it('should return empty on no JSON file', async () => {
            s3ClientMock.get.mockImplementation(() => {
                const error = new (class NoSuchKey extends Error {
                    Code: string;
                    constructor(message: string) {
                        super(message)
                        Object.setPrototypeOf(this, NoSuchKey.prototype)
                        this.Code = 'NoSuchKey'
                    }
                })('Test message')
                throw error
            })
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.standard).toEqual({ key: '', tag: 'Asset', metaData: [], byId: {} })
        })

    })

    describe('setWML', () => {
        it('should correctly parse WML input', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.namespaceIdToDB = [
                { internalKey: 'a123', universalKey: 'TestA' }
            ]
            uuidv4Mock.mockImplementation(uuidMockFactory())
            await testWorkspace.setWML(`
                <Asset key=(Test)>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                </Asset>
            `)
            expect(testWorkspace.standard).toMatchSnapshot()
            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })

        it('should throw an exception on multi-asset file', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.namespaceIdToDB = [
                { internalKey: 'a123', universalKey: 'TestA' }
            ]
            uuidv4Mock.mockImplementation(uuidMockFactory())
            await expect(async () => {
                await testWorkspace.setWML(`
                    <Asset key=(TestOne)>
                        <Room key=(a123) />
                    </Asset>
                    <Asset key=(TestTwo)>
                        <Room key=(a123) />
                    </Asset>
                `)
            }).rejects.toThrowError()
        })
    
    })

    describe('putJSON', () => {
        it('should correctly push JSON content to player zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.standard = { key: 'Test', tag: 'Asset', byId: {}, metaData: [] }
            testWorkspace.namespaceIdToDB = []
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Personal/Test/Test.json',
                Body: `{"assetId":"ASSET#Test","namespaceIdToDB":[],"standard":{"key":"Test","tag":"Asset","byId":{},"metaData":[]},"properties":{}}`
            })
        })

        it('should correctly push JSON content to library zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.standard = { key: "Test", tag: "Asset", byId: {}, metaData: [] }
            testWorkspace.namespaceIdToDB = []
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Library/Test.json',
                Body: `{"assetId":"ASSET#Test","namespaceIdToDB":[],"standard":{"key":"Test","tag":"Asset","byId":{},"metaData":[]},"properties":{}}`
            })
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Library/Test.ndjson',
                Body: `{"tag":"Asset","key":"Test"}`
            })
        })

        it('should correctly trim properties to those represented in standardForm', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.namespaceIdToDB = []
            testWorkspace.properties = {
                Test: { fileName: 'test' },
                foo: { fileName: 'bar'}
            }
            testWorkspace.standard = { key: "Test", tag: "Asset", byId: {}, metaData: [] }
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Personal/Test/Test.json',
                Body: `{"assetId":"ASSET#Test","namespaceIdToDB":[],"standard":{"key":"Test","tag":"Asset","byId":{},"metaData":[]},"properties":{"Test":{"fileName":"test"}}}`
            })
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Personal/Test/Test.ndjson',
                Body: `{"tag":"Asset","key":"Test"}`
            })
        })
    })

    describe('putWML', () => {
        it('should correctly push WML content', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.namespaceIdToDB = [
                { internalKey: 'a123', universalKey: 'TestA' }
            ]
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test)>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            await testWorkspace.pushWML()
            expect(testWorkspace.status.wml).toEqual('Clean')
            expect(testWorkspace.status.json).toEqual('Dirty')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Library/Test.wml',
                Body: testSource
            })
        })

    })

    describe('setWML', () => {
        it('should not set JSON dirty on no-op', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.namespaceIdToDB = [
                { internalKey: 'a123', universalKey: 'TestA' }
            ]
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test)>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            expect(testWorkspace.status.json).toEqual('Dirty')
            testWorkspace.status.json = 'Clean'

            await testWorkspace.setWML(testSource)
            expect(testWorkspace.status.json).toEqual('Clean')

        })

        it('should look up import namespace mappings', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.setWorkspaceLookup(async () => ({
                loadJSON: jest.fn(),
                namespaceIdToDB: [
                    { internalKey: 'base', universalKey: 'testImport' },
                    { internalKey: 'testFeature', universalKey: 'testFeature', exportAs: 'Feature2' }
                ],
                universalKey: jest.fn().mockImplementation((key) => (key === 'base'
                    ? 'testImport'
                    : key === 'testFeature' ? 'testFeature' : undefined))
            } as any))
            testWorkspace.namespaceIdToDB = [
                { internalKey: 'b456', universalKey: 'TestB' }
            ]
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test)>
                    <Import from=(testAsset)>
                        <Room key=(a123) from=(base) />
                        <Feature key=(c789) from=(Feature2) />
                    </Import>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })

        it('should populate export namespace mappings', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test)>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                    <Export>
                        <Room key=(a123) as=(Room2) />
                    </Export>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })
    })
})
