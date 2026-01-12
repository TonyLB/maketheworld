/**
 * Facet Payload Types
 * 
 * IMPORTANT DESIGN DECISION: Facets are designed EXCLUSIVELY for homogeneous (single-type) lists.
 * Each FacetList contains only one facet type (e.g., PositionFacetList only contains PositionFacet instances).
 * 
 * This design choice allows for:
 * - Simple serialization format without `type` discriminator fields
 * - Type inference from list context (no need for runtime type discrimination)
 * - Compact JSON representation optimized for single-type collections
 * 
 * Payload types use simple formats:
 * - PositionPayload: { x: number, y: number }
 * - MarkFacetPayload: string
 * - ExitPayload: string | undefined
 * 
 * The facet type is determined by the list class, not by a discriminator field in the payload.
 */

import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { StandardReferenceData, isStandardReferenceData } from "../../dataTypes/reference";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

/**
 * PositionPayload: Payload for Position Facets
 * Contains x, y coordinates for positioning a Room on a Map
 * 
 * Note: Type is inferred from list context (PositionFacetList), not from a discriminator field.
 * Payload uses simple format: { x: number, y: number } with no `type` field.
 */
export type PositionPayload = {
    x: number;
    y: number;
}

/**
 * MarkFacetPayload: Payload for Mark Facets
 * Contains narrative description for referencing a Mark with state information
 * 
 * Note: Embeddings are handled in the lambda/assets data domain, not at WML parsing level.
 * Type is inferred from list context (MarkFacetList), not from a discriminator field.
 * Payload uses simple format: plain string (Remove/Replace operations are handled via StandardFacetData).
 */
export type MarkFacetPayload = string

/**
 * ExitPayload: Payload for Exit Facets
 * Contains optional description for Room exits
 * 
 * Note: Type is inferred from list context (ExitFacetList), not from a discriminator field.
 * Payload uses simple format: string | undefined with no `type` field.
 */
export type ExitPayload = string | undefined

/**
 * StandardFacetData: Serialization format for Facets
 * Combines a StandardReferenceData (target component reference) with typed payload data
 * 
 * IMPORTANT: This format is used only within homogeneous lists. The payload type is
 * determined by the list context, not by a discriminator field in the payload.
 * 
 * The payload can be a plain value or StandardEditableData<TPayload> to support Remove/Replace
 * operations at the payload level (e.g., { tag: 'Replace', match: oldValue, payload: newValue }).
 * 
 * @template TPayload - The specific payload type (string for MarkFacet, {x,y} for PositionFacet, string|undefined for ExitFacet)
 */
export type StandardFacetData<TPayload> = {
    reference: StandardReferenceData;
    payload: StandardEditableData<TPayload>;
}

/**
 * Type guard for PositionPayload
 * Checks for object with x and y number properties (no type field needed - type inferred from context)
 */
export const isPositionPayload = (arg: any): arg is PositionPayload => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return checkTypes({
        required: { x: CheckTypes.NUMBER, y: CheckTypes.NUMBER },
        optional: {}
    })(arg)
}

/**
 * Type guard for MarkFacetPayload
 * Checks for string type (no type field needed - type inferred from context)
 */
export const isMarkFacetPayload = (arg: any): arg is MarkFacetPayload => {
    return typeof arg === 'string'
}

/**
 * Type guard for ExitPayload
 * Checks for string or undefined (no type field needed - type inferred from context)
 */
export const isExitPayload = (arg: any): arg is ExitPayload => {
    return typeof arg === 'string' || arg === undefined
}

/**
 * Type guard for StandardFacetData
 * Validates structure only (has reference and payload properties with valid reference)
 * Payload type validation is done by specific payload constructors based on context
 */
export const isStandardFacetData = (arg: any): arg is StandardFacetData<any> => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return (
        'reference' in arg &&
        'payload' in arg &&
        isStandardReferenceData(arg.reference)
    )
}
