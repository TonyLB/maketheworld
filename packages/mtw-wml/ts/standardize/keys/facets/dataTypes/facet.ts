import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { StandardReferenceData, isStandardReferenceData } from "../../dataTypes/reference";

/**
 * PositionPayload: Payload for Position Facets
 * Contains x, y coordinates for positioning a Room on a Map
 */
export type PositionPayload = {
    type: 'PositionFacet';
    x: number;
    y: number;
}

/**
 * MarkFacetPayload: Payload for Mark Facets
 * Contains narrative description for referencing a Mark with state information
 * Note: Embeddings are handled in the lambda/assets data domain, not at WML parsing level
 */
export type MarkFacetPayload = {
    type: 'MarkFacet';
    narrative: string;
}

/**
 * ExitPayload: Payload for Exit Facets
 * Contains optional description for Room exits
 */
export type ExitPayload = {
    type: 'ExitFacet';
    description?: string;
}

/**
 * StandardFacetPayload: Base union type for all Facet payload types
 * Payloads are self-describing via the `type` discriminator field
 */
export type StandardFacetPayload = PositionPayload | MarkFacetPayload | ExitPayload

/**
 * StandardFacetData: Serialization format for Facets
 * Combines a StandardReferenceData (target component reference) with typed payload data
 * 
 * @template TPayload - The specific payload type (defaults to StandardFacetPayload union)
 */
export type StandardFacetData<TPayload extends StandardFacetPayload = StandardFacetPayload> = {
    reference: StandardReferenceData;
    payload: TPayload;
}

/**
 * Type guard for PositionPayload
 */
export const isPositionPayload = (arg: any): arg is PositionPayload => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return checkTypes({
        required: { type: CheckTypes.STRING, x: CheckTypes.NUMBER, y: CheckTypes.NUMBER },
        optional: {}
    })(arg) && arg.type === 'PositionFacet'
}

/**
 * Type guard for MarkFacetPayload
 */
export const isMarkFacetPayload = (arg: any): arg is MarkFacetPayload => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return checkTypes({
        required: { type: CheckTypes.STRING, narrative: CheckTypes.STRING },
        optional: {}
    })(arg) && arg.type === 'MarkFacet'
}

/**
 * Type guard for ExitPayload
 */
export const isExitPayload = (arg: any): arg is ExitPayload => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return checkTypes({
        required: { type: CheckTypes.STRING },
        optional: { description: CheckTypes.STRING }
    })(arg) && arg.type === 'ExitFacet'
}

/**
 * Type guard for StandardFacetPayload (union type)
 * Checks if the argument is any of the recognized payload types
 */
export const isStandardFacetPayload = (arg: any): arg is StandardFacetPayload => {
    return isPositionPayload(arg) || isMarkFacetPayload(arg) || isExitPayload(arg)
}

/**
 * Type guard for StandardFacetData
 * Reuses isStandardReferenceData to validate the composed reference
 */
export const isStandardFacetData = (arg: any): arg is StandardFacetData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }
    
    return (
        'reference' in arg &&
        'payload' in arg &&
        isStandardReferenceData(arg.reference) &&
        isStandardFacetPayload(arg.payload)
    )
}
