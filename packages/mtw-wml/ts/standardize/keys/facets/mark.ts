import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import type { MarkFacetPayload as MarkFacetPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from './facetFactory';
import { StandardLiteral } from "../../literal";
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";
import { transformNestedChildren } from "../../../schema/utils";
import { TagMismatchError } from "@tonylb/mtw-base/ts/standardize";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";

// Unified MarkFacetPayload class extending StandardLiteral
export class MarkFacetPayload extends StandardLiteral {
    constructor(arg: any) {
        // Use StandardLiteral with Match tag wrapper
        super(arg, { tag: 'Match' });
    }
    
    // Override nestedSchema to ensure Match tag is always used
    override nestedSchema(tag?: SchemaTag): GenericTree<SchemaTag> {
        // Always use 'Match' tag, ignoring parameter (facet-specific)
        return super.nestedSchema({ tag: 'Match' as const });
    }
    
    // Override _wrap to preserve MarkFacetPayload type through operations
    override _wrap(instance: StandardLiteral): MarkFacetPayload {
        return new MarkFacetPayload(instance);
    }
    
    // FacetPayloadBase method: parse from schema
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference, _context?: StandardizeFromSchemaContext): MarkFacetPayloadType {
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }

        const firstElement = node[0];

        // Find the Mark tag in the node
        let markNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaMark)(firstElement)) {
            markNode = firstElement;
        } else {
            // Try to find Mark in children if first element is a wrapper (e.g., ReplaceMatch, ReplacePayload)
            const markChild = firstElement.children?.find(child => 
                treeNodeTypeguard(isSchemaMark)(child)
            );
            if (markChild && treeNodeTypeguard(isSchemaMark)(markChild)) {
                markNode = markChild;
            }
        }

        if (!markNode || !treeNodeTypeguard(isSchemaMark)(markNode)) {
            throw new Error('Invalid schema: Mark tag not found');
        }

        // Extract Match child tag from Mark's children
        const match = markNode.children.find(treeNodeTypeguard(isSchemaMatch));
        if (!match || !treeNodeTypeguard(isSchemaMatch)(match)) {
            throw new Error('Invalid schema: Match child not found in Mark');
        }

        // Extract narrative string from Match tag's String children
        const narrative = match.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('');

        return narrative;
    }

    // FacetPayloadBase method: render facet
    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Unified implementation that works for Plain/Remove/Replace via nestedSchema
        const matchChild = this.nestedSchema({ tag: 'Match' as const })[0];
        
        // Handle Remove-wrapped referenceRender: pass through unchanged
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }
        
        const transformMarkChildren = transformNestedChildren({
            tag: 'Mark',
            transform: (children) => [matchChild, ...children]
        });
        
        if (referenceRender) {
            try {
                const markNode = transformMarkChildren(referenceRender);
                return { aggregatedNode: markNode };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error('Invalid referenceRender: expected Mark tag');
                }
                throw error;
            }
        } else {
            // Format reference to use local key if lookup finds one, otherwise use existing key or universal key
            // This ensures we render human-readable keys when components exist in the asset
            const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
            const formattedReference = lookedUpReference.toFormat('key').withRef(reference.ref);
            const markSchema = formattedReference.schema;
            if (markSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = markSchema[0];
            const markNode = transformMarkChildren(firstNode);
            return { aggregatedNode: markNode };
        }
    }
}


// Factory function - StandardLiteral constructor handles all dispatch logic
export function createMarkFacetPayload(arg: any): MarkFacetPayload {
    // Handle RenderTree conversion
    const convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg;
    
    // Handle string by parsing to schema tree first
    const factoryProps: any = typeof convertedArg === 'string' ? treeFromWML(convertedArg) : convertedArg;
    
    // Handle schema tree that might contain Mark tag - extract Match children
    if (Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) {
        const schema = factoryProps;
        if (schema.length > 0) {
            const firstElement = schema[0];
            // If first element is a Mark tag, extract its children (which contain the Match tag or Remove/Replace wrappers)
            if (treeNodeTypeguard(isSchemaMark)(firstElement)) {
                // Validate that Mark has a Match child (unless wrapped in Remove/Replace which is handled by StandardLiteral)
                // Check if children is empty or doesn't contain Match (and isn't Remove/Replace wrapped)
                const hasMatch = firstElement.children.some(treeNodeTypeguard(isSchemaMatch));
                const hasRemove = firstElement.children.some(treeNodeTypeguard(isSchemaRemove));
                const hasReplace = firstElement.children.some(treeNodeTypeguard(isSchemaReplace));
                
                // If no Match, Remove, or Replace found, this is an invalid Mark tag
                if (!hasMatch && !hasRemove && !hasReplace && firstElement.children.length > 0) {
                    // Has children but no Match - this is an error (unless all children are valid wrappers we didn't check for)
                    throw new Error('Invalid schema: Match child not found in Mark');
                }
                // If children is completely empty, also error (empty Mark with no Match)
                if (firstElement.children.length === 0) {
                    throw new Error('Invalid schema: Match child not found in Mark');
                }
                
                // Extract Match children from Mark tag - this is what StandardLiteral expects
                return new MarkFacetPayload(firstElement.children);
            }
        }
    }
    
    // StandardLiteral constructor with { tag: 'Match' } handles:
    // - RenderTree conversion (already done above)
    // - String parsing
    // - Schema tree parsing (including Remove/Replace/Match tags)
    // - StandardEditableData handling
    // The stripWrapperTag logic in StandardLiteral constructor will handle Match tag unwrapping
    return new MarkFacetPayload(factoryProps);
}

export class StandardMarkFacet extends facetClassFactory(
    MarkFacetPayload,
    createMarkFacetPayload,
    'MarkFacet'
) {
    constructor(
        props: StandardFacetData<MarkFacetPayloadType> | StandardMarkFacet | GenericTree<SchemaTag> | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardMarkFacet(instance as StandardMarkFacet) as this;
    }
}

// Create concrete list class for MarkFacet
import { facetListClassFactory } from './facetListFactory';
import { StandardKey } from "../key";
import { StandardComponent } from "../../components/baseClasses";
export class MarkFacetList extends facetListClassFactory(StandardMarkFacet, 'MarkFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new MarkFacetList(instance as MarkFacetList) as this;
    }
}
