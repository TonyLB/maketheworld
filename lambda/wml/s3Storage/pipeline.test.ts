/**
 * Storage Pipeline Tests
 * 
 * Tests for the generic fetch-and-decide pipeline.
 * 
 * Focus: Testing that the pipeline makes correct repair decisions
 * and passes them to execution strategies, without testing the full
 * operation flow (that's what index.test.ts does).
 */

import { 
    fetchAndDecideRepair,
    applyStorageOperation,
    ExecutionStrategy,
    RepairDecision,
    FetchAndDecideResult
} from './pipeline'

// Mock dependencies
jest.mock('./manifest')
jest.mock('./materializedView/reconstruction')
jest.mock('./AssetWorkspace')

import { loadManifest } from './manifest'
import { reconstructFromManifest } from './materializedView/reconstruction'
import AssetWorkspace from './AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'

const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockReconstructFromManifest = reconstructFromManifest as jest.MockedFunction<typeof reconstructFromManifest>
const MockAssetWorkspace = AssetWorkspace as jest.MockedClass<typeof AssetWorkspace>

const TEST_ASSET_ID = 'ASSET#test-room' as any
const TEST_ZONE = 'Draft'

describe('fetchAndDecideRepair', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Default: manifest exists
        mockLoadManifest.mockResolvedValue([
            { type: 'zoneChange', timestamp: '2025-01-01T00:00:00.000Z', eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
        ])
        
        // Default: workspace with existing content
        MockAssetWorkspace.mockImplementation((assetId, zone) => {
            const existingContent = new StandardForm(assetId)
            return {
                assetId,
                zone,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                authStatus: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined),
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined)
            } as any
        })
    })
    
    describe('decision: no repair needed', () => {
        it('should return existing baseline with no repair decision', async () => {
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            })
            
            expect(result).not.toHaveProperty('errorType')
            if ('errorType' in result) return
            
            // Should use existing content
            expect(result.baseline).toBeInstanceOf(StandardForm)
            
            // Should NOT have repair decision
            expect(result.repairDecision.repairActions).toBeUndefined()
            expect(result.repairDecision.snapshotToCreate).toBeUndefined()
            
            // Should NOT reconstruct
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
        })
    })
    
    describe('decision: lazy migration (manifest missing, view exists)', () => {
        it('should decide to create snapshot from existing view', async () => {
            // Empty manifest (missing)
            mockLoadManifest.mockResolvedValue([])
            
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            })
            
            expect(result).not.toHaveProperty('errorType')
            if ('errorType' in result) return
            
            // Should use existing content as baseline
            expect(result.baseline).toBeInstanceOf(StandardForm)
            
            // Should decide to create snapshot
            expect(result.repairDecision.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: false
            })
            
            // Should have content for snapshot
            expect(result.repairDecision.snapshotToCreate).toBeDefined()
            expect(result.repairDecision.snapshotToCreate?.content).toContain('<Asset')
            
            // Should NOT reconstruct (view exists)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
        })
    })
    
    describe('decision: reconstruction (view missing, manifest exists)', () => {
        it('should decide to reconstruct from manifest', async () => {
            // Mock workspace with missing view
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },  // View missing!
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            // Mock reconstruction
            const reconstructedContent = new StandardForm(TEST_ASSET_ID)
            mockReconstructFromManifest.mockResolvedValue({
                type: 'content',
                standard: reconstructedContent,
                metadata: { snapshotUsed: false, chunksApplied: 2 }
            })
            
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            })
            
            expect(result).not.toHaveProperty('errorType')
            if ('errorType' in result) return
            
            // Should use reconstructed content
            expect(result.baseline).toBe(reconstructedContent)
            
            // Should decide reconstruction was needed
            expect(result.repairDecision.repairActions).toEqual({
                createdSnapshot: false,
                reconstructedView: true,
                synthesizedEmpty: false
            })
            
            // Should NOT need snapshot (manifest exists)
            expect(result.repairDecision.snapshotToCreate).toBeUndefined()
            
            // Should have called reconstruct
            expect(mockReconstructFromManifest).toHaveBeenCalledWith('test-room.wml/')
        })
    })
    
    describe('decision: empty synthesis (both missing, createIfNeeded)', () => {
        it('should decide to synthesize empty content', async () => {
            // Empty manifest
            mockLoadManifest.mockResolvedValue([])
            
            // Mock workspace with missing view
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: true  // Allow creation
            })
            
            expect(result).not.toHaveProperty('errorType')
            if ('errorType' in result) return
            
            // Should synthesize empty StandardForm
            expect(result.baseline).toBeInstanceOf(StandardForm)
            expect(result.baseline.universalKey).toBe(TEST_ASSET_ID)
            
            // Should decide synthesis was needed
            expect(result.repairDecision.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: true
            })
            
            // Should have empty content for snapshot
            expect(result.repairDecision.snapshotToCreate).toBeDefined()
            expect(result.repairDecision.snapshotToCreate?.content).toContain('<Asset')
            
            // Should NOT reconstruct (synthesizing empty)
            expect(mockReconstructFromManifest).not.toHaveBeenCalled()
        })
        
        it('should error when both missing and createIfNeeded is false', async () => {
            mockLoadManifest.mockResolvedValue([])
            
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false  // Don't allow creation
            })
            
            // Should return error
            expect(result).toHaveProperty('errorType')
            if (!('errorType' in result)) return
            
            expect(result.success).toBe(false)
            expect(result.errorType).toBe('not-found')
            expect(result.error).toContain('not found')
        })
    })
    
    describe('authorization files', () => {
        it('should handle auth suffix for reconstruction', async () => {
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                authStatus: { json: 'Error', wml: 'Error', s3Missing: true },
                authorizations: undefined,
                loadAuthorizationJSON: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            const reconstructedAuth = new StandardAuthorizationCollection(TEST_ASSET_ID)
            mockReconstructFromManifest.mockResolvedValue({
                type: 'auth',
                authorization: reconstructedAuth,
                metadata: { snapshotUsed: false, chunksApplied: 0 }
            })
            
            const result = await fetchAndDecideRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'auth.wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            })
            
            expect(result).not.toHaveProperty('errorType')
            if ('errorType' in result) return
            
            // Should use reconstructed auth
            expect(result.baseline).toBeInstanceOf(StandardAuthorizationCollection)
            expect(result.repairDecision.repairActions?.reconstructedView).toBe(true)
            
            // Should reconstruct with auth prefix
            expect(mockReconstructFromManifest).toHaveBeenCalledWith('test-room.auth.wml/')
        })
    })
})

describe('applyStorageOperation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        mockLoadManifest.mockResolvedValue([
            { type: 'zoneChange', timestamp: '2025-01-01T00:00:00.000Z', eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
        ])
        
        MockAssetWorkspace.mockImplementation((assetId, zone) => {
            const existingContent = new StandardForm(assetId)
            return {
                assetId,
                zone,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any
        })
    })
    
    describe('strategy execution', () => {
        it('should pass baseline and repair decision to strategy', async () => {
            const mockStrategy = jest.fn().mockResolvedValue({
                result: 'success'
            }) as jest.MockedFunction<ExecutionStrategy<{ value: string }, { result: string }>>
            
            const result = await applyStorageOperation(
                {
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    zone: TEST_ZONE,
                    createIfNeeded: false
                },
                { value: 'test-arg' },
                mockStrategy
            )
            
            // Strategy should have been called
            expect(mockStrategy).toHaveBeenCalledTimes(1)
            
            // Strategy should receive baseline
            const [baseline, repairDecision, fetchResult, args] = mockStrategy.mock.calls[0]
            expect(baseline).toBeInstanceOf(StandardForm)
            
            // Strategy should receive repair decision (none in this case)
            expect(repairDecision.repairActions).toBeUndefined()
            
            // Strategy should receive full fetch result
            expect(fetchResult.workspace).toBeDefined()
            expect(fetchResult.manifest).toBeDefined()
            
            // Strategy should receive operation args
            expect(args).toEqual({ value: 'test-arg' })
            
            // Should return strategy result
            expect(result).toEqual({ result: 'success' })
        })
        
        it('should pass repair decision when repair is needed', async () => {
            // Empty manifest (lazy migration scenario)
            mockLoadManifest.mockResolvedValue([])
            
            const mockStrategy = jest.fn().mockResolvedValue({
                result: 'success'
            }) as jest.MockedFunction<ExecutionStrategy<{}, { result: string }>>
            
            await applyStorageOperation(
                {
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    zone: TEST_ZONE,
                    createIfNeeded: false
                },
                {},
                mockStrategy
            )
            
            // Strategy should receive repair decision
            const [baseline, repairDecision] = mockStrategy.mock.calls[0]
            
            expect(repairDecision.repairActions).toEqual({
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: false
            })
            
            expect(repairDecision.snapshotToCreate).toBeDefined()
            expect(repairDecision.snapshotToCreate?.content).toContain('<Asset')
        })
    })
    
    describe('error handling', () => {
        it('should return fetch error without calling strategy', async () => {
            // Both missing, createIfNeeded false
            mockLoadManifest.mockResolvedValue([])
            
            MockAssetWorkspace.mockImplementation((assetId, zone) => ({
                assetId,
                zone,
                status: { json: 'Error', wml: 'Error', s3Missing: true },
                standard: undefined,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any))
            
            const mockStrategy = jest.fn() as jest.MockedFunction<ExecutionStrategy<{}, any>>
            
            const result = await applyStorageOperation(
                {
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    zone: TEST_ZONE,
                    createIfNeeded: false  // Don't allow creation
                },
                {},
                mockStrategy
            )
            
            // Should return error
            expect(result).toHaveProperty('errorType')
            if (!('errorType' in result)) return
            
            expect(result.success).toBe(false)
            expect(result.errorType).toBe('not-found')
            
            // Strategy should NOT be called
            expect(mockStrategy).not.toHaveBeenCalled()
        })
        
        it('should catch and wrap strategy errors', async () => {
            const mockStrategy = jest.fn().mockRejectedValue(
                new Error('S3 write failed')
            ) as jest.MockedFunction<ExecutionStrategy<{}, any>>
            
            const result = await applyStorageOperation(
                {
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    zone: TEST_ZONE,
                    createIfNeeded: false
                },
                {},
                mockStrategy
            )
            
            // Should catch error and return failure
            expect(result).toHaveProperty('errorType')
            if (!('errorType' in result)) return
            
            expect(result.success).toBe(false)
            expect(result.errorType).toBe('s3-error')
            expect(result.error).toContain('S3 write failed')
        })
    })
})

describe('pipeline integration', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        
        mockLoadManifest.mockResolvedValue([
            { type: 'zoneChange', timestamp: '2025-01-01T00:00:00.000Z', eventId: 'event-0', fromZone: null, toZone: TEST_ZONE }
        ])
        
        MockAssetWorkspace.mockImplementation((assetId, zone) => {
            const existingContent = new StandardForm(assetId)
            return {
                assetId,
                zone,
                status: { json: 'Clean', wml: 'Clean', s3Missing: false },
                standard: existingContent,
                loadJSON: jest.fn().mockResolvedValue(undefined)
            } as any
        })
    })
    
    it('should enable optimization based on repair decision', async () => {
        // This demonstrates the pattern: strategies can branch on repair decision
        
        const executionLog: string[] = []
        
        const mockStrategy = jest.fn(
            async (baseline, repairDecision, fetchResult, args) => {
                if (!repairDecision.repairActions) {
                    // FAST PATH: No repair needed
                    executionLog.push('fast-path')
                    return { optimized: true }
                } else {
                    // SLOW PATH: Repair needed
                    executionLog.push('slow-path')
                    return { optimized: false }
                }
            }
        ) as any  // Type assertion - matches ExecutionStrategy signature
        
        // Test 1: No repair needed
        const result1 = await applyStorageOperation(
            {
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            },
            {},
            mockStrategy
        )
        
        expect(executionLog).toEqual(['fast-path'])
        expect(result1).toEqual({ optimized: true })
        
        // Test 2: Repair needed (lazy migration)
        executionLog.length = 0
        mockLoadManifest.mockResolvedValue([])  // Empty manifest
        
        const result2 = await applyStorageOperation(
            {
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                zone: TEST_ZONE,
                createIfNeeded: false
            },
            {},
            mockStrategy
        )
        
        expect(executionLog).toEqual(['slow-path'])
        expect(result2).toEqual({ optimized: false })
    })
})

