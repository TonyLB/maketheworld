/**
 * Self-Repair Infrastructure
 * 
 * Centralized logic for handling missing manifest and materialized view files.
 * Provides on-the-spot repair strategies for write operations that encounter
 * incomplete S3 state.
 * 
 * See: s3Storage/manifest/AGENT.selfRepair.md for design rationale
 */

import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { ManifestEvent } from '../baseClasses'

/**
 * Assessment of which S3 files are present vs. missing
 */
export interface RepairState {
    manifestMissing: boolean
    materializedViewMissing: boolean
}

/**
 * Metadata about the operation being performed when repair is needed.
 * Different operations have different capabilities for what they can repair.
 */
export type RepairOperation = 
    | { 
        type: 'applyEdit'
        data: { 
            editWML: string  // WML text with Replace/Remove operations
            zone: Zone
            createIfNeeded: boolean
        }
    }
    | { 
        type: 'moveZone'
        data: { 
            fromZone: Zone
            toZone: Zone
        }
    }
    | { 
        type: 'writeSnapshot'
        data: { 
            zone: Zone
            timestamp: number
        }
    }

/**
 * Result of a repair operation
 */
export interface RepairResult {
    /**
     * Whether repair succeeded
     */
    success: boolean
    
    /**
     * Human-readable list of actions taken during repair
     * (for logging and observability)
     */
    repairActions: string[]
    
    /**
     * Manifest events that should be appended by the caller
     * (repair creates these but doesn't append them - caller holds atomicLock)
     */
    eventsToAppend?: ManifestEvent[]
    
    /**
     * Error message if repair failed
     */
    error?: string
}

/**
 * Type guards for RepairOperation union
 */
export const isApplyEditOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'applyEdit' }> => {
    return op.type === 'applyEdit'
}

export const isMoveZoneOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'moveZone' }> => {
    return op.type === 'moveZone'
}

export const isWriteSnapshotOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'writeSnapshot' }> => {
    return op.type === 'writeSnapshot'
}

