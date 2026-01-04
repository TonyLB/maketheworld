import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import { StandardFacetPayload } from "./facet";

/**
 * FacetPayloadBase: Interface for facet payload classes that handle WML schema parsing and generation.
 * 
 * Different facet payload types require fundamentally different WML rendering patterns:
 * - **Exit facets**: `<Exit to=(target)>Name</Exit>` - reference embedded in tag properties, payload as content
 * - **Position facets**: `<Room to=(target)><Position x={0} y={100} /></Room>` - reference as parent tag, payload as child tag
 * - **Mark facets**: `<Mark uuid=(target)><Match>Condition</Match></Mark>` - reference as parent tag, payload as child tag
 * 
 * Following the precedent established by `StandardExitBase` and `StandardPositionSimpleBase`, each payload type
 * needs its own class with schema generation/parsing logic. This interface defines the contract these classes must implement.
 * 
 * @template TPayload - The specific payload type (extends StandardFacetPayload)
 */
export interface FacetPayloadBase<TPayload extends StandardFacetPayload> {
    /**
     * Parse payload data from WML schema tree.
     * 
     * Extracts payload data from the WML schema tree, given the already-parsed reference.
     * The reference is provided separately because it may be parsed from different locations
     * in the schema depending on the facet type (embedded in tag properties vs. as parent tag).
     * 
     * @param node - The WML schema tree node containing the facet structure
     * @param reference - The already-parsed StandardReference for the target component
     * @returns The parsed payload data
     */
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): TPayload;

    /**
     * Generate complete WML schema from reference and payload (standalone, without component content).
     * 
     * Generates the complete WML schema including both reference rendering and payload rendering.
     * This method is used when the facet is rendered standalone, without any component content
     * (e.g., a Position facet on a Map where the Room has no other content to render).
     * 
     * The schema generation handles both reference rendering and payload rendering based on the
     * payload type. Reference may be embedded in tag properties (Exit) or as parent tag (Position/Mark),
     * and payload may be tag content or child tag.
     * 
     * @param reference - The StandardReference for the target component
     * @param payload - The payload data to render
     * @returns The complete WML schema tree
     */
    schema(reference: StandardReference, payload: TPayload): GenericTree<SchemaTag>;

    /**
     * Merge facet structure into existing component schema (used when component has content to render).
     * 
     * Merges the facet structure into an existing component schema. This method is used when
     * a component has content to render in addition to the facet (e.g., a Map containing a Room
     * with a Position facet where the Room also renders its component content like features/examples).
     * 
     * The implementation should merge the facet payload structure (e.g., Position child tag) into
     * the existing component schema's children, preserving all existing component content.
     * 
     * **Use case example**: A Map has a Room with a Position facet, and the Room is also the implicit
     * or explicit parent of other components (features, examples, etc.). The Room should render both
     * the Position facet AND its component content at that point in the schema.
     * 
     * @param reference - The StandardReference for the target component
     * @param payload - The payload data to merge
     * @param componentSchema - The existing component schema with content to preserve
     * @returns The merged component schema with facet structure integrated
     */
    nestedSchema(reference: StandardReference, payload: TPayload, componentSchema: GenericTreeNode<SchemaTag>): GenericTreeNode<SchemaTag>;
}
