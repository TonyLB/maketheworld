import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../../reference";
import { StandardKey } from "../../key";
import { StandardComponent } from "../../../components/baseClasses";
import type { StandardizeFromSchemaContext } from "../../../wmlStandardizeMode";

/**
 * FacetPayloadBase: Interface for facet payload classes that handle WML schema parsing and generation.
 * 
 * Different facet payload types require fundamentally different WML rendering patterns:
 * - **Exit facets**: `<Exit to=(target)>Name</Exit>` - reference embedded in tag properties, payload as content. These create **new nodes** in the parent (Map) that don't enhance existing Room references.
 * - **Position facets**: `<Room to=(target)><Position {0, 100} /></Room>` - reference as parent tag, payload as child tag. These **enhance existing Room references** rendered by the parent Map (either pre-existing Room renders or Room references from a `rooms` reference list).
 * - **Mark facets**: `<Mark uuid=(target)><Match>Condition</Match></Mark>` - reference as parent tag, payload as child tag. These **enhance existing Mark references** rendered by the parent Example (from a `marks` reference list).
 * 
 * Each payload type needs its own class with schema generation/parsing logic (e.g., `ExitFacetPayload`, `PositionFacetPayload`, `MarkFacetPayload`). 
 * This interface defines the contract these classes must implement.
 * 
 * **Parent Component Orchestration Pattern**: Parent components are responsible for orchestrating facet rendering:
 * 1. Parent renders reference lists that may need facet enhancement (e.g., Map renders `rooms` reference list)
 * 2. Parent applies facet rendering to each facet, passing optional `referenceRender` (pre-existing render if reference already in tree, or plain reference render if not)
 * 3. Facet rendering returns either `newNode` (create new node like Exit) or `aggregatedNode` (enhanced reference render)
 * 4. Parent zippers enhanced references with new nodes to produce final schema
 * 
 * @template TPayload - The specific payload type (string for MarkFacet, {x,y} for PositionFacet, string|undefined for ExitFacet)
 */
export interface FacetPayloadBase<TPayload> {
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
    fromSchema(
        node: GenericTree<SchemaTag>,
        reference: StandardReference,
        context?: StandardizeFromSchemaContext
    ): TPayload;

    /**
     * Render facet for parent component orchestration.
     * 
     * Renders the facet structure for integration into a parent component's schema. Parent components
     * orchestrate facet rendering by calling this method for each facet, optionally providing a
     * pre-existing reference render if the reference is already present in the parent's schema tree.
     * 
     * The method returns either:
     * - `newNode`: For facets that create new nodes (e.g., Exit facets return `<Exit>` tag)
     * - `aggregatedNode`: For facets that enhance existing references (e.g., Position/Mark facets return enhanced tag with payload as child)
     * 
     * **Edit Operation Handling:**
     * 
     * This method handles edit operations:
     * 
     * 1. **Remove operations** (when `reference.ref < 0`):
     *    - If `referenceRender` is provided and wrapped in `<Remove>`, pass it through unchanged (don't enhance - it's being removed)
     *    - If `reference.schema` returns a Remove-wrapped reference (when `ref < 0`), extract the inner reference node,
     *      enhance it with payload content, then wrap the enhanced node back in `<Remove>`
     *    - Example: `<Remove><Mark uuid=(...)><Match>narrative</Match></Mark></Remove>`
     * 
     * 2. **Replace operations**:
     *    - ReplaceClass instances should use their `schema` getter (which returns the Replace structure) and combine it with the reference node
     *    - For Position/Mark facets: Reference node wraps the Replace structure as a child
     *    - For Exit facets: Exit node contains the Replace structure as children
     * 
     * @param reference - The StandardReference for the target component. When `reference.ref < 0`, 
     *   `reference.schema` will return a Remove-wrapped reference that must be preserved.
     * @param payload - The payload data to render
     * @param referenceRender - Optional pre-existing render of the reference already in the parent's schema tree
     *   (e.g., Room already rendered by Map as a child). If not provided, generate a plain reference render
     *   (just the tag without children, e.g., `<Room to=(target)>` with no children).
     *   If this is Remove-wrapped, it will be passed through unchanged.
     * @param lookup - Optional lookup function to resolve universal keys to local keys for rendering.
     *   When provided, allows facets to render human-readable local keys (e.g., `to=(room1)`) instead of
     *   universal keys (e.g., `to=(ROOM#room1)`) when the component exists in the current asset context.
     *   If not provided or lookup fails, falls back to universal key format for unambiguous references.
     * @returns An object with either `newNode` (for facets that create new nodes) or `aggregatedNode`
     *   (for facets that enhance existing references), but not both. Exit-style facets return `newNode`;
     *   Position/Mark-style facets return `aggregatedNode`. Remove wrappers are preserved when present.
     */
    renderFacet(reference: StandardReference, payload: TPayload, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> };
}
