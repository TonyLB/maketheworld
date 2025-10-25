import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock s3Client from mtw-asset-workspace
jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'

// Mock manifest operations
jest.mock('../../s3Storage/manifest')
import { loadManifest } from '../../s3Storage/manifest'

// Mock helper function
jest.mock('../utilities/appendManifestEventsWithLazyMigration')
import { appendManifestEventsWithLazyMigration } from '../utilities/appendManifestEventsWithLazyMigration'

// Mock AssetWorkspace
jest.mock('../../s3Storage/AssetWorkspace')
import AssetWorkspace from '../../s3Storage/AssetWorkspace'

// Mock utilities
jest.mock('uuid', () => ({
    v4: jest.fn()
}))
jest.mock('../../utilities/mockableTime', () => ({
    now: jest.fn()
}))

import { v4 as uuidv4 } from 'uuid'
import { now } from '../../utilities/mockableTime'

import { moveAsset } from './index'
import { isMoveAssetRequest, MoveAssetRequest } from '../coordinationSerializer'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>
const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockAppendManifestEventsWithLazyMigration = appendManifestEventsWithLazyMigration as jest.MockedFunction<typeof appendManifestEventsWithLazyMigration>
const mockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>
const mockNow = now as jest.MockedFunction<typeof now>

describe('moveAsset', () => {
    const assetId = 'ASSET#test-asset'

    beforeEach(() => {
        jest.clearAllMocks()
        s3ClientMock.updateTags.mockResolvedValue()
        mockLoadManifest.mockResolvedValue([])
        mockAppendManifestEventsWithLazyMigration.mockResolvedValue()
        mockUuidv4.mockReturnValue('test-uuid-123')
        mockNow.mockReturnValue(1234567890)
        
        // Mock AssetWorkspace instances
        const mockWorkspace = {
            loadJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
            loadAuthorizationJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
            standard: { _components: [] },
            authorizations: { _grants: [] }
        }
        mockAssetWorkspace.mockImplementation(() => mockWorkspace as any)
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
            
            // Phase 1: Verify S3 tag updates were called (4 materialized views) 
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

    describe('moveAsset - Chunk-Based Assets', () => {
        it('should handle assets with content only', async () => {
            // Mock AssetWorkspace with content but no auth
            const mockWorkspace = {
                loadJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                loadAuthorizationJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                standard: { _components: [{ type: 'Room' }] },
                authorizations: { _grants: [] }
            }
            mockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            
            // Should use lazy migration helper for both content and auth
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledTimes(2)
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledWith(
                'test-asset.wml/',
                mockWorkspace,
                1234567890,
                [{
                    type: 'zoneChange',
                    timestamp: '1970-01-15T06:56:07.890Z',
                    eventId: 'test-uuid-123',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }]
            )
            
            // Should update tags on all objects
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
        })

        it('should handle assets with both content and auth', async () => {
            // Mock AssetWorkspace with both content and auth
            const mockWorkspace = {
                loadJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                loadAuthorizationJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                standard: { _components: [{ type: 'Room' }] },
                authorizations: { _grants: [{ type: 'Permission' }] }
            }
            mockAssetWorkspace.mockImplementation(() => mockWorkspace as any)

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            
            // Should use lazy migration helper for both content and auth
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledTimes(2)
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledWith(
                'test-asset.wml/',
                mockWorkspace,
                1234567890,
                [{
                    type: 'zoneChange',
                    timestamp: '1970-01-15T06:56:07.890Z',
                    eventId: 'test-uuid-123',
                    fromZone: 'Personal',
                    toZone: 'Library'
                }]
            )
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledWith(
                'test-asset.auth.wml/',
                mockWorkspace,
                1234567890,
                [{
                    type: 'zoneChange',
                    timestamp: '1970-01-15T06:56:07.890Z',
                    eventId: 'test-uuid-123',
                    fromZone: 'Personal',
                    toZone: 'Library'
                }]
            )
            
            // Should update tags on all objects
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
        })

        it('should handle assets with no content (legacy behavior)', async () => {
            // Mock AssetWorkspace with no content or auth
            const mockWorkspace = {
                loadJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                loadAuthorizationJSON: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
                standard: { _components: [] },
                authorizations: { _grants: [] }
            }
            mockAssetWorkspace.mockReturnValue(mockWorkspace as any)

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(true)
            
            // Should use lazy migration helper for both content and auth (even with no content)
            expect(mockAppendManifestEventsWithLazyMigration).toHaveBeenCalledTimes(2)
            
            // Should update tags on all objects (manifests + materialized views)
            expect(s3ClientMock.updateTags).toHaveBeenCalledTimes(4)
        })

        it('should handle AssetWorkspace loading errors gracefully', async () => {
            mockAssetWorkspace.mockImplementation(() => {
                throw new Error('S3 access denied')
            })

            const request: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(assetId, request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('Failed to update zone tags')
        })
    })
})
