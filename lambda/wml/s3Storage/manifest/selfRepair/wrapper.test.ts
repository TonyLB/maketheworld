/**
 * Tests for withS3SelfRepair wrapper
 * 
 * Test coverage:
 * - Normal operation (no repair needed)
 * - Manifest missing scenarios
 * - View missing scenarios
 * - Both missing scenarios (success and failure cases)
 * - Repair failure handling
 * - Event appending
 * - Re-fetch after repair
 */

import { withS3SelfRepair, FetchFunction, ActionFunction } from './wrapper'
import { RepairOperation, RepairState, immediateSelfRepair } from './index'
import { appendManifestEvents } from '../operations'

// Mock dependencies
jest.mock('./index', () => ({
    ...jest.requireActual('./index'),
    immediateSelfRepair: jest.fn()
}))
jest.mock('../operations')

const mockImmediateSelfRepair = immediateSelfRepair as jest.MockedFunction<typeof immediateSelfRepair>
const mockAppendManifestEvents = appendManifestEvents as jest.MockedFunction<typeof appendManifestEvents>

// Test constants
const TEST_ASSET_ID = 'ASSET#test'
const TEST_TIMESTAMP = 1234567890000

describe('withS3SelfRepair', () => {
    // Mock fetch and action functions
    let mockFetch: jest.MockedFunction<FetchFunction<any>>
    let mockAction: jest.MockedFunction<ActionFunction<any, any>>
    
    beforeEach(() => {
        jest.clearAllMocks()
        
        // Create fresh mock functions for each test
        mockFetch = jest.fn()
        mockAction = jest.fn()
        
        // Default mock implementations
        mockAppendManifestEvents.mockResolvedValue(undefined)
    })
    
    describe('normal operation (no repair needed)', () => {
        it('should call action directly when both files exist', async () => {
            const testData = { workspace: { assetId: TEST_ASSET_ID } }
            const expectedResult = { success: true, message: 'Action completed' }
            
            mockFetch.mockResolvedValue({
                data: testData,
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            mockAction.mockResolvedValue(expectedResult)
            
            const result = await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'applyEdit',
                    data: { editWML: '', zone: 'Library', createIfNeeded: false }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should call fetch once
            expect(mockFetch).toHaveBeenCalledTimes(1)
            
            // Should call action with fetched data
            expect(mockAction).toHaveBeenCalledTimes(1)
            expect(mockAction).toHaveBeenCalledWith(testData)
            
            // Should NOT call repair
            expect(mockImmediateSelfRepair).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
            
            // Should return action result
            expect(result).toEqual(expectedResult)
        })
        
        it('should skip repair when state shows no missing files', async () => {
            mockFetch.mockResolvedValue({
                data: { test: 'data' },
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'auth.wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            expect(mockImmediateSelfRepair).not.toHaveBeenCalled()
        })
    })
    
    describe('manifest missing scenarios', () => {
        it('should repair when manifest is missing', async () => {
            const testData = { workspace: { assetId: TEST_ASSET_ID } }
            const repairedData = { workspace: { assetId: TEST_ASSET_ID, repaired: true } }
            
            // First fetch shows manifest missing
            mockFetch.mockResolvedValueOnce({
                data: testData,
                state: {
                    manifestMissing: true,
                    materializedViewMissing: false
                }
            })
            
            // Second fetch after repair shows complete state
            mockFetch.mockResolvedValueOnce({
                data: repairedData,
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: [
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e1', fromZone: null, toZone: 'Library' },
                    { type: 'snapshot', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e2', s3Key: 'test.wml/snapshots/1234567890000.wml', snapshotType: 'initializeManifest', chunksBeforeSnapshot: 0 }
                ]
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            const result = await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'applyEdit',
                    data: { editWML: '<Asset uuid=(test)></Asset>', zone: 'Library', createIfNeeded: true }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should call fetch twice (before and after repair)
            expect(mockFetch).toHaveBeenCalledTimes(2)
            
            // Should call repair with correct state
            expect(mockImmediateSelfRepair).toHaveBeenCalledWith({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                state: {
                    manifestMissing: true,
                    materializedViewMissing: false
                },
                operation: {
                    type: 'applyEdit',
                    data: { editWML: '<Asset uuid=(test)></Asset>', zone: 'Library', createIfNeeded: true }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should append events
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(
                'test.wml/',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'zoneChange' }),
                    expect.objectContaining({ type: 'snapshot' })
                ])
            )
            
            // Should call action with repaired data
            expect(mockAction).toHaveBeenCalledWith(repairedData)
            expect(result).toEqual({ success: true })
        })
        
        it('should handle empty events array from repair', async () => {
            mockFetch.mockResolvedValue({
                data: { test: 'data' },
                state: {
                    manifestMissing: true,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: []  // No events to append
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should not call appendManifestEvents when no events
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
        })
    })
    
    describe('view missing scenarios', () => {
        it('should repair when materialized view is missing', async () => {
            mockFetch.mockResolvedValueOnce({
                data: { test: 'data' },
                state: {
                    manifestMissing: false,
                    materializedViewMissing: true
                }
            })
            
            mockFetch.mockResolvedValueOnce({
                data: { test: 'repaired-data' },
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: []  // View reconstruction doesn't add events
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'writeSnapshot',
                    data: { zone: 'Library', timestamp: TEST_TIMESTAMP }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should call repair
            expect(mockImmediateSelfRepair).toHaveBeenCalledWith({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                state: {
                    manifestMissing: false,
                    materializedViewMissing: true
                },
                operation: {
                    type: 'writeSnapshot',
                    data: { zone: 'Library', timestamp: TEST_TIMESTAMP }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should fetch twice and action once
            expect(mockFetch).toHaveBeenCalledTimes(2)
            expect(mockAction).toHaveBeenCalledTimes(1)
        })
    })
    
    describe('both missing scenarios', () => {
        it('should repair when both are missing (applyEdit with createIfNeeded)', async () => {
            mockFetch.mockResolvedValueOnce({
                data: { workspace: null },
                state: {
                    manifestMissing: true,
                    materializedViewMissing: true
                }
            })
            
            mockFetch.mockResolvedValueOnce({
                data: { workspace: { created: true } },
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: [
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e1', fromZone: null, toZone: 'Library' },
                    { type: 'snapshot', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e2', s3Key: 'test.wml/snapshots/1234567890000.wml', snapshotType: 'initializeManifest', chunksBeforeSnapshot: 0 }
                ]
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'applyEdit',
                    data: { editWML: '<Asset uuid=(test)></Asset>', zone: 'Library', createIfNeeded: true }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            expect(mockImmediateSelfRepair).toHaveBeenCalled()
            expect(mockAppendManifestEvents).toHaveBeenCalled()
            expect(mockAction).toHaveBeenCalled()
        })
        
        it('should repair when both are missing (moveZone creates empty placeholder)', async () => {
            mockFetch.mockResolvedValue({
                data: { workspace: null },
                state: {
                    manifestMissing: true,
                    materializedViewMissing: true
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: [
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e1', fromZone: null, toZone: 'Library' },
                    { type: 'snapshot', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e2', s3Key: 'test.wml/snapshots/1234567890000.wml', snapshotType: 'initializeManifest', chunksBeforeSnapshot: 0 },
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e3', fromZone: 'Library', toZone: 'Canon' }
                ]
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'wml',
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            expect(mockImmediateSelfRepair).toHaveBeenCalled()
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(
                'test.wml/',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'zoneChange', fromZone: null }),
                    expect.objectContaining({ type: 'snapshot' }),
                    expect.objectContaining({ type: 'zoneChange', fromZone: 'Library' })
                ])
            )
        })
    })
    
    describe('repair failure handling', () => {
        it('should throw error when repair fails', async () => {
            mockFetch.mockResolvedValue({
                data: {},
                state: {
                    manifestMissing: true,
                    materializedViewMissing: true
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: false,
                error: 'Cannot snapshot empty content (both manifest and view missing)'
            })
            
            await expect(
                withS3SelfRepair({
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    fetch: mockFetch,
                    action: mockAction,
                    repairOperation: {
                        type: 'writeSnapshot',
                        data: { zone: 'Library', timestamp: TEST_TIMESTAMP }
                    },
                    timestamp: TEST_TIMESTAMP
                })
            ).rejects.toThrow('Self-repair failed: Cannot snapshot empty content (both manifest and view missing)')
            
            // Should not call action if repair fails
            expect(mockAction).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
        })
        
        it('should throw error when applyEdit without createIfNeeded encounters both missing', async () => {
            mockFetch.mockResolvedValue({
                data: {},
                state: {
                    manifestMissing: true,
                    materializedViewMissing: true
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: false,
                error: 'Cannot edit non-existent asset (createIfNeeded not set)'
            })
            
            await expect(
                withS3SelfRepair({
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    fetch: mockFetch,
                    action: mockAction,
                    repairOperation: {
                        type: 'applyEdit',
                        data: { editWML: '<Asset uuid=(test)></Asset>', zone: 'Library', createIfNeeded: false }
                    },
                    timestamp: TEST_TIMESTAMP
                })
            ).rejects.toThrow('Self-repair failed: Cannot edit non-existent asset (createIfNeeded not set)')
        })
    })
    
    describe('authorization prefix handling', () => {
        it('should work with auth.wml suffix', async () => {
            mockFetch.mockResolvedValueOnce({
                data: { authWorkspace: {} },
                state: {
                    manifestMissing: true,
                    materializedViewMissing: false
                }
            })
            
            mockFetch.mockResolvedValueOnce({
                data: { authWorkspace: { repaired: true } },
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: [
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e1', fromZone: null, toZone: 'Library' }
                ]
            })
            
            mockAction.mockResolvedValue({ success: true })
            
            await withS3SelfRepair({
                assetId: TEST_ASSET_ID,
                suffix: 'auth.wml',  // Authorization prefix
                fetch: mockFetch,
                action: mockAction,
                repairOperation: {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                },
                timestamp: TEST_TIMESTAMP
            })
            
            // Should use correct prefix for auth files
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(
                'test.auth.wml/',
                expect.any(Array)
            )
        })
    })
    
    describe('error propagation', () => {
        it('should propagate errors from fetch function', async () => {
            mockFetch.mockRejectedValue(new Error('S3 access denied'))
            
            await expect(
                withS3SelfRepair({
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    fetch: mockFetch,
                    action: mockAction,
                    repairOperation: {
                        type: 'applyEdit',
                        data: { editWML: '', zone: 'Library', createIfNeeded: false }
                    },
                    timestamp: TEST_TIMESTAMP
                })
            ).rejects.toThrow('S3 access denied')
        })
        
        it('should propagate errors from action function', async () => {
            mockFetch.mockResolvedValue({
                data: {},
                state: {
                    manifestMissing: false,
                    materializedViewMissing: false
                }
            })
            
            mockAction.mockRejectedValue(new Error('Merge conflict'))
            
            await expect(
                withS3SelfRepair({
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    fetch: mockFetch,
                    action: mockAction,
                    repairOperation: {
                        type: 'applyEdit',
                        data: { editWML: '', zone: 'Library', createIfNeeded: false }
                    },
                    timestamp: TEST_TIMESTAMP
                })
            ).rejects.toThrow('Merge conflict')
        })
        
        it('should propagate errors from appendManifestEvents', async () => {
            mockFetch.mockResolvedValue({
                data: {},
                state: {
                    manifestMissing: true,
                    materializedViewMissing: false
                }
            })
            
            mockImmediateSelfRepair.mockResolvedValue({
                success: true,
                eventsToAppend: [
                    { type: 'zoneChange', timestamp: new Date(TEST_TIMESTAMP).toISOString(), eventId: 'e1', fromZone: null, toZone: 'Library' }
                ]
            })
            
            mockAppendManifestEvents.mockRejectedValue(new Error('S3 write failed'))
            
            await expect(
                withS3SelfRepair({
                    assetId: TEST_ASSET_ID,
                    suffix: 'wml',
                    fetch: mockFetch,
                    action: mockAction,
                    repairOperation: {
                        type: 'moveZone',
                        data: { fromZone: 'Library', toZone: 'Canon' }
                    },
                    timestamp: TEST_TIMESTAMP
                })
            ).rejects.toThrow('S3 write failed')
        })
    })
})

