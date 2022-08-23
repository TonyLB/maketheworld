import AssetWorkspace from '.'

jest.mock('./clients')
import { s3Client } from './clients'
jest.mock('./stream')
import { streamToString } from './stream'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>
const streamToStringMock = streamToString as jest.Mock

describe('AssetWorkspace', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks();
        (s3ClientMock.send as any).mockResolvedValue({} as any)
    })

    it('should correctly parse and assign JSON properties', async () => {
        streamToStringMock.mockReturnValue(`{
            "importTree": { "BASE": {} },
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
        expect(testWorkspace.importTree).toMatchSnapshot()
    })
})
