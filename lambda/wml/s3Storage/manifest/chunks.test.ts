import { writeChunk, WriteChunkOptions, ChunkReference } from './chunks'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
jest.mock('@tonylb/mtw-asset-workspace/ts/clients', () => ({
    s3Client: {
        putWithTags: jest.fn()
    }
}))

jest.mock('uuid', () => ({
    v4: jest.fn()
}))

const mockS3Client = s3Client as jest.Mocked<typeof s3Client>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe('Chunk Operations', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('writeChunk', () => {
        it('should write chunk with correct S3 key format', async () => {
            mockUuidv4.mockReturnValue('abc-123-def-456')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const options: WriteChunkOptions = {
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                content: '<Asset uuid=(test)><Replace>...</Replace></Asset>',
                zone: 'Library',
                player: 'alice'
            }

            const result = await writeChunk(options)

            expect(result.s3Key).toBe('test.wml/chunks/1729252800000-abc-123-def-456.wml')
        })

        it('should include Zone tag for lifecycle management', async () => {
            mockUuidv4.mockReturnValue('uuid-1')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            await writeChunk({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Canon'
            })

            expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tags: { Zone: 'Canon' }
                })
            )
        })

        it('should include player metadata when provided', async () => {
            mockUuidv4.mockReturnValue('uuid-2')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            await writeChunk({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library',
                player: 'bob'
            })

            expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: {
                        timestamp: '1729252800000',
                        player: 'bob'
                    }
                })
            )
        })

        it('should omit player metadata when not provided', async () => {
            mockUuidv4.mockReturnValue('uuid-3')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            await writeChunk({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library'
            })

            expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: {
                        timestamp: '1729252800000'
                        // No player field
                    }
                })
            )
        })

        it('should return chunk reference with correct size', async () => {
            mockUuidv4.mockReturnValue('uuid-4')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const content = '<Asset uuid=(test)><Replace>...</Replace></Asset>'
            const result = await writeChunk({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                content,
                zone: 'Library'
            })

            expect(result).toEqual({
                s3Key: 'test.wml/chunks/1729252800000-uuid-4.wml',
                chunkSize: Buffer.byteLength(content, 'utf8')
            })
        })

        it('should work with auth prefix', async () => {
            mockUuidv4.mockReturnValue('uuid-5')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const result = await writeChunk({
                prefix: 'test.auth.wml/',
                timestamp: 1729252800000,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library'
            })

            expect(result.s3Key).toBe('test.auth.wml/chunks/1729252800000-uuid-5.wml')
        })

        it('should write content to S3', async () => {
            mockUuidv4.mockReturnValue('uuid-6')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const content = '<Asset uuid=(test)><Replace><Room uuid=(lobby) /></Replace></Asset>'
            
            await writeChunk({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                content,
                zone: 'Library',
                player: 'charlie'
            })

            expect(mockS3Client.putWithTags).toHaveBeenCalledWith({
                Key: 'test.wml/chunks/1729252800000-uuid-6.wml',
                Body: content,
                Tags: { Zone: 'Library' },
                Metadata: {
                    timestamp: '1729252800000',
                    player: 'charlie'
                }
            })
        })

        it('should handle all zone types', async () => {
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const zones: Array<'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'> = [
                'Canon', 'Library', 'Personal', 'Draft', 'Archive'
            ]

            for (const zone of zones) {
                mockUuidv4.mockReturnValue(`uuid-${zone}`)
                
                await writeChunk({
                    prefix: 'test.wml/',
                    timestamp: Date.now(),
                    content: '<Asset uuid=(test)></Asset>',
                    zone
                })

                expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                    expect.objectContaining({
                        Tags: { Zone: zone }
                    })
                )
            }
        })

        it('should generate unique UUIDs for concurrent writes', async () => {
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            // Simulate two writes at the same timestamp
            const timestamp = 1729252800000
            mockUuidv4.mockReturnValueOnce('uuid-first')
            mockUuidv4.mockReturnValueOnce('uuid-second')

            const result1 = await writeChunk({
                prefix: 'test.wml/',
                timestamp,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library'
            })

            const result2 = await writeChunk({
                prefix: 'test.wml/',
                timestamp,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library'
            })

            // Both should have same timestamp but different UUIDs
            expect(result1.s3Key).toBe('test.wml/chunks/1729252800000-uuid-first.wml')
            expect(result2.s3Key).toBe('test.wml/chunks/1729252800000-uuid-second.wml')
            expect(result1.s3Key).not.toBe(result2.s3Key)
        })

        it('should calculate size correctly for multi-byte characters', async () => {
            mockUuidv4.mockReturnValue('uuid-7')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            // Content with multi-byte characters (emoji, unicode)
            const content = '<Asset uuid=(test)><Replace>Hello 世界 🌍</Replace></Asset>'
            
            const result = await writeChunk({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                content,
                zone: 'Library'
            })

            // Should use byte length, not character length
            expect(result.chunkSize).toBe(Buffer.byteLength(content, 'utf8'))
            expect(result.chunkSize).toBeGreaterThan(content.length) // Multi-byte chars take more bytes
        })

        it('should handle empty content', async () => {
            mockUuidv4.mockReturnValue('uuid-8')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const result = await writeChunk({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                content: '',
                zone: 'Library'
            })

            expect(result.chunkSize).toBe(0)
            expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Body: ''
                })
            )
        })

        it('should preserve timestamp precision', async () => {
            mockUuidv4.mockReturnValue('uuid-9')
            mockS3Client.putWithTags.mockResolvedValue(undefined)

            const preciseTimestamp = 1729252800123 // with milliseconds
            
            await writeChunk({
                prefix: 'test.wml/',
                timestamp: preciseTimestamp,
                content: '<Asset uuid=(test)></Asset>',
                zone: 'Library'
            })

            expect(mockS3Client.putWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: `test.wml/chunks/${preciseTimestamp}-uuid-9.wml`,
                    Metadata: expect.objectContaining({
                        timestamp: preciseTimestamp.toString()
                    })
                })
            )
        })
    })
})

