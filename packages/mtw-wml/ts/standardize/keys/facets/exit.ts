import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditablePayload, standardEditableFactory } from "../../../generics/editable";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { ExitPayload as ExitPayloadType } from "./dataTypes/facet";
import { isExitPayload } from "./dataTypes/facet";
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { FacetPayloadBase } from "./dataTypes/facetPayloadBase";
import { facetClassFactory } from './facetFactory';

/**
 * ExitPayload class: Implements StandardEditablePayload and FacetPayloadBase
 * 
 * StandardEditablePayload provides payload-level operations (clone, toJSON, schema for payload Replace operations)
 * FacetPayloadBase provides renderFacet() for parent component orchestration
 */
export class ExitPayload implements StandardEditablePayload<ExitPayloadType>, FacetPayloadBase<ExitPayloadType> {
    description?: string;

    constructor(data?: ExitPayloadType) {
        if (data) {
            if (!isExitPayload(data)) {
                throw new Error('Invalid ExitPayload data');
            }
            this.description = data.description;
        }
        // No placeholder needed - description is optional
    }

    // StandardEditablePayload implementation
    clone(): StandardEditablePayload<ExitPayloadType> {
        return new ExitPayload(this.toJSON());
    }

    toJSON(): ExitPayloadType {
        return {
            type: 'ExitFacet' as const,
            description: this.description
        };
    }

    /**
     * Generate schema for just the Exit tag (not the full Exit facet structure)
     * This is used by StandardEditable wrappers for payload Replace operations
     * The `to` property uses empty string since it's reference-based and provided by facet context
     */
    get schema(): GenericTree<SchemaTag> {
        return [{
            data: { tag: 'Exit' as const, to: '' },
            children: this.description !== undefined ? [{
                data: { tag: 'String' as const, value: this.description },
                children: []
            }] : []
        }];
    }

    // FacetPayloadBase methods
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): ExitPayloadType {
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }

        const firstElement = node[0];

        // Find the Exit tag in the node
        let exitNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
            exitNode = firstElement;
        } else {
            // Try to find Exit in children if first element is a wrapper (e.g., ReplaceMatch, ReplacePayload)
            const exitChild = firstElement.children?.find(child => 
                treeNodeTypeguard(isSchemaExit)(child)
            );
            if (exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)) {
                exitNode = exitChild;
            }
        }

        if (!exitNode || !treeNodeTypeguard(isSchemaExit)(exitNode)) {
            throw new Error('Invalid schema: Exit tag not found');
        }

        // Extract description from Exit tag's String children
        const description = exitNode.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('') || undefined;

        return {
            type: 'ExitFacet' as const,
            description
        };
    }

    // FacetPayloadBase implementation
    renderFacet(reference: StandardReference, payload: ExitPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Exit facets always ignore referenceRender (they create new nodes, not enhancements)
        // Generate Exit tag with reference embedded in `to` property
        const toKey = reference.standardKey.toFormat('key');
        const toValue = toKey.key ?? toKey.universalKey ?? '';

        const exitNode: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Exit' as const, to: toValue },
            children: payload.description !== undefined ? [{
                data: { tag: 'String' as const, value: payload.description },
                children: []
            }] : []
        };

        // Exit facets always create new nodes, so return newNode (never aggregatedNode)
        return { newNode: exitNode };
    }
}

// Factory function for creating ExitPayload instances from various formats
const payloadFactory = (props: ExitPayloadType | GenericTree<SchemaTag>): StandardEditablePayload<ExitPayloadType> | undefined => {
    if (isExitPayload(props)) {
        return new ExitPayload(props);
    }
    if (Array.isArray(props) && props.length > 0) {
        // For GenericTree<SchemaTag>, we need a reference to parse
        // This factory is used by StandardEditable, so we'll handle plain Exit tag parsing
        const firstElement = props[0];
        if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
            // Extract description from Exit tag's String children
            const description = firstElement.children
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('') || undefined;
            return new ExitPayload({
                type: 'ExitFacet',
                description
            });
        }
    }
    throw new Error('Invalid argument in ExitPayload factory');
};

// Add/subtract/diff functions for StandardEditable factory
const standardExitPayloadAdd = (base: ExitPayloadType, incoming: ExitPayloadType): ExitPayloadType => {
    // Replace semantics: incoming wins
    return incoming;
};

const standardExitPayloadSubtract = (base: ExitPayloadType, incoming: ExitPayloadType): { add?: ExitPayloadType, remove?: ExitPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    throw new MergeConflictError('Conflict during subtract operation');
};

const standardExitPayloadDiff = (base: ExitPayloadType, incoming: ExitPayloadType): { add?: ExitPayloadType, remove?: ExitPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    return { add: incoming, remove: base };
};

// Create StandardEditable factory
export const {
    constructorDelta: factory,
    typeguard: isStandardExitPayloadData,
    merge,
    diff
} = standardEditableFactory({
    typeguard: isExitPayload,
    payloadFactory: payloadFactory,
    payload: ExitPayload,
    add: standardExitPayloadAdd,
    subtract: standardExitPayloadSubtract,
    diff: standardExitPayloadDiff
});

const exitReferenceFactory = (schema: GenericTree<SchemaTag>): StandardReference => {
    // Find Exit tag (may be wrapped in ReplaceMatch/ReplacePayload)
    const firstElement = schema[0];
    let exitNode: GenericTreeNode<SchemaTag> | undefined;
    
    if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
        exitNode = firstElement;
    } else {
        // Try to find Exit in children if first element is a wrapper (e.g., ReplaceMatch, ReplacePayload)
        const exitChild = firstElement.children?.find(child => 
            treeNodeTypeguard(isSchemaExit)(child)
        );
        if (exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)) {
            exitNode = exitChild;
        }
    }
    
    if (!exitNode || !treeNodeTypeguard(isSchemaExit)(exitNode)) {
        throw new Error('Exit tag not found in schema');
    }
    
    const toValue = exitNode.data.to;
    if (!toValue) {
        throw new Error('Exit tag missing `to` property');
    }
    
    // StandardReference constructor handles key/UUID parsing
    return new StandardReference(toValue, 'Room');
};

export const StandardExitFacet = facetClassFactory(ExitPayload, 'ExitFacet', exitReferenceFactory);
