/**
 * Storage Operations Tests
 * 
 * Tests for appendChunk and changeZone operations using mocked pipeline.
 * The pipeline's decision logic is tested separately in pipeline.test.ts.
 * 
 * Test focus: Verify that execution strategies behave correctly given
 * different repair decisions from the pipeline.
 */

import { appendChunk, changeZone } from './index'

// Mock the pipeline and dependencies that strategies call
jest.mock('./pipeline')
jest.mock('./chunks')
jest.mock('./snapshots')
jest.mock('./manifest')
jest.mock('./materializedView/reconstruction')
jest.mock('./materializedView')
jest.mock('@tonylb/mtw-asset-workspace/ts/clients')
jest.mock('uuid')
jest.mock('./AssetWorkspace')

import { applyStorageOperation, RepairDecision, FetchAndDecideResult } from './pipeline'
import { writeChunk } from './chunks'
import { writeSnapshot } from './snapshots'
import { appendManifestEvents } from './manifest'
import { updateContentByChunk } from './materializedView'
import AssetWorkspace from './AssetWorkspace'
import { reconstructFromManifest } from './materializedView/reconstruction'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { v4 as uuidv4 } from 'uuid'

const mockApplyStorageOperation = applyStorageOperation as jest.MockedFunction<typeof applyStorageOperation>
const mockWriteChunk = writeChunk as jest.MockedFunction<typeof writeChunk>
const mockWriteSnapshot = writeSnapshot as jest.MockedFunction<typeof writeSnapshot>
const mockAppendManifestEvents = appendManifestEvents as jest.MockedFunction<typeof appendManifestEvents>
const mockReconstructFromManifest = reconstructFromManifest as jest.MockedFunction<typeof reconstructFromManifest>
const mockUpdateContentByChunk = updateContentByChunk as jest.MockedFunction<typeof updateContentByChunk>
const mockS3Client = s3Client as jest.Mocked<typeof s3Client>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>
const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>

// Test constants
const TEST_TIMESTAMP = 1234567890000
const TEST_ISO_TIMESTAMP = new Date(TEST_TIMESTAMP).toISOString()
const TEST_ASSET_ID = 'ASSET#test-room' as any
const TEST_ZONE = 'Draft'
const TEST_PLAYER = 'player-123'

// Test WML content
const CHUNK_WML = '<Asset uuid=(test-room)><Room key=(main)><Replace key=(description)>New description</Replace></Room></Asset>'

let mockWorkspaceInstance: AssetWorkspace

const mockApplyStorageOperationHelper = ({
        baseline,
        repairDecision
    }: {
        baseline: StandardForm,
        repairDecision: RepairDecision
    }) => {
    mockApplyStorageOperation.mockImplementation(async (fetchArgs, operationArgs, strategy) => {
        MockAssetWorkspace.mockImplementation(() => {
            return {
                assetId: fetchArgs.assetId,
                zone: fetchArgs.zone,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                authStatus: { json: 'Initial', wml: 'Initial', s3Missing: false },
                standard: baseline,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                setJSON: jest.fn().mockResolvedValue(undefined),
                pushJSON: jest.fn().mockResolvedValue(undefined),
                pushWML: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationJSON: jest.fn().mockResolvedValue(undefined),
                pushAuthorizationWML: jest.fn().mockResolvedValue(undefined),
                s3KeyFor: jest.fn((type) => `${fetchArgs.assetId.replace('ASSET#', '')}.${type}`)
            } as any
        })
        mockWorkspaceInstance = new AssetWorkspace(fetchArgs.assetId, fetchArgs.zone)
        const fetchResult: FetchAndDecideResult = {
            baseline,
            repairDecision,
            workspace: mockWorkspaceInstance,
            manifest: []
        }
        
        return await strategy(baseline, repairDecision, fetchResult, operationArgs)
    })
}

describe('appendChunk (unit tests with mocked pipeline)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock uuidv4
        let uuidCounter = 0
        mockUuidv4.mockImplementation(() => `event-id-${++uuidCounter}`)
        
        // Mock strategy dependencies
        mockWriteChunk.mockResolvedValue({
            s3Key: `test-room.wml/chunks/${TEST_TIMESTAMP}-chunk-1.wml`,
            chunkSize: CHUNK_WML.length
        })
        
        mockWriteSnapshot.mockResolvedValue({
            s3Key: 'test-room.wml/snapshots/123.wml',
            snapshotSize: 1024
        })
        
        mockAppendManifestEvents.mockResolvedValue(undefined)
        
        mockUpdateContentByChunk.mockImplementation((baseline) => {
            // Return a merged StandardForm
            return baseline
        })
        
        // Default: Mock pipeline to call strategy with "no repair" decision
        mockApplyStorageOperationHelper({ baseline: new StandardForm(TEST_ASSET_ID), repairDecision: {} })
    })

    describe('normal operation - no repair needed', () => {
        it('should append chunk to existing content without repair', async () => {
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            // Setup: No repair decision (manifest and view exist)
            mockApplyStorageOperationHelper({ baseline: existingContent, repairDecision: {} })
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
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            // Setup: Lazy migration decision (manifest missing, view exists)
            mockApplyStorageOperationHelper({
                baseline: existingContent,
                repairDecision: {
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: false
                    },
                    snapshotToCreate: {
                        content: '<Asset uuid=(test-room) />'
                    }
                }
            })
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
                    content: expect.any(String)
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
                    s3Key: 'test-room.wml/snapshots/123.wml',
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
            const reconstructedContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            // Setup: Reconstruction decision (view missing, manifest exists)
            mockApplyStorageOperationHelper({
                baseline: reconstructedContent,
                repairDecision: {
                    repairActions: {
                        createdSnapshot: false,
                        reconstructedView: true,
                        synthesizedEmpty: false
                    }
                }
            })
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT create snapshot (manifest exists)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should apply chunk to reconstructed content
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
            const emptyContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            // Setup: Empty synthesis decision (both missing, createIfNeeded)
            mockApplyStorageOperationHelper({
                baseline: emptyContent,
                repairDecision: {
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: true
                    },
                    snapshotToCreate: {
                        content: '<Asset uuid=(test-room) />'
                    }
                }
            })
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
                    content: expect.any(String)
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
            // Setup: Pipeline returns error (both missing, can't create)
            mockApplyStorageOperation.mockResolvedValue({
                success: false,
                error: 'Asset not found (both manifest and view missing)',
                errorType: 'not-found'
            })
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                createIfNeeded: false
            })
            
            expect(result.success).toBe(false)
            if (result.success) return
            
            expect(result.errorType).toBe('not-found')
            expect(result.error).toContain('not found')
            
            // Should NOT write anything (error from pipeline, strategy not called)
            expect(mockWriteChunk).not.toHaveBeenCalled()
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
        })
        
        it('should error on merge conflict', async () => {
            const existingContent = new StandardForm(TEST_ASSET_ID)
            
            mockApplyStorageOperationHelper({ baseline: existingContent, repairDecision: {} })
            
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
            const existingContent = new StandardForm(TEST_ASSET_ID)
            const mergedContent = new StandardForm(TEST_ASSET_ID)
            
            mockApplyStorageOperationHelper({ baseline: existingContent, repairDecision: {} })
            mockUpdateContentByChunk.mockReturnValue(mergedContent)
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: CHUNK_WML,
                timestamp: TEST_TIMESTAMP,
                zone: 'Library'  // Different zone
            })
            
            expect(result.success).toBe(true)
            
            // Verify workspace was created with correct zone (via helper)
            expect(mockWorkspaceInstance.zone).toBe('Library')
            
            // pushJSON() and pushWML() will use workspace.zone for S3 tags
            expect(mockWorkspaceInstance.pushJSON).toHaveBeenCalled()
            expect(mockWorkspaceInstance.pushWML).toHaveBeenCalled()
        })
    })
    
    describe('authorization files', () => {
        it('should error when attempting authorization chunk merging (not yet implemented)', async () => {
            const existingAuth = new StandardAuthorizationCollection(TEST_ASSET_ID)
            
            // Setup: Auth baseline instead of content
            mockApplyStorageOperation.mockImplementation(async (fetchArgs, operationArgs, strategy) => {
                const fetchResult: FetchAndDecideResult = {
                    baseline: existingAuth,
                    repairDecision: {},
                    workspace: {} as any,
                    manifest: []
                }
                return await strategy(existingAuth, {}, fetchResult, operationArgs)
            })
            
            const result = await appendChunk({
                assetId: TEST_ASSET_ID,
                chunkWML: '<Asset uuid=(test-room)><Grant /></Asset>',
                timestamp: TEST_TIMESTAMP,
                zone: TEST_ZONE,
                suffix: 'auth.wml'
            })
            
            expect(result.success).toBe(false)
            if (result.success) return
            
            expect(result.errorType).toBe('validation')
            expect(result.error).toContain('Authorization chunk')
        })
    })
})

describe('changeZone (unit tests with mocked pipeline)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        let uuidCounter = 0
        mockUuidv4.mockImplementation(() => `event-id-${++uuidCounter}`)
        
        mockS3Client.updateTags = jest.fn().mockResolvedValue(undefined)
        mockWriteSnapshot.mockResolvedValue({
            s3Key: 'test-room.wml/snapshots/123.wml',
            snapshotSize: 1024
        })
        mockAppendManifestEvents.mockResolvedValue(undefined)
        
        // Default: no repair needed
        mockApplyStorageOperationHelper({
            baseline: new StandardForm(TEST_ASSET_ID),
            repairDecision: {}
        })
    })
    
    describe('normal operation - no repair needed', () => {
        it('should change zone for both content and auth files', async () => {
            // Setup: No repair decision
            mockApplyStorageOperationHelper({
                baseline: new StandardForm(TEST_ASSET_ID),
                repairDecision: {}
            })
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should call pipeline twice (content + auth)
            expect(mockApplyStorageOperation).toHaveBeenCalledTimes(2)
            
            // Should NOT create snapshots (no repair)
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
            // Setup: No repair decision
            mockApplyStorageOperationHelper({
                baseline: new StandardForm(TEST_ASSET_ID),
                repairDecision: {}
            })
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            
            // KEY TEST: Should use s3Client.updateTags (fast path)
            expect(mockS3Client.updateTags).toHaveBeenCalledTimes(4)  // 2 files × 2 prefixes
            
            // Should update content files
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.json',
                Tags: { Zone: 'Library' }
            })
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.wml',
                Tags: { Zone: 'Library' }
            })
            
            // Should update auth files
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.auth.ndjson',
                Tags: { Zone: 'Library' }
            })
            expect(mockS3Client.updateTags).toHaveBeenCalledWith({
                Key: 'test-room.auth.wml',
                Tags: { Zone: 'Library' }
            })
        })
    })
    
    describe('lazy migration - manifest missing', () => {
        it('should create snapshots and initialize manifests for both files', async () => {
            // Setup: Lazy migration decision
            mockApplyStorageOperationHelper({
                baseline: new StandardForm(TEST_ASSET_ID),
                repairDecision: {
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: false
                    },
                    snapshotToCreate: {
                        content: '<Asset uuid=(test-room) />'
                    }
                }
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
            
            // Should append batched events to both manifests
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
            // Setup: Reconstruction decision
            mockApplyStorageOperationHelper({
                baseline: new StandardForm(TEST_ASSET_ID),
                repairDecision: {
                    repairActions: {
                        createdSnapshot: false,
                        reconstructedView: true,
                        synthesizedEmpty: false
                    }
                }
            })
            
            const result = await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            expect(result.success).toBe(true)
            if (!result.success) return
            
            // Should NOT create snapshots (manifest exists)
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
            // Setup: Empty synthesis decision
            mockApplyStorageOperationHelper({
                baseline: new StandardForm(TEST_ASSET_ID),
                repairDecision: {
                    repairActions: {
                        createdSnapshot: true,
                        reconstructedView: false,
                        synthesizedEmpty: true
                    },
                    snapshotToCreate: {
                        content: '<Asset uuid=(test-room) />'
                    }
                }
            })
            
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
            
            // Track timing to verify parallel execution
            mockApplyStorageOperation.mockImplementation(async (fetchArgs, operationArgs, strategy) => {
                startTimes.push(Date.now())
                await new Promise(resolve => setTimeout(resolve, 10))
                endTimes.push(Date.now())
                
                return {
                    success: true,
                    repairPerformed: false
                } as any
            })
            
            await changeZone({
                assetId: TEST_ASSET_ID,
                fromZone: 'Draft',
                toZone: 'Library',
                timestamp: TEST_TIMESTAMP
            })
            
            // Should call pipeline twice
            expect(mockApplyStorageOperation).toHaveBeenCalledTimes(2)
            
            // Verify parallel execution (both start before either ends)
            expect(startTimes.length).toBe(2)
            expect(endTimes.length).toBe(2)
            expect(startTimes[1]).toBeLessThan(endTimes[0])
        })
    })
})