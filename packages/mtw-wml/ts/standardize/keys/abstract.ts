import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "../components/dataTypes/abstract";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { StandardReference, LookupMappings } from "./reference";
import { StandardKey } from "./key";
import { ReferenceFormat } from "../components/utils/references";
import { StandardFacetPayload, StandardFacetData } from "./dataTypes/facet";

/**
 * FacetListData: Serialization format for FacetList collections
 * Array of StandardEditableData wrapping StandardFacetData
 * 
 * @template TPayload - The specific payload type for all facets in the list
 */
export type FacetListData<TPayload extends StandardFacetPayload = StandardFacetPayload> = 
    StandardEditableData<StandardFacetData<TPayload>>[]

/**
 * StandardFacet: Interface for Facet relational objects
 * Composes a StandardReference for target component reference
 * Carries typed payload data that varies by Facet type
 * 
 * @template TPayload - The specific payload type (extends StandardFacetPayload)
 */
export interface StandardFacet<TPayload extends StandardFacetPayload = StandardFacetPayload> {
    // Composed reference access (following StandardReference.standardKey pattern)
    readonly reference: StandardReference;
    readonly standardKey: StandardKey;
    readonly ref: number;
    readonly tag: ComponentTag;
    readonly key?: string;
    readonly universalKey?: ComponentUUID;
    
    // Payload access
    readonly payload: TPayload;
    
    // Core operations
    clone(): StandardFacet<TPayload>;
    toJSON(): StandardFacetData<TPayload>;
    equals(other: StandardFacet<TPayload>): boolean;
    sameKey(other: StandardFacet<TPayload>): boolean;
    
    // Merge/diff operations (combines ref arithmetic with payload Replace logic)
    merge(incoming: StandardFacet<TPayload>): StandardFacet<TPayload> | undefined;
    diff(incoming: StandardFacet<TPayload>): StandardFacet<TPayload> | undefined;
    
    // Schema generation
    schema: GenericTree<SchemaTag>;
    nestedSchema(tag: SchemaTag): GenericTree<SchemaTag>;
    
    // Format conversion
    toFormat(format: ReferenceFormat): StandardFacet<TPayload>;
    lookup(mappings: LookupMappings): StandardFacet<TPayload>;
}

/**
 * FacetList: Interface for collections of Facets
 * Similar structure to ReferenceList but parameterized by payload type
 * 
 * @template TPayload - The specific payload type for all facets in the list
 */
export interface FacetList<TPayload extends StandardFacetPayload = StandardFacetPayload> {
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
