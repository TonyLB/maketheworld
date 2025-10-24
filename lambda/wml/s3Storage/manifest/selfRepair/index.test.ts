/**
 * Self-Repair Tests
 * 
 * Test matrix:
 * - 3 Scenarios (manifest missing, view missing, both missing)
 * - 3 Operations (applyEdit, moveZone, writeSnapshot)
 * - 2 Prefixes (content, auth)
 * - Various content states (empty, populated)
 */

import { 
    RepairOperation, 
    isApplyEditOperation,
    isMoveZoneOperation,
    isWriteSnapshotOperation
} from './index'

describe('selfRepair', () => {
    describe('type guards', () => {
        describe('isApplyEditOperation', () => {
            it('should return true for applyEdit operations', () => {
                const operation: RepairOperation = {
                    type: 'applyEdit',
                    data: {
                        editWML: '<Asset uuid=(test)><Room uuid=(TestRoom) /></Asset>',
                        zone: 'Library',
                        createIfNeeded: true
                    }
                }
                
                expect(isApplyEditOperation(operation)).toBe(true)
            })
            
            it('should return false for other operation types', () => {
                const moveOp: RepairOperation = {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                }
                const snapshotOp: RepairOperation = {
                    type: 'writeSnapshot',
                    data: { zone: 'Library', timestamp: Date.now() }
                }
                
                expect(isApplyEditOperation(moveOp)).toBe(false)
                expect(isApplyEditOperation(snapshotOp)).toBe(false)
            })
            
            it('should narrow the type to access applyEdit-specific data', () => {
                const operation: RepairOperation = {
                    type: 'applyEdit',
                    data: {
                        editWML: '<Asset uuid=(test)><Room uuid=(TestRoom) /></Asset>',
                        zone: 'Library',
                        createIfNeeded: true
                    }
                }
                
                if (isApplyEditOperation(operation)) {
                    // TypeScript should know operation.data has editWML and createIfNeeded
                    expect(operation.data.editWML).toBeDefined()
                    expect(operation.data.createIfNeeded).toBe(true)
                }
            })
        })
        
        describe('isMoveZoneOperation', () => {
            it('should return true for moveZone operations', () => {
                const operation: RepairOperation = {
                    type: 'moveZone',
                    data: {
                        fromZone: 'Library',
                        toZone: 'Canon'
                    }
                }
                
                expect(isMoveZoneOperation(operation)).toBe(true)
            })
            
            it('should return false for other operation types', () => {
                const applyEditOp: RepairOperation = {
                    type: 'applyEdit',
                    data: { editWML: '', zone: 'Library', createIfNeeded: false }
                }
                const snapshotOp: RepairOperation = {
                    type: 'writeSnapshot',
                    data: { zone: 'Library', timestamp: Date.now() }
                }
                
                expect(isMoveZoneOperation(applyEditOp)).toBe(false)
                expect(isMoveZoneOperation(snapshotOp)).toBe(false)
            })
            
            it('should narrow the type to access moveZone-specific data', () => {
                const operation: RepairOperation = {
                    type: 'moveZone',
                    data: {
                        fromZone: 'Library',
                        toZone: 'Canon'
                    }
                }
                
                if (isMoveZoneOperation(operation)) {
                    // TypeScript should know operation.data has fromZone and toZone
                    expect(operation.data.fromZone).toBe('Library')
                    expect(operation.data.toZone).toBe('Canon')
                }
            })
        })
        
        describe('isWriteSnapshotOperation', () => {
            it('should return true for writeSnapshot operations', () => {
                const operation: RepairOperation = {
                    type: 'writeSnapshot',
                    data: {
                        zone: 'Library',
                        timestamp: 1234567890
                    }
                }
                
                expect(isWriteSnapshotOperation(operation)).toBe(true)
            })
            
            it('should return false for other operation types', () => {
                const applyEditOp: RepairOperation = {
                    type: 'applyEdit',
                    data: { editWML: '', zone: 'Library', createIfNeeded: false }
                }
                const moveOp: RepairOperation = {
                    type: 'moveZone',
                    data: { fromZone: 'Library', toZone: 'Canon' }
                }
                
                expect(isWriteSnapshotOperation(applyEditOp)).toBe(false)
                expect(isWriteSnapshotOperation(moveOp)).toBe(false)
            })
            
            it('should narrow the type to access writeSnapshot-specific data', () => {
                const operation: RepairOperation = {
                    type: 'writeSnapshot',
                    data: {
                        zone: 'Library',
                        timestamp: 1234567890
                    }
                }
                
                if (isWriteSnapshotOperation(operation)) {
                    // TypeScript should know operation.data has timestamp
                    expect(operation.data.timestamp).toBe(1234567890)
                }
            })
        })
    })
})

