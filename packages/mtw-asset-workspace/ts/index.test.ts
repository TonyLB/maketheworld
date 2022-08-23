import AssetWorkspace from '.'

jest.mock('@tonylb/mtw-utilities/dist/stream')
import { streamToString } from '@tonylb/mtw-utilities/dist/stream'

const streamToStringMock = streamToString as jest.Mock

describe('AssetWorkspace', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
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
