jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import copyWML from '.'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>

describe('copyWML', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        s3ClientMock.get.mockResolvedValue('')
        s3ClientMock.put.mockResolvedValue()
    })

    it('should replace asset key', async () => {
        s3ClientMock.get.mockResolvedValue(deIndentWML(`
            <Asset key=(draft)>
                <Room key=(VORTEX)><Name>Test Name</Name></Room>
            </Asset>
        `))

        await copyWML({
            key: 'testCopy',
            from: {
                zone: 'Draft',
                player: 'Test'
            },
            to: {
                zone: 'Personal',
                player: 'Test',
                fileName: 'testCopy',
                subFolder: 'Assets'
            }
        })
        expect(s3Client.put).toHaveBeenCalledWith({
            Key: 'Personal/Test/Assets/testCopy.wml',
            Body: `<Asset key=(testCopy)><Room key=(VORTEX)><Name>Test Name</Name></Room></Asset>`
        })

    })

})