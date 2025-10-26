import { applyEdit } from './index'
import AssetWorkspace from '../../s3Storage/AssetWorkspace'
import { appendChunk } from '../../s3Storage'
import internalCache from '../../internalCache'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// Mock dependencies
jest.mock('../../s3Storage/AssetWorkspace')
jest.mock('../../s3Storage')
jest.mock('../../internalCache')

// Mock time for deterministic testing
jest.mock('../../utilities/mockableTime', () => ({
    now: jest.fn()
}))

import { now } from '../../utilities/mockableTime'

const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>
const mockAppendChunk = appendChunk as jest.MockedFunction<typeof appendChunk>
const internalCacheMock = jest.mocked(internalCache, { shallow: false })
const mockNow = now as jest.MockedFunction<typeof now>

describe("applyEdit", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Setup deterministic time
        mockNow.mockReturnValue(1234567890000)
        
        // Setup default player in cache
        internalCacheMock.Connection.get.mockImplementation(async (key: string) => {
            if (key === 'player') {
                return 'test-player-123'
            }
            return undefined
        })
    })

    describe("AssetId validation", () => {
        it('should reject invalid AssetId format', async () => {
            const result = await applyEdit({
                AssetId: 'INVALID#test' as any,
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Invalid AssetId format')
            }
            expect(mockAppendChunk).not.toHaveBeenCalled()
        })

        it('should accept ASSET# prefix', async () => {
            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Asset not found')
            }
        })

        it('should reject malformed ASSET# ids', async () => {
            const result = await applyEdit({
                AssetId: 'ASSET#' as any,
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Invalid AssetId format')
            }
        })
    })

    describe("zone determination", () => {
        it('should use zone from args when provided', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            await applyEdit({
                AssetId: 'ASSET#test',
                    RequestId: 'test-request',
                    schema: testSchema,
                    zone: 'Canon'
                })

            expect(mockAppendChunk).toHaveBeenCalledWith({
                assetId: 'ASSET#test',
                chunkWML: testSchema,
                timestamp: 1234567890000,
                zone: 'Canon',
                authoringPlayer: 'test-player-123',
                createIfNeeded: false
            })
            // Should NOT call fromUUID when zone is provided
            expect(MockAssetWorkspace.fromUUID).not.toHaveBeenCalled()
        })

        it('should look up zone from existing asset when not provided', async () => {
            const mockWorkspace = { zone: 'Personal' }
                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)

            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            await applyEdit({
                AssetId: 'ASSET#test',
                    RequestId: 'test-request',
                schema: testSchema
            })

            expect(MockAssetWorkspace.fromUUID).toHaveBeenCalledWith('ASSET#test')
            expect(mockAppendChunk).toHaveBeenCalledWith({
                assetId: 'ASSET#test',
                chunkWML: testSchema,
                timestamp: 1234567890000,
                zone: 'Personal',
                authoringPlayer: 'test-player-123',
                createIfNeeded: false
            })
        })

        it('should fail when asset not found and no zone provided', async () => {
            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)

                const result = await applyEdit({
                AssetId: 'ASSET#test',
                    RequestId: 'test-request',
                schema: '<Asset uuid=(test) />'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Asset not found')
            }
            expect(mockAppendChunk).not.toHaveBeenCalled()
        })

        it('should provide helpful error when createIfNeeded=true but no zone', async () => {
            MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(undefined)

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />',
                createIfNeeded: true
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('zone not specified')
            }
        })
    })

    describe("authoringPlayer extraction", () => {
        it('should extract player from internalCache', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            internalCacheMock.Connection.get.mockResolvedValue('player-abc-123')

            await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: testSchema,
                zone: 'Library'
            })

            expect(internalCacheMock.Connection.get).toHaveBeenCalledWith('player')
            expect(mockAppendChunk).toHaveBeenCalledWith(expect.objectContaining({
                authoringPlayer: 'player-abc-123'
            }))
        })

        it('should handle missing player gracefully', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            internalCacheMock.Connection.get.mockResolvedValue(undefined)

            await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: testSchema,
                zone: 'Library'
            })

            expect(mockAppendChunk).toHaveBeenCalledWith(expect.objectContaining({
                authoringPlayer: undefined
            }))
        })
    })

    describe("createIfNeeded flag", () => {
        it('should pass createIfNeeded=false by default', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: testSchema,
                zone: 'Canon'
            })

            expect(mockAppendChunk).toHaveBeenCalledWith(expect.objectContaining({
                createIfNeeded: false
            }))
        })

        it('should pass createIfNeeded=true when specified', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: testSchema,
                zone: 'Canon',
                createIfNeeded: true
            })

            expect(mockAppendChunk).toHaveBeenCalledWith(expect.objectContaining({
                createIfNeeded: true
            }))
        })
    })

    describe("result mapping", () => {
        it('should return success with schema on successful appendChunk', async () => {
            const testSchema = '<Asset uuid=(test)><Room uuid=(room1) /></Asset>'
            const mergedStandard = new StandardForm(testSchema)
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: false
                }
            })

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: testSchema,
                zone: 'Library'
            })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.schema).toBe(mergedStandard)
            }
        })

        it('should map appendChunk errors to applyEdit errors', async () => {
            mockAppendChunk.mockResolvedValue({
                success: false,
                error: 'Merge conflict',
                errorType: 'merge-conflict'
            })

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />',
                zone: 'Library'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Merge conflict')
            }
        })

        it('should handle asset not found error from appendChunk', async () => {
            mockAppendChunk.mockResolvedValue({
                success: false,
                error: 'Asset not found (both manifest and view missing)',
                errorType: 'not-found'
            })

            const result = await applyEdit({
                AssetId: 'ASSET#test',
                RequestId: 'test-request',
                schema: '<Asset uuid=(test) />',
                zone: 'Library'
            })

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Asset not found (both manifest and view missing)')
            }
        })
    })

    describe("complete workflow", () => {
        it('should orchestrate all steps correctly', async () => {
            const mockWorkspace = { zone: 'Library' }
                MockAssetWorkspace.fromUUID = jest.fn().mockResolvedValue(mockWorkspace)
                
            const editWML = '<Asset uuid=(test)><Room uuid=(kitchen) /></Asset>'
            const mergedStandard = new StandardForm(
                '<Asset uuid=(test)><Room uuid=(lobby) /><Room uuid=(kitchen) /></Asset>'
            )
            
            mockAppendChunk.mockResolvedValue({
                success: true,
                mergedContent: mergedStandard,
                metadata: {
                    chunkKey: 'test.wml/chunks/123.wml',
                    chunkSize: 100,
                    repairPerformed: true,
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: false
                    }
                }
            })

            internalCacheMock.Connection.get.mockResolvedValue('player-xyz')

                const result = await applyEdit({
                AssetId: 'ASSET#test',
                    RequestId: 'test-request',
                schema: editWML
            })

            // Verify zone lookup
            expect(MockAssetWorkspace.fromUUID).toHaveBeenCalledWith('ASSET#test')
            
            // Verify player extraction
            expect(internalCacheMock.Connection.get).toHaveBeenCalledWith('player')

            // Verify appendChunk call
            expect(mockAppendChunk).toHaveBeenCalledWith({
                assetId: 'ASSET#test',
                chunkWML: editWML,
                timestamp: 1234567890000,
                zone: 'Library',
                authoringPlayer: 'player-xyz',
                createIfNeeded: false
            })
            
            // Verify result
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.schema).toBe(mergedStandard)
            }
        })
    })
})
