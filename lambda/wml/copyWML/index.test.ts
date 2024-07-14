jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'

import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import copyWML from '.'
import { NormalForm } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { SerializableStandardForm } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

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
        const testJSON: { assetId: string; namespaceIdToDB: any[], normal: NormalForm; standard: SerializableStandardForm; properties: any } = {
            assetId: "ASSET#draft[Test]",
            namespaceIdToDB: [{ internalKey: 'TestRoom', universalKey: 'ROOM#UUID' }],
            normal: {
                testCopy: { tag: 'Asset', key: 'draft[Test]', appearances: [] },
                TestRoom: { tag: 'Room', key: 'TestRoom', appearances: [] }
            },
            standard: {
                key: 'testCopy',
                tag: 'Asset',
                byId: {
                    TestRoom: {
                        tag: 'Room',
                        key: 'TestRoom',
                        name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Test Name'}, children: [] }] },
                        shortName: { data: { tag: 'ShortName' }, children: [] },
                        summary: { data: { tag: 'Summary' }, children: [] },
                        description: { data: { tag: 'Description' }, children: [] },
                        exits: [],
                        themes: []
                    }
                },
                metaData: []
            },
            properties: {}
        }
        s3ClientMock.get.mockResolvedValueOnce(JSON.stringify(testJSON))

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
        expect(s3ClientMock.put.mock.calls[1][0].Key).toEqual('Personal/Test/Assets/testCopy.json')
        expect(JSON.parse(s3ClientMock.put.mock.calls[1][0].Body)).toEqual({
            ...testJSON,
            assetId: 'ASSET#testCopy',
            normal: expect.any(Object)
        })
            // `{"assetId":"ASSET#Test","namespaceIdToDB":[],"normal":{"Test":{"tag":"Asset","key":"Test","fileName":"Test","appearances":[]}},"standard":{"key":"Test","tag":"Asset","byId":{},"metaData":[]},"properties":{}}`
        

    })

})