import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock s3Client from mtw-asset-workspace
jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'

import { moveAsset } from './index'
import { isMoveAssetRequest, MoveAssetRequest } from '../coordinationSerializer'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>

describe('moveAsset', () => {
    const assetId = 'ASSET#test-asset'

    beforeEach(() => {
        jest.clearAllMocks()
        s3ClientMock.updateTags.mockResolvedValue()
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

    describe('moveAsset - Phase 1 Tag-Based Implementation', () => {
        it('should successfully move asset between zones using tag updates', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'  // Deprecated but kept for backward compatibility
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(result.message).toContain('zone changed')
            expect(result.message).toContain('Personal')
            expect(result.message).toContain('Library')
            expect(result.newLocation).toBe('test-asset')
            
            // Phase 1: Verify S3 tag updates were called (4 files)
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith({
                Key: 'test-asset.wml',
                Tags: { Zone: 'Library' }
            })
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith({
                Key: 'test-asset.ndjson',
                Tags: { Zone: 'Library' }
            })
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith({
                Key: 'test-asset.auth.wml',
                Tags: { Zone: 'Library' }
            })
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith({
                Key: 'test-asset.auth.ndjson',
                Tags: { Zone: 'Library' }
            })
        })

        it('should handle Library to Canon transitions', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('test-asset')
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith(expect.objectContaining({
                Tags: { Zone: 'Canon' }
            }))
        })

        it('should reject moves from Canon/Library to Personal (immutable metadata limitation)', async () => {
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
            expect(s3ClientMock.updateTags).not.toHaveBeenCalled()
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
            expect(s3ClientMock.updateTags).not.toHaveBeenCalled()
        })

        it('should handle Archive zone correctly (deferred to Phase 2)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Archive'
            }
            
            const result = await moveAsset(assetId, request)
            
            // Phase 1: Archive functionality deferred to Phase 2
            expect(result.success).toBe(false)
            expect(result.message).toContain('Archive functionality deferred to Phase 2')
            expect(s3ClientMock.updateTags).not.toHaveBeenCalled()
        })

        it('should handle S3 tagging errors gracefully', async () => {
            s3ClientMock.updateTags.mockRejectedValue(new Error('S3 tagging failed'))
            
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Failed to update zone tags')
        })

        it('should extract fileName from AssetId with ASSET# prefix', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('test-asset')
            expect(s3ClientMock.updateTags).toHaveBeenCalledWith(expect.objectContaining({
                Key: 'test-asset.wml'  // Verifies ASSET# prefix was stripped
            }))
        })

        it('should allow Draft to Personal moves (same metadata required)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Draft',
                toZone: 'Personal'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
        })

        it('should allow Canon to Library moves (decanonization)', async () => {
            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Canon',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
        })
    })
})
