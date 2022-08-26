import AssetWorkspace from '.'
import { NotFound } from '@aws-sdk/client-s3'

jest.mock('./clients')
import { s3Client } from './clients'
jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'

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

describe('AssetWorkspace', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks();
        s3ClientMock.get.mockResolvedValue('')
    })

    describe('loadJSON', () => {
        it('should correctly parse and assign JSON properties', async () => {
            s3ClientMock.get.mockResolvedValue(`{
                "namespaceIdToDB": { "a123": "Test" },
                "normalForm": {
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
    
    })

})
