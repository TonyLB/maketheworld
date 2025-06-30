jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
jest.mock('../serialize/dbRegister')

import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import copyWML from '.'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>

describe('copyWML', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        s3ClientMock.get.mockResolvedValue('')
        s3ClientMock.put.mockResolvedValue()
    })

    it('should replace asset key', async () => {
        const testSource = deIndentWML(`
            <Asset key=(draft)>
                <Room uuid=(room1) key=(TestRoom)>
                    <Example uuid=(example1)><Name>Test Name</Name></Example>
                </Room>
            </Asset>
        `)
        s3ClientMock.get.mockResolvedValueOnce(testSource)
        const testForm = new StandardForm(testSource).finalize()
        const ndjsonTransform = (lines) => (lines.map((line) => (JSON.stringify(line))).join('\n'))
        s3ClientMock.get.mockResolvedValueOnce(ndjsonTransform(testForm.toNDJSON()))

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
        
        expect(s3ClientMock.put).toHaveBeenCalledWith({
            Key: 'Personal/Test/Assets/testCopy.wml',
            Body: deIndentWML(`
                <Asset key=(testCopy)>
                    <Room uuid=(room1) key=(TestRoom)>
                        <Example uuid=(example1)><Name>Test Name</Name></Example>
                    </Room>
                </Asset>
            `)
        })

        const jsonIndex = s3ClientMock.put.mock.calls.findIndex((args) => (args[0].Key === 'Personal/Test/Assets/testCopy.ndjson'))
        expect(jsonIndex).not.toEqual(-1)
        expect(s3ClientMock.put.mock.calls[jsonIndex][0].Body.split('\n').map((line) => (JSON.parse(line)))).toEqual([
            { key: 'testCopy', tag: 'Asset', universalKey: 'ASSET#testCopy' },
            testForm.byUniversalId['ROOM#room1'].toJSON(),
            testForm.byUniversalId['EXAMPLE#example1'].toJSON()
        ])

    })

})