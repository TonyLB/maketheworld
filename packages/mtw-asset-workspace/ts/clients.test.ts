/**
 * S3 Client Wrapper Tests
 * 
 * Tests for the s3Client wrapper to ensure proper AWS SDK command construction
 * and error handling. Each test verifies that the wrapper correctly translates
 * our simplified API into proper AWS SDK calls.
 */

// Set AWS_REGION before any imports to avoid fallback mock in clients.ts
process.env.AWS_REGION = 'us-east-1'

// Create mockSend at module level
let mockSend: jest.Mock

//Mock the AWS SDK S3Client before any imports
jest.mock("@aws-sdk/client-s3", () => {
    mockSend = jest.fn()
    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: mockSend
        })),
        GetObjectCommand: jest.fn(),
        PutObjectCommand: jest.fn(),
        HeadObjectCommand: jest.fn(),
        GetObjectTaggingCommand: jest.fn(),
        PutObjectTaggingCommand: jest.fn(),
        CopyObjectCommand: jest.fn()
    }
})

// Mock the streamToString utility
jest.mock('./stream', () => ({
    streamToString: jest.fn().mockResolvedValue('mock-content')
}))

// Now import after mocks
import { 
    GetObjectCommand, 
    PutObjectCommand, 
    HeadObjectCommand, 
    GetObjectTaggingCommand, 
    PutObjectTaggingCommand,
    CopyObjectCommand
} from "@aws-sdk/client-s3"
import { s3Client } from './clients'

describe('s3Client wrapper', () => {
    const S3_BUCKET = 'Test'  // Default from clients.ts
    const UPLOAD_BUCKET = 'Test'  // Default from clients.ts

    beforeEach(() => {
        mockSend.mockClear()
    })

    describe('check', () => {
        it('should return true if object exists', async () => {
            mockSend.mockResolvedValue({})

            const result = await s3Client.check({ Key: 'test.wml' })

            expect(result).toBe(true)
            expect(HeadObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml'
            })
        })

        it('should return false if object not found', async () => {
            mockSend.mockRejectedValue({ name: 'NotFound' })

            const result = await s3Client.check({ Key: 'missing.wml' })

            expect(result).toBe(false)
        })

        it('should throw on other errors', async () => {
            mockSend.mockRejectedValue(new Error('S3 Error'))

            await expect(s3Client.check({ Key: 'test.wml' }))
                .rejects.toThrow('S3 Error')
        })
    })

    describe('get', () => {
        it('should get object from S3 bucket', async () => {
            const mockStream = { /* mock stream */ }
            mockSend.mockResolvedValue({ Body: mockStream })

            await s3Client.get({ Key: 'test.wml' })

            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml'
            })
        })

        it('should get object from upload bucket when upload=true', async () => {
            const mockStream = { /* mock stream */ }
            mockSend.mockResolvedValue({ Body: mockStream })

            await s3Client.get({ Key: 'test.wml', upload: true })

            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: UPLOAD_BUCKET,
                Key: 'test.wml'
            })
        })
    })

    describe('put', () => {
        it('should put object to S3', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.put({ Key: 'test.wml', Body: '<Asset uuid=(test) />' })

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml',
                Body: '<Asset uuid=(test) />'
            })
        })
    })

    describe('putWithTags', () => {
        it('should put object with tags and metadata', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.putWithTags({
                Key: 'test.wml',
                Body: '<Asset uuid=(test) />',
                Tags: { Zone: 'Library', Version: '1' },
                Metadata: { timestamp: '1234567890' }
            })

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml',
                Body: '<Asset uuid=(test) />',
                Tagging: 'Zone=Library&Version=1',
                Metadata: { timestamp: '1234567890' }
            })
        })

        it('should handle tags without metadata', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.putWithTags({
                Key: 'test.wml',
                Body: 'content',
                Tags: { Zone: 'Canon' }
            })

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml',
                Body: 'content',
                Tagging: 'Zone=Canon',
                Metadata: undefined
            })
        })

        it('should handle undefined tags', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.putWithTags({
                Key: 'test.wml',
                Body: 'content',
                Metadata: { player: 'alice' }
            })

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml',
                Body: 'content',
                Tagging: undefined,
                Metadata: { player: 'alice' }
            })
        })

        it('should format tags with special characters correctly', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.putWithTags({
                Key: 'test.wml',
                Body: 'content',
                Tags: { 'Zone': 'Library', 'Owner': 'user@example.com' }
            })

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tagging: 'Zone=Library&Owner=user@example.com'
                })
            )
        })
    })

    describe('getTags', () => {
        it('should get object tags', async () => {
            mockSend.mockResolvedValue({
                TagSet: [
                    { Key: 'Zone', Value: 'Library' },
                    { Key: 'Version', Value: '2' }
                ]
            })

            const result = await s3Client.getTags({ Key: 'test.wml' })

            expect(GetObjectTaggingCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml'
            })
            expect(result).toEqual({
                Zone: 'Library',
                Version: '2'
            })
        })

        it('should return empty object if no tags', async () => {
            mockSend.mockResolvedValue({})

            const result = await s3Client.getTags({ Key: 'test.wml' })

            expect(result).toEqual({})
        })

        it('should return empty object if object not found', async () => {
            mockSend.mockRejectedValue({ name: 'NoSuchKey' })

            const result = await s3Client.getTags({ Key: 'missing.wml' })

            expect(result).toEqual({})
        })

        it('should handle tags with missing keys or values', async () => {
            mockSend.mockResolvedValue({
                TagSet: [
                    { Key: 'Zone', Value: 'Library' },
                    { Key: '', Value: 'invalid' },  // Missing key
                    { Key: 'Valid', Value: undefined }  // Missing value
                ]
            })

            const result = await s3Client.getTags({ Key: 'test.wml' })

            // Should skip entries where Key or Value is falsy
            expect(result).toEqual({
                Zone: 'Library'
            })
        })
    })

    describe('updateTags', () => {
        it('should update object tags', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.updateTags({
                Key: 'test.wml',
                Tags: { Zone: 'Canon', Status: 'active' }
            })

            expect(PutObjectTaggingCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml',
                Tagging: {
                    TagSet: [
                        { Key: 'Zone', Value: 'Canon' },
                        { Key: 'Status', Value: 'active' }
                    ]
                }
            })
        })
    })

    describe('getMetadata', () => {
        it('should get object metadata', async () => {
            mockSend.mockResolvedValue({
                Metadata: {
                    timestamp: '1234567890',
                    player: 'alice'
                }
            })

            const result = await s3Client.getMetadata({ Key: 'test.wml' })

            expect(HeadObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml'
            })
            expect(result).toEqual({
                timestamp: '1234567890',
                player: 'alice'
            })
        })

        it('should return undefined if object not found', async () => {
            mockSend.mockRejectedValue({ name: 'NotFound' })

            const result = await s3Client.getMetadata({ Key: 'missing.wml' })

            expect(result).toBeUndefined()
        })
    })

    describe('getSize', () => {
        it('should get object size from ContentLength', async () => {
            mockSend.mockResolvedValue({
                ContentLength: 12345
            })

            const result = await s3Client.getSize({ Key: 'test.wml' })

            expect(HeadObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                Key: 'test.wml'
            })
            expect(result).toBe(12345)
        })

        it('should return 0 if ContentLength is undefined', async () => {
            mockSend.mockResolvedValue({
                ContentLength: undefined
            })

            const result = await s3Client.getSize({ Key: 'test.wml' })

            expect(result).toBe(0)
        })

        it('should return 0 if ContentLength is null', async () => {
            mockSend.mockResolvedValue({
                ContentLength: null
            })

            const result = await s3Client.getSize({ Key: 'test.wml' })

            expect(result).toBe(0)
        })

        it('should handle large file sizes', async () => {
            mockSend.mockResolvedValue({
                ContentLength: 5_000_000_000  // 5GB
            })

            const result = await s3Client.getSize({ Key: 'large.wml' })

            expect(result).toBe(5_000_000_000)
        })
    })

    describe('copyWithTags', () => {
        it('should copy object with new tags and metadata', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'source.wml',
                Key: 'dest.wml',
                Metadata: {
                    timestamp: '1234567890',
                    snapshotType: 'manual'
                },
                Tags: { Zone: 'Library' }
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/source.wml`,
                Key: 'dest.wml',
                Metadata: {
                    timestamp: '1234567890',
                    snapshotType: 'manual'
                },
                MetadataDirective: 'REPLACE',
                Tagging: 'Zone=Library',
                TaggingDirective: 'REPLACE'
            })
        })

        it('should format CopySource with bucket name', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'test.wml',
                Key: 'test.wml/snapshots/123.wml',
                Metadata: { timestamp: '123' },
                Tags: { Zone: 'Canon' }
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    CopySource: `${S3_BUCKET}/test.wml`
                })
            )
        })

        it('should format multiple tags correctly', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'source.wml',
                Key: 'dest.wml',
                Metadata: {},
                Tags: { Zone: 'Library', Status: 'archived', Version: '3' }
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tagging: 'Zone=Library&Status=archived&Version=3'
                })
            )
        })

        it('should always use REPLACE directives', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'source.wml',
                Key: 'dest.wml',
                Metadata: { new: 'metadata' },
                Tags: { New: 'tag' }
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    MetadataDirective: 'REPLACE',
                    TaggingDirective: 'REPLACE'
                })
            )
        })

        it('should handle empty metadata', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'source.wml',
                Key: 'dest.wml',
                Metadata: {},
                Tags: { Zone: 'Canon' }
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: {}
                })
            )
        })

        it('should handle empty tags', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.copyWithTags({
                CopySource: 'source.wml',
                Key: 'dest.wml',
                Metadata: { timestamp: '123' },
                Tags: {}
            })

            expect(CopyObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tagging: ''  // Empty string from Object.entries({}).map(...).join('&')
                })
            )
        })
    })

    describe('integration scenarios', () => {
        it('should support snapshot creation workflow', async () => {
            // 1. Copy to snapshot location (called first in Promise.all)
            mockSend.mockResolvedValueOnce({})
            
            // 2. Get size of source (called second in Promise.all)
            mockSend.mockResolvedValueOnce({ ContentLength: 50000 })

            const [, size] = await Promise.all([
                s3Client.copyWithTags({
                    CopySource: 'test.wml',
                    Key: 'test.wml/snapshots/123.wml',
                    Metadata: { timestamp: '123', snapshotType: 'manual', chunksBeforeSnapshot: '10' },
                    Tags: { Zone: 'Library' }
                }),
                s3Client.getSize({ Key: 'test.wml' })
            ])

            expect(size).toBe(50000)
            expect(HeadObjectCommand).toHaveBeenCalled()
            expect(CopyObjectCommand).toHaveBeenCalled()
        })

        it('should support chunk writing workflow', async () => {
            mockSend.mockResolvedValue({})

            await s3Client.putWithTags({
                Key: 'test.wml/chunks/123-abc.wml',
                Body: '<Asset uuid=(test)><Replace>...</Replace></Asset>',
                Tags: { Zone: 'Library' },
                Metadata: { timestamp: '123', player: 'alice' }
            })

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: 'test.wml/chunks/123-abc.wml',
                    Tagging: 'Zone=Library',
                    Metadata: { timestamp: '123', player: 'alice' }
                })
            )
        })

        it('should support zone change workflow', async () => {
            // 1. Get current tags
            mockSend.mockResolvedValueOnce({
                TagSet: [{ Key: 'Zone', Value: 'Library' }]
            })

            // 2. Update tags
            mockSend.mockResolvedValueOnce({})

            const currentTags = await s3Client.getTags({ Key: 'test.wml' })
            await s3Client.updateTags({
                Key: 'test.wml',
                Tags: { ...currentTags, Zone: 'Canon' }
            })

            expect(PutObjectTaggingCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tagging: {
                        TagSet: [{ Key: 'Zone', Value: 'Canon' }]
                    }
                })
            )
        })
    })
})

