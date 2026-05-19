// Export key types
export { StandardKey, keySortOrder } from "./key";

// Export reference types
export {
    StandardReference,
    standardReferenceDeserialize,
    standardReferenceSerialize,
    referenceSortOrder,
    MapByKey,
} from "./reference";
export type { LookupMappings } from "./reference";

// Export reference list types
export { ReferenceList, default as ReferenceListDefault } from "./referenceList";
export { SingleReference } from "./singleReference";

// Export facet types
export { facetClassFactory } from "./facets/facetFactory";

// Export facet list types
export { facetListClassFactory } from "./facets/facetListFactory";

// Export data types
export * from "./dataTypes/reference";
export * from "./facets/dataTypes/facet";
export * from "./facets/dataTypes/facetPayloadBase";
export { PositionFacetPayload, createPositionFacetPayload, isStandardPositionPayloadData } from "./facets/position";
export { MarkFacetPayload, createMarkFacetPayload } from "./facets/mark";
export { ExitFacetPayload, createExitFacetPayload } from "./facets/exit";
// Export type aliases for backward compatibility
export type { PositionPayload } from "./facets/dataTypes/facet";
export type { ExitPayload } from "./facets/dataTypes/facet";

// Export concrete facet classes
export { StandardPositionFacet, PositionFacetList } from "./facets/position";
export { StandardMarkFacet, MarkFacetList } from "./facets/mark";
export { StandardExitFacet, ExitFacetList } from "./facets/exit";
export {
    StandardSituationProseFacet,
    SituationProseFacetList,
    SituationProseFacetPayload,
    isSituationProseFacetPayload,
    StandardSituationRoomFacet,
    SituationRoomFacetList,
    SituationRoomFacetPayload,
    isSituationRoomFacetPayload,
} from "./facets/situationRoom";
export type { SituationProseFacetPayloadType, SituationRoomFacetPayloadType } from "./facets/situationRoom";
export { StandardLensMarkFacet, LensMarkFacetList, LensMarkFacetPayload } from "./facets/lensMark";

// Export abstract interfaces
export type { StandardFacet as StandardFacetInterface, FacetList as FacetListInterface, FacetListData } from "./abstract";
