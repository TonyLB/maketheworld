/**
 * Materialized View Operations
 * 
 * Content management functions for materialized views (the always-current
 * {uuid}.wml and {uuid}.auth.wml files that clients access directly).
 * 
 * Core responsibility: Apply chunks to baseline content to produce updated state.
 * 
 * Design principles:
 * - Pure functions: No side effects, just content transformation
 * - Type-safe: Leverages StandardForm.merge() for conflict detection
 * - Reusable: Used by repair, reconstruction, and normal edit operations
 * - Clear errors: Explicit handling of merge conflicts
 */

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

/**
 * Apply a WML chunk to a baseline StandardForm, producing an updated StandardForm.
 * 
 * This is a pure content reducer - it takes existing content and a delta (chunk),
 * and returns the merged result. No I/O, no side effects.
 * 
 * @param baseline - The current content state (may be empty StandardForm for new assets)
 * @param chunkWML - WML string representing a delta (Replace/Remove operations)
 * @returns Updated StandardForm with chunk applied
 * @throws MergeConflictError if incompatible changes are detected during merge
 * 
 */
export function updateContentByChunk(
    baseline: StandardForm,
    chunkWML: string
): StandardForm {
    // Parse chunk WML into StandardForm
    const chunkStandard = new StandardForm(chunkWML)
    
    // Merge chunk into baseline
    // Note: StandardForm.merge() returns a new StandardForm with the merged content
    // It will throw MergeConflictError if there are incompatible changes
    const merged = baseline.merge(chunkStandard)
    
    // Return merged content
    return merged
}

