/**
 * appendChunk Operation Tests
 * 
 * Test matrix:
 * - 4 Scenarios (nothing missing, manifest missing, view missing, both missing)
 * - Success and error cases
 * - Zone metadata correctness
 * - Write optimization verification (no duplicate writes)
 */

import { appendChunk, AppendChunkArgs } from './index'

// Mock all dependencies
jest.mock('./manifest')
jest.mock('./chunks')
jest.mock('./snapshots')
jest.mock('./materializedView/reconstruction')
jest.mock('./materializedView')
jest.mock('./AssetWorkspace')
jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
jest.mock('uuid')

import { loadManifest, appendManifestEvents } from './manifest'
import { writeChunk } from './chunks'
import { writeSnapshot } from './snapshots'
import { reconstructFromManifest } from './materializedView/reconstruction'
import { updateContentByChunk } from './materializedView'
import AssetWorkspace from './AssetWorkspace'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { v4 as uuidv4 } from 'uuid'

const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockAppendManifestEvents = appendManifestEvents as jest.MockedFunction<typeof appendManifestEvents>
const mockWriteChunk = writeChunk as jest.MockedFunction<typeof writeChunk>
const mockWriteSnapshot = writeSnapshot as jest.MockedFunction<typeof writeSnapshot>
const mockReconstructFromManifest = reconstructFromManifest as jest.MockedFunction<typeof reconstructFromManifest>
const mockUpdateContentByChunk = updateContentByChunk as jest.MockedFunction<typeof updateContentByChunk>
const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>
const mockS3Client = s3Client as jest.Mocked<typeof s3Client>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

// Test constants
const TEST_TIMESTAMP = 1234567890000
const TEST_ISO_TIMESTAMP = new Date(TEST_TIMESTAMP).toISOString()
const TEST_ASSET_ID = 'ASSET#test-room' as any
const TEST_ZONE = 'Draft'
const TEST_PLAYER = 'player-123'

// Test WML content
const CHUNK_WML = '<Asset uuid=(test-room)><Room key=(main)><Replace key=(description)>New description</Replace></Room></Asset>'

describe('appendChunk', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock uuidv4 to return sequential predictable IDs
        let uuidCounter = 0
        mockUuidv4.mockImplementation(() => `event-id-${++uuidCounter}`)
        
        // Default mock: empty manifest (will trigger lazy migration)
        mockLoadManifest.mockResolvedValue([])
        
        // Default mock: chunk write succeeds
        mockWriteChunk.mockResolvedValue({
            s3Key: `test-room.wml/chunks/${TEST_TIMESTAMP}-chunk-1.wml`,
            chunkSize: CHUNK_WML.length
        })
        
        // Default mock: snapshot write succeeds
        mockWriteSnapshot.mockResolvedValue({
            s3Key: `test-room.wml/snapshots/${TEST_TIMESTAMP}.wml`,
            snapshotSize: 1024
        })
        
        // Default mock: manifest append succeeds
        mockAppendManifestEvents.mockResolvedValue(undefined)
        
        // Mock AssetWorkspace
        MockAssetWorkspace.mockImplementation((assetId, zone, player) => {
            const existingContent = new StandardForm(assetId)
            return {
                assetId,
                zone,
                player,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },  // File exists by default
                authStatus: { json: 'Initial', wml: 'Initial', s3Missing: false },
                standard: existingContent,  // Has content by default
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined),
                s3KeyFor: jest.fn((type) => `${assetId.replace('ASSET#', '')}.${type}`)
            } as any
        })
    })
    
    describe('normal operation - no repair needed', () => {
        it('should append chunk to existing content without repair', async () => {
            // Setup: manifest and view both exist
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
            ])
            
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)  // Mock merge result
            
            // Mock workspace with existing content
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                player: TEST_PLAYER,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                authStatus: { json: 'Initial', wml: 'Initial', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            // Mock merge succeeds
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                authoringPlayer: TEST_PLAYER
            })
            
            // Should succeed
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT reconstruct (view exists)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
            
            // Should NOT create snapshot (manifest exists, no lazy migration)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should apply chunk to existing content
            expect(mockUpdateContentByChunk).toHaveBeenCalledWith(existingContent, CHUNK_WML)
            
            // Should write chunk file
            expect(mockWriteChunk).toHaveBeenCalledWith({
                prefix: 'test-room.wml/',
                timestamp: TEST_TIMESTAMP,
                content: CHUNK_WML,
                zone: TEST_ZONE,
                authoringPlayer: TEST_PLAYER
            })
            
            // Should write materialized views ONCE
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalledTimes(1)
            
            // Should append ONLY chunk event to manifest (no repair events)
            expect(mockAppendManifestEvents).toHaveBeenCalledTimes(1)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                {
                    type: 'chunk',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: 'event-id-1',
                    s3Key: `test-room.wml/chunks/${TEST_TIMESTAMP}-chunk-1.wml`,
                    chunkSize: CHUNK_WML.length,
                    authoringPlayer: TEST_PLAYER
                }
            ])
            
            // Should return merged content
            expect(result.mergedContent).toBe(mergedContent)
            
            // Should NOT report repair
            expect(result.metadata.repairPerformed).toBe(false)
        })
    })
    
    describe('lazy migration - manifest missing, view exists', () => {
        it('should create snapshot and append chunk in single coordinated write', async () => {
            // Setup: empty manifest, view exists
            mockLoadManifest.mockResolvedValue([])
            
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                player: TEST_PLAYER,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                authoringPlayer: TEST_PLAYER
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT reconstruct (view exists)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
            
            // Should create snapshot with existing content
            expect(mockWriteSnapshot).toHaveBeenCalledTimes(1)
            expect(mockWriteSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'test-room.wml/',
                    timestamp: TEST_TIMESTAMP,
                    zone: TEST_ZONE,
                    snapshotType: 'initializeManifest',
                    chunksBeforeSnapshot: 0,
                    content: expect.any(String)  // Serialized existing content
                })
            )
            
            // Should apply chunk to existing content
            expect(mockUpdateContentByChunk).toHaveBeenCalledWith(existingContent, CHUNK_WML)
            
            // Should write materialized views ONCE (with merged content, not twice)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledWith(mergedContent)
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalledTimes(1)
            
            // Should append batched events (ZoneChange + Snapshot + Chunk)
            expect(mockAppendManifestEvents).toHaveBeenCalledTimes(1)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                {
                    type: 'zoneChange',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: 'event-id-1',
                    fromZone: null,
                    toZone: TEST_ZONE
                },
                {
                    type: 'snapshot',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: 'event-id-2',
                    s3Key: `test-room.wml/snapshots/${TEST_TIMESTAMP}.wml`,
                    snapshotType: 'initializeManifest',
                    chunksBeforeSnapshot: 0,
                    snapshotSize: 1024
                },
                {
                    type: 'chunk',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: 'event-id-3',
                    s3Key: `test-room.wml/chunks/${TEST_TIMESTAMP}-chunk-1.wml`,
                    chunkSize: CHUNK_WML.length,
                    authoringPlayer: TEST_PLAYER
                }
            ])
            
            // Should report repair performed
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: false
            })
        })
    })
    
    describe('reconstruction - view missing, manifest exists', () => {
        it('should reconstruct view in-memory and merge without intermediate write', async () => {
            // Setup: manifest exists, view missing
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
            ])
            
            const reconstructedContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            // Mock workspace with missing view
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                player: TEST_PLAYER,
                status: { json: 'Error', wml: 'Error', s3Missing: true },  // View missing!
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            // Mock reconstruction
            mockReconstructFromManifest.mockResolvedValue({
                type: 'content',
                standard: reconstructedContent,
                metadata: { snapshotUsed: false, chunksApplied: 2 }
            })
            
            // Mock merge
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should reconstruct view
            expect(mockReconstructFromManifest).toHaveBeenCalledWith('test-room.wml/')
            
            // Should NOT create snapshot (manifest exists)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should apply chunk to reconstructed content (in-memory)
            expect(mockUpdateContentByChunk).toHaveBeenCalledWith(reconstructedContent, CHUNK_WML)
            
            // KEY TEST: Should write materialized view ONCE with merged result (not twice!)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledWith(mergedContent)
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalledTimes(1)
            
            // Should append ONLY chunk event (no repair events, manifest exists)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                {
                    type: 'chunk',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: 'event-id-1',
                    s3Key: `test-room.wml/chunks/${TEST_TIMESTAMP}-chunk-1.wml`,
                    chunkSize: CHUNK_WML.length,
                    authoringPlayer: undefined
                }
            ])
            
            // Should report repair performed
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: false,
                reconstructedView: true,
                synthesizedEmpty: false
            })
        })
    })
    
    describe('empty synthesis - both missing, createIfNeeded', () => {
        it('should synthesize empty, merge, and write once', async () => {
            // Setup: both missing
            mockLoadManifest.mockResolvedValue([])
            
            const emptyContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                player: TEST_PLAYER,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                createIfNeeded: true
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT reconstruct (synthesizing empty)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
            
            // Should create snapshot with empty content
            expect(mockWriteSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotType: 'initializeManifest',
                    content: expect.any(String)  // Empty serialized content
                })
            )
            
            // Should merge chunk with empty baseline
            expect(mockUpdateContentByChunk).toHaveBeenCalled()
            
            // KEY TEST: Should write materialized view ONCE (not empty, then merged)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.setJSON).toHaveBeenCalledWith(mergedContent)
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalledTimes(1)
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalledTimes(1)
            
            // Should batch all events (ZoneChange + Snapshot + Chunk)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                expect.objectContaining({ type: 'zoneChange' }),
                expect.objectContaining({ type: 'snapshot' }),
                expect.objectContaining({ type: 'chunk' })
            ])
            
            // Should report repair performed
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: true
            })
        })
    })
    
    describe('error cases', () => {
        it('should error when asset not found and createIfNeeded is false', async () => {
            mockLoadManifest.mockResolvedValue([])
            
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                createIfNeeded: false  // Don't create
            })
            
            expect(result.success).toBe(false)
            if (result.success) return
            
            expect(result.errorType).toBe('not-found')
            expect(result.error).toContain('not found')
            
            // Should NOT write anything
            expect(mockWriteChunk).not.toHaveBeenCalled()
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
        })
        
        it('should error on merge conflict', async () => {
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
            ])
            
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            // Mock merge throws error
            mockUpdateContentByChunk.mockImplementation(() => {
                throw new Error('Merge conflict: overlapping changes')
            })
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE
            })
            
            expect(result.success).toBe(false)
            if (result.success) return
            
            expect(result.errorType).toBe('merge-conflict')
            expect(result.error).toContain('Merge conflict')
            
            // Should NOT write anything (failed before writes)
            expect(mockWriteChunk).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
        })
    })
    
    describe('zone and player metadata', () => {
        it('should use workspace zone for materialized view tags', async () => {
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: 'Library' }
            ])
            
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: 'Library',  // Should use this zone
                player: TEST_PLAYER,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: 'Library'  // This zone should be used throughout
            })
            
            expect(result.success).toBe(true)
            
            // Verify workspace was created with correct zone
            expect(MockAssetWorkspace).toHaveBeenCalledWith(TEST_ASSET_ID, 'Library')
            
            // pushJSON() and pushWML() will use workspace.zone for S3 tags
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalled()
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalled()
        })
    })
    
    describe('authorization files', () => {
        it('should error when attempting authorization chunk merging (not yet implemented)', async () => {
            // Setup: manifest and auth view both exist
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
            ])
            
            const { StandardAuthorizationCollection } = require('@tonylb/mtw-wml/ts/standardize/authorization')
            const existingAuth = new StandardAuthorizationCollection(TEST_ASSET_ID)
            
            const mockWorkspaceInstance = {
                assetId: TEST_ASSET_ID,
                zone: TEST_ZONE,
                authStatus: { json: 'Clean', wml: 'Clean', s3Missing: false },
                authorizations: existingAuth,  // Auth content exists
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined)
            }
            MockAssetWorkspace.mockReturnValue(mockWorkspaceInstance as any)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: '<Asset uuid=(test-room)><Grant /></Asset>',
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                suffix: 'auth.wml'
            })
            
            // Should error because auth chunk application not implemented yet
            expect(result.success).toBe(false)
            if (result.success) return
            
            expect(result.errorType).toBe('validation')
            expect(result.error).toContain('Authorization chunk')
        })
    })
})

describe('changeZone', () => {
    const { changeZone } = require('./index')
    
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock uuidv4 to return sequential predictable IDs
        let uuidCounter = 0
        mockUuidv4.mockImplementation(() => `event-id-${++uuidCounter}`)
        
        // Default mock: manifest exists
        mockLoadManifest.mockResolvedValue([
            { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: 'Draft' }
        ])
        
        // Default mock: snapshot write succeeds
        mockWriteSnapshot.mockResolvedValue({
            s3Key: `test-room.wml/snapshots/${TEST_TIMESTAMP}.wml`,
            snapshotSize: 1024
        })
        
        // Default mock: manifest append succeeds
        mockAppendManifestEvents.mockResolvedValue(undefined)
        
        // Default mock: s3Client.updateTags succeeds
        mockS3Client.updateTags = jest.fn().mockResolvedValue(undefined)
        
        // Mock AssetWorkspace
        MockAssetWorkspace.mockImplementation((assetId, zone, player) => {
            const existingContent = new StandardForm(assetId)
            const { StandardAuthorizationCollection } = require('@tonylb/mtw-wml/ts/standardize/authorization')
            const existingAuth = new StandardAuthorizationCollection(assetId)
            
            return {
                assetId,
                zone,
                player,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                authStatus: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                authorizations: existingAuth,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationWML: jest.fn().mockResolvedValue(undefined),
                s3KeyFor: jest.fn((type) => `${assetId.replace('ASSET#', '')}.${type}`)
            } as any
        })
    })
    
    describe('normal operation - no repair needed', () => {
        it('should change zone for both content and auth files', async () => {
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should call loadManifest for both content and auth
            expect(mockLoadManifest).toHaveBeenCalledTimes(2)
            expect(mockLoadManifest).toHaveBeenCalledWith('test-room.wml/')
            expect(mockLoadManifest).toHaveBeenCalledWith('test-room.auth.wml/')
            
            // Should NOT create snapshots (manifests exist, no lazy migration)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should append zone change events to both manifests
            expect(mockAppendManifestEvents).toHaveBeenCalledTimes(2)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                {
                    type: 'zoneChange',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: expect.any(String),
                    fromZone: 'Draft',
                    toZone: 'Library'
                }
            ])
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.auth.wml/', [
                {
                    type: 'zoneChange',
                    timestamp: TEST_ISO_TIMESTAMP,
                    eventId: expect.any(String),
                    fromZone: 'Draft',
                    toZone: 'Library'
                }
            ])
            
            // Should NOT report repair
            expect(result.metadata.repairPerformed).toBe(false)
        })
        
        it('should use fast tag-update path when no repair needed', async () => {
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            
            // KEY TEST: Should use s3Client.updateTags (fast path), not push methods
            expect(mockS3Client.updateTags).toHaveBeenCalledTimes(4)  // 2 files × 2 prefixes (content + auth)
            
            // Should update both content files
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.json',
                Tags: { Zone: 'Library' }
            })
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.wml',
                Tags: { Zone: 'Library' }
            })
            
            // Should update both auth files
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.auth.ndjson',
                Tags: { Zone: 'Library' }
            })
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.auth.wml',
                Tags: { Zone: 'Library' }
            })
            
            // Should NOT rewrite content (pushJSON/pushWML not called in fast path)
            // Note: We can't easily verify this with the current mock structure,
            // but the updateTags calls prove we're using the optimized path
        })
    })
    
    describe('lazy migration - manifest missing', () => {
        it('should create snapshots and initialize manifests for both files', async () => {
            // Empty manifests (missing)
            mockLoadManifest.mockResolvedValue([])
            
            // Mock snapshots for content and auth
            mockWriteSnapshot
                .mockResolvedValueOnce({
                    s3Key: `test-room.wml/snapshots/${TEST_TIMESTAMP}.wml`,
                    snapshotSize: 1024
                })
                .mockResolvedValueOnce({
                    s3Key: `test-room.auth.wml/snapshots/${TEST_TIMESTAMP}.wml`,
                    snapshotSize: 512
                })
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should create snapshots for both content and auth
            expect(mockWriteSnapshot).toHaveBeenCalledTimes(2)
            expect(mockWriteSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'test-room.wml/',
                    zone: 'Draft',  // Snapshot captures state BEFORE zone change
                    snapshotType: 'initializeManifest',
                    content: expect.any(String)
                })
            )
            expect(mockWriteSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'test-room.auth.wml/',
                    zone: 'Draft',
                    snapshotType: 'initializeManifest',
                    content: expect.any(String)
                })
            )
            
            // Should append batched events (initial ZoneChange + Snapshot + actual ZoneChange)
            expect(mockAppendManifestEvents).toHaveBeenCalledTimes(2)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                expect.objectContaining({ type: 'zoneChange', fromZone: null, toZone: 'Draft' }),
                expect.objectContaining({ type: 'snapshot' }),
                expect.objectContaining({ type: 'zoneChange', fromZone: 'Draft', toZone: 'Library' })
            ])
            
            // Should report repair
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: false
            })
        })
    })
    
    describe('reconstruction - view missing', () => {
        it('should reconstruct views from manifests', async () => {
            // Manifests exist
            mockLoadManifest.mockResolvedValue([
                { type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: 'Draft' }
            ])
            
            // Mock workspaces with missing views
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },  // Content missing
                authStatus: { json: 'Error', wml: 'Error', s3Missing: true },  // Auth missing
                standard: undefined,
                authorizations: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationWML: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            // Mock reconstruction
            const { StandardAuthorizationCollection } = require('@tonylb/mtw-wml/ts/standardize/authorization')
            mockReconstructFromManifest
                .mockResolvedValueOnce({
                    type: 'content',
                    standard: new StandardForm(TEST_ASSET_ID),
                    metadata: { snapshotUsed: false, chunksApplied: 0 }
                })
                .mockResolvedValueOnce({
                    type: 'auth',
                    authorization: new StandardAuthorizationCollection(TEST_ASSET_ID),
                    metadata: { snapshotUsed: false, chunksApplied: 0 }
                })
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should reconstruct both content and auth
            expect(mockReconstructFromManifest).toHaveBeenCalledTimes(2)
            expect(mockReconstructFromManifest).toHaveBeenCalledWith('test-room.wml/')
            expect(mockReconstructFromManifest).toHaveBeenCalledWith('test-room.auth.wml/')
            
            // Should NOT create snapshots (manifests exist)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should append ONLY zone change events (no repair events)
            expect(mockAppendManifestEvents).toHaveBeenCalledWith('test-room.wml/', [
                expect.objectContaining({ type: 'zoneChange', fromZone: 'Draft', toZone: 'Library' })
            ])
            
            // Should report repair
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: false,
                reconstructedView: true,
                synthesizedEmpty: false
            })
        })
    })
    
    describe('empty synthesis - both missing', () => {
        it('should synthesize empty content and auth', async () => {
            // Empty manifests
            mockLoadManifest.mockResolvedValue([])
            
            // Mock workspaces with everything missing
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                authStatus: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                authorizations: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationWML: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT reconstruct (synthesizing empty)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
            
            // Should create snapshots for both
            expect(mockWriteSnapshot).toHaveBeenCalledTimes(2)
            
            // Should report synthesis
            expect(result.metadata.repairPerformed).toBe(true)
            expect(result.metadata.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: true
            })
        })
    })
    
    describe('parallel processing', () => {
        it('should process content and auth in parallel', async () => {
            const startTimes: number[] = []
            const endTimes: number[] = []
            
            // Track when each loadManifest call starts and ends
            mockLoadManifest.mockImplementation(async (prefix: string) => {
                startTimes.push(Date.now())
                await new Promise(resolve => setTimeout(resolve, 10))  // Simulate async work
                endTimes.push(Date.now())
                return [{  type: 'zoneChange', timestamp: TEST_ISO_TIMESTAMP, eventId: 'event-0', fromZone: null, toZone: 'Draft' }]
            })
            
            await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            // If parallel, both should start before either ends
            expect(startTimes.length).toBe(2)
            expect(endTimes.length).toBe(2)
            
            // Both should start before the first one ends (parallel execution)
            expect(startTimes[1]).toBeLessThan(endTimes[0])
        })
    })
})


