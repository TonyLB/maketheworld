import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock changeZone from s3Storage
jest.mock('../../s3Storage')
import { changeZone } from '../../s3Storage'

// Mock utilities
jest.mock('../../utilities/mockableTime', () => ({
    now: jest.fn()
}))

import { now } from '../../utilities/mockableTime'
import { moveAsset } from './index'
import { isMoveAssetRequest, MoveAssetRequest } from '../localApiEvents'

const mockChangeZone = changeZone as jest.MockedFunction<typeof changeZone>
const mockNow = now as jest.MockedFunction<typeof now>

describe('moveAsset', () => {
    const assetId = 'ASSET#test-asset'

    beforeEach(() => {
        jest.clearAllMocks()
        
        // Setup deterministic time
        mockNow.mockReturnValue(1234567890000)
    })

    describe('isMoveAssetRequest', () => {
        it('should validate a proper MoveAssetRequest', () => {
            const validRequest: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice',
                subFolder: 'adventures'
            }
            
            expect(isMoveAssetRequest(validRequest)).toBe(true)
        })

        it('should reject invalid requests', () => {
            expect(isMoveAssetRequest({ type: 'Move Asset' })).toBe(false)
            expect(isMoveAssetRequest({ type: 'Move Asset', fromZone: 'Personal' })).toBe(false)
            expect(isMoveAssetRequest({ type: 'Move Asset', fromZone: 'Personal', toZone: 'Library' })).toBe(true)
        })

        it('should handle optional fields correctly', () => {
            const minimalRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            expect(isMoveAssetRequest(minimalRequest)).toBe(true)
        })
    })

    describe('zone transition validation', () => {
        it('should reject moves from Library to Personal (immutable metadata limitation)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Personal',
                player: 'alice'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Cannot move from Library to Personal')
            expect(result.message).toContain('player metadata')
            expect(mockChangeZone).not.toHaveBeenCalled()
        })

        it('should reject moves from Canon to Draft (immutable metadata limitation)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Canon',
                toZone: 'Draft'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Cannot move from Canon to Draft')
            expect(result.message).toContain('player metadata')
            expect(mockChangeZone).not.toHaveBeenCalled()
        })

        it('should reject moves from Canon to Personal (immutable metadata limitation)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Canon',
                toZone: 'Personal'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Cannot move from Canon to Personal')
            expect(mockChangeZone).not.toHaveBeenCalled()
        })

        it('should reject moves from Library to Draft (immutable metadata limitation)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Draft'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Cannot move from Library to Draft')
            expect(mockChangeZone).not.toHaveBeenCalled()
        })
    })

    describe('Archive zone handling', () => {
        it('should allow moves to Archive zone (archiving)', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Archive'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalledWith({
                assetId: 'ASSET#test-asset',
                fromZone: 'Library',
                toZone: 'Archive',
                timestamp: 1234567890000,
                player: undefined,
            })
            expect(result.success).toBe(true)
            expect(result.message).toContain('zone changed from Library to Archive')
        })

        it('should allow moves from Archive zone (restoring)', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Archive',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalledWith({
                assetId: 'ASSET#test-asset',
                fromZone: 'Archive',
                toZone: 'Library',
                timestamp: 1234567890000,
                player: undefined,
            })
            expect(result.success).toBe(true)
            expect(result.message).toContain('zone changed from Archive to Library')
        })
    })

    describe('successful zone transitions', () => {
        it('should delegate Personal to Library move to changeZone', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalledWith({
                assetId: 'ASSET#test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                timestamp: 1234567890000,
                player: 'alice',
            })

            expect(result.success).toBe(true)
            expect(result.message).toContain('zone changed')
            expect(result.message).toContain('Personal')
            expect(result.message).toContain('Library')
            expect(result.newLocation).toBe('test-asset')
        })

        it('should delegate Library to Canon move to changeZone', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalledWith({
                assetId: 'ASSET#test-asset',
                fromZone: 'Library',
                toZone: 'Canon',
                timestamp: 1234567890000,
                player: undefined,
            })
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('test-asset')
        })

        it('should allow Draft to Personal moves', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Draft',
                toZone: 'Personal'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalled()
            expect(result.success).toBe(true)
        })

        it('should allow Canon to Library moves (decanonization)', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Canon',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(mockChangeZone).toHaveBeenCalled()
            expect(result.success).toBe(true)
        })

        it('should extract fileName from AssetId with ASSET# prefix', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: false
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('test-asset')
        })
    })

    describe('error handling', () => {
        it('should map changeZone errors to moveAsset errors', async () => {
            mockChangeZone.mockResolvedValue({
                success: false,
                error: 'Asset not found',
                errorType: 'not-found'
            })
            
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toBe('Asset not found')
        })

        it('should handle S3 errors from changeZone', async () => {
            mockChangeZone.mockResolvedValue({
                success: false,
                error: 'S3 operation failed',
                errorType: 's3-error'
            })
            
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toBe('S3 operation failed')
        })
    })

    describe('complete workflow', () => {
        it('should orchestrate all steps correctly for successful move', async () => {
            mockChangeZone.mockResolvedValue({
                success: true,
                metadata: {
                    repairPerformed: true,
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: false
                    }
                }
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(assetId, request)
            
            // Verify changeZone was called with correct args
            expect(mockChangeZone).toHaveBeenCalledWith({
                assetId: 'ASSET#test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                timestamp: 1234567890000,
                player: 'alice',
            })

            // Verify result mapping
            expect(result.success).toBe(true)
            expect(result.message).toContain('zone changed from Personal to Library')
            expect(result.newLocation).toBe('test-asset')
        })
    })
})
