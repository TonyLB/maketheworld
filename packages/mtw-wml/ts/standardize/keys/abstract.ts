import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "../components/dataTypes/abstract";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { StandardReference, LookupMappings } from "./reference";
import { StandardKey } from "./key";
import { ReferenceFormat } from "../components/utils/references";
import { StandardFacetData, StandardFacetEnvelopeWithOptionalPayload } from "./facets/dataTypes/facet";

/**
 * FacetListData: Serialization format for FacetList collections
 * Array of StandardEditableData wrapping StandardFacetData
 * 
 * IMPORTANT: FacetLists are homogeneous (single-type) collections. Each list contains only one facet type.
 * The TPayload type parameter enforces this at compile time. All facets in a list share the same payload
 * structure (e.g., all PositionFacet instances have {x,y}).
 * 
 * @template TPayload - The specific payload type for all facets in the list (string for MarkFacet, {x,y} for PositionFacet, string|undefined for ExitFacet)
 */
export type FacetListData<TPayload> = 
    StandardEditableData<StandardFacetData<TPayload>>[]

/**
 * FacetListInputData: Input format for FacetList collections during ingestion.
 * Accepts legacy facet envelopes that may omit payload so constructors can inject defaults.
 * This should be used only at parse/validation boundaries.
 */
export type FacetListInputData<TPayload> =
    StandardEditableData<StandardFacetData<TPayload> | StandardFacetEnvelopeWithOptionalPayload<TPayload>>[]

/**
 * StandardFacet: Interface for Facet relational objects
 * Composes a StandardReference for target component reference
 * Carries typed payload data that varies by Facet type
 * 
 * IMPORTANT: Facets are designed exclusively for homogeneous lists. The facet type is determined by
 * the list class (e.g., PositionFacetList → PositionFacet), not by a discriminator field in the payload.
 * Payloads use a simple format without `type` fields, allowing for compact JSON representation.
 * 
 * @template TPayload - The payload data type for serialization (string for MarkFacet, {x,y} for PositionFacet, string|undefined for ExitFacet)
 * Note: The `payload` property returns the payload class instance (MarkFacetPayload, PositionPayload, ExitPayload) for runtime access
 */
export interface StandardFacet<TPayload> {
    // Composed reference access (following StandardReference.standardKey pattern)
    readonly reference: StandardReference;
    readonly standardKey: StandardKey;
    readonly ref: number;
    readonly tag: ComponentTag;
    readonly key?: string;
    readonly universalKey?: ComponentUUID;
    
    // Payload access - returns payload class instance (not data type) for runtime access
    readonly payload: any;  // Payload class instance (MarkFacetPayload, PositionPayload, or ExitPayload)
    readonly isReplace: boolean;
    readonly matchPayload?: any;  // Payload class instance
    
    // Core operations
    clone(): StandardFacet<TPayload>;
    toJSON(): StandardFacetData<TPayload>;
    equals(other: StandardFacet<TPayload>): boolean;
    sameKey(other: StandardFacet<TPayload>): boolean;
    
    // Merge/diff operations (combines ref arithmetic with payload Replace logic)
    merge(incoming: StandardFacet<TPayload>): StandardFacet<TPayload> | undefined;
    diff(incoming: StandardFacet<TPayload> | undefined): StandardFacet<TPayload> | undefined;
    invert(): StandardFacet<TPayload>;
    
    // Facet rendering for parent component orchestration
    renderFacet(referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> };
    
    // Format conversion
    toFormat(format: ReferenceFormat, mappings?: LookupMappings): StandardFacet<TPayload>;
    lookup(mappings: LookupMappings): StandardFacet<TPayload>;
}

/**
 * FacetList: Interface for collections of Facets
 * Similar structure to ReferenceList but parameterized by payload type
 * 
 * IMPORTANT: FacetLists are homogeneous (single-type) collections. Unlike References which can mix
 * types, each FacetList contains only one facet type. The TPayload type parameter enforces this
 * restriction at compile time. This design allows for:
 * - Simple serialization without discriminator fields (type is inferred from list context)
 * - Compact JSON representation optimized for single-type collections
 * - Type safety enforced by the list class (e.g., PositionFacetList only accepts PositionFacet instances)
 * 
 * Examples:
 * - PositionFacetList<{x,y}> contains only StandardPositionFacet instances
 * - MarkFacetList<string> contains only StandardMarkFacet instances
 * - ExitFacetList<string|undefined> contains only StandardExitFacet instances
 * 
 * @template TPayload - The specific payload type for all facets in the list (string for MarkFacet, {x,y} for PositionFacet, string|undefined for ExitFacet)
 */
export interface FacetList<TPayload> {
    // Core operations
    clone(): FacetList<TPayload>;
    toJSON(): FacetListData<TPayload>;
    equals(other: FacetList<TPayload>): boolean;
    
    // Merge/diff operations (combines ref arithmetic with payload Replace logic)
    merge(incoming: FacetList<TPayload>): FacetList<TPayload>;
    diff(incoming: FacetList<TPayload>): FacetList<TPayload>;
    invert(): FacetList<TPayload>;
    
    // Transform operations
    mapContents(callback: (facet: StandardFacet<TPayload>) => StandardFacet<TPayload>): FacetList<TPayload>;
    toFormat(format: ReferenceFormat): FacetList<TPayload>;
    lookup(mappings: LookupMappings): FacetList<TPayload>;
    
    // Access operations
    readonly items: StandardFacet<TPayload>[];
    readonly length: number;
}
