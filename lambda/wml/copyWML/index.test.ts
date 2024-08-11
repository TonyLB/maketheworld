jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
jest.mock('../serialize/dbRegister')

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
        s3ClientMock.get.mockResolvedValueOnce(deIndentWML(`
            <Asset key=(draft)>
                <Room key=(TestRoom)><Name>Test Name</Name></Room>
            </Asset>
        `))
        const testRoom = {
            tag: 'Room',
            key: 'TestRoom',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Test Name'}, children: [] }] },
            shortName: { data: { tag: 'ShortName' }, children: [] },
            summary: { data: { tag: 'Summary' }, children: [] },
            description: { data: { tag: 'Description' }, children: [] },
            exits: [],
            themes: [],
            universalKey: 'ROOM#ABCDEF'
        }
        const testNDJSON = [
            { tag: 'Asset', key: 'draft', universalId: 'ASSET#draft[Test]' },
            testRoom
        ]
        const ndjsonTransform = (lines) => (lines.map((line) => (JSON.stringify(line))).join('\n'))
        s3ClientMock.get.mockResolvedValueOnce(ndjsonTransform(testNDJSON))

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
                    <Room key=(TestRoom)><Name>Test Name</Name></Room>
                </Asset>
            `)
        })

        const jsonIndex = s3ClientMock.put.mock.calls.findIndex((args) => (args[0].Key === 'Personal/Test/Assets/testCopy.ndjson'))
        expect(jsonIndex).not.toEqual(-1)
        expect(s3ClientMock.put.mock.calls[jsonIndex][0].Body.split('\n').map((line) => (JSON.parse(line)))).toEqual([
            { tag: 'Asset', key: 'testCopy', universalId: 'ASSET#testCopy' },
            testRoom
        ])

    })

})