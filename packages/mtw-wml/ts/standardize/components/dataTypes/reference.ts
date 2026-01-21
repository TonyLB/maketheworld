/**
 * Re-exports for backward compatibility.
 * Data types have been moved to keys/dataTypes/reference.ts
 * 
 * @deprecated Import from keys/dataTypes/reference.ts instead
 */
export type {
    StandardKeyData,
    StandardReferenceData,
    ReferenceListData,
} from '../../keys/dataTypes/reference'

export {
    isStandardKeyData,
    isStandardReferenceData
} from '../../keys/dataTypes/reference'
