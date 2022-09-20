import AssetWorkspace, { parseAssetWorkspaceAddress } from '.'
import { NotFound } from '@aws-sdk/client-s3'

jest.mock('./clients')
import { s3Client } from './clients'
jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'
import { AssetWorkspaceException } from './errors'

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
            s3ClientMock.get.mockResolvedValue(`{
                "namespaceIdToDB": { "a123": "Test" },
                "normal": {
                    "Test": {
                        "tag": "Asset",
                        "key": "Test",
                        "fileName": "Test"
                    }
                }
            }`)
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.normal).toMatchSnapshot()
            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })
    
        it('should return empty on no JSON file', async () => {
            s3ClientMock.get.mockImplementation(() => {
                throw new NotFound({ $metadata: {} })
            })
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.normal).toEqual({})
        })

    })

    describe('setWML', () => {
        it('should correctly parse WML input', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.namespaceIdToDB = {
                'a123': 'TestA'
            }
            uuidv4Mock.mockImplementation(uuidMockFactory())
            testWorkspace.setWML(`
                <Asset key=(Test) fileName="Test">
                    <Room key=(a123)>
                        <Exit to=(a123) from=(b456)>vortex</Exit>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456) />
                </Asset>
            `)
            expect(testWorkspace.normal).toMatchSnapshot()
            expect(testWorkspace.namespaceIdToDB).toMatchSnapshot()
        })

        it('should throw an exception on multi-asset file', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.namespaceIdToDB = {
                'a123': 'TestA'
            }
            uuidv4Mock.mockImplementation(uuidMockFactory())
            expect(() => {
                testWorkspace.setWML(`
                    <Asset key=(TestOne) fileName="Test">
                        <Room key=(a123) />
                    </Asset>
                    <Asset key=(TestTwo) fileName="Test">
                        <Room key=(a123) />
                    </Asset>
                `)
            }).toThrowError()
        })
    
    })

    describe('putJSON', () => {
        it('should correctly push JSON content to player zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.normal = {
                Test: {
                    tag: "Asset",
                    key: "Test",
                    fileName: "Test",
                    appearances: []
                }
            }
            testWorkspace.namespaceIdToDB = {}
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Personal/Test/Test.json',
                Body: `{
    "namespaceIdToDB": {},
    "normal": {
        "Test": {
            "tag": "Asset",
            "key": "Test",
            "fileName": "Test",
            "appearances": []
        }
    }
}`
            })
        })

        it('should correctly push JSON content to library zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.normal = {
                Test: {
                    tag: "Asset",
                    key: "Test",
                    fileName: "Test",
                    appearances: []
                }
            }
            testWorkspace.namespaceIdToDB = {}
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3Client.put).toHaveBeenCalledWith({
                Key: 'Library/Test.json',
                Body: `{
    "namespaceIdToDB": {},
    "normal": {
        "Test": {
            "tag": "Asset",
            "key": "Test",
            "fileName": "Test",
            "appearances": []
        }
    }
}`
            })
        })
    })

    describe('putWML', () => {
        it('should correctly push WML content', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.namespaceIdToDB = {
                'a123': 'TestA'
            }
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test) fileName="Test">
                    <Room key=(a123)>
                        <Exit to=(a123) from=(b456)>vortex</Exit>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456) />
                </Asset>
            `
            testWorkspace.setWML(testSource)

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
        it('should not set JSON dirty on no-op', () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.namespaceIdToDB = {
                'a123': 'TestA'
            }
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset key=(Test) fileName="Test">
                    <Room key=(a123)>
                        <Exit to=(a123) from=(b456)>vortex</Exit>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456) />
                </Asset>
            `
            testWorkspace.setWML(testSource)

            expect(testWorkspace.status.json).toEqual('Dirty')
            testWorkspace.status.json = 'Clean'

            testWorkspace.setWML(testSource)
            expect(testWorkspace.status.json).toEqual('Clean')

        })
    })
})
