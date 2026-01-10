import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { StandardEditablePayload, standardEditableFactory } from "../../../generics/editable";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { ExitPayload as ExitPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isExitPayload } from "./dataTypes/facet";
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
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
        if (data !== undefined) {
            if (!isExitPayload(data)) {
                throw new Error('Invalid ExitPayload data');
            }
            // data is now string | undefined (the description directly)
            this.description = data;
        }
        // No placeholder needed - description is optional
    }

    // StandardEditablePayload implementation
    clone(): StandardEditablePayload<ExitPayloadType> {
        return new ExitPayload(this.toJSON());
    }

    toJSON(): ExitPayloadType {
        // Return just the description string (or undefined if missing)
        return this.description;
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

        // Return just the description string (or undefined if missing)
        return description;
    }

    // FacetPayloadBase implementation
    renderFacet(reference: StandardReference, payload: ExitPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Handle Remove-wrapped referenceRender: pass through unchanged (though Exit facets don't typically use referenceRender)
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        // Exit facets always ignore referenceRender (they create new nodes, not enhancements)
        // Generate Exit tag with reference embedded in `to` property
        const toKey = reference.standardKey.toFormat('key');
        const toValue = toKey.key ?? toKey.universalKey ?? '';

        // payload is now string | undefined (the description directly)
        const exitNode: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Exit' as const, to: toValue },
            children: payload !== undefined ? [{
                data: { tag: 'String' as const, value: payload },
                children: []
            }] : []
        };

        // Handle Remove-wrapped reference from reference.schema (when ref < 0)
        // Exit facets create new nodes, so we wrap the new Exit node in Remove if needed
        const exitSchema = reference.schema;
        if (exitSchema.length > 0) {
            const firstNode = exitSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                // Wrap the new Exit node in Remove
                return {
                    newNode: {
                        ...firstNode,
                        children: [exitNode]
                    }
                };
            }
        }

        // Exit facets always create new nodes, so return newNode (never aggregatedNode)
        return { newNode: exitNode };
    }
}

// Factory function for creating ExitPayload instances from various formats
const payloadFactory = (props: ExitPayloadType | GenericTree<SchemaTag>): StandardEditablePayload<ExitPayloadType> | undefined => {
    // Handle string | undefined input (payload format)
    if (isExitPayload(props)) {
        return new ExitPayload(props);
    }
    // Handle GenericTree<SchemaTag> input (schema parsing)
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
            return new ExitPayload(description);
        }
    }
    throw new Error('Invalid argument in ExitPayload factory');
};

// Add/subtract/diff functions for StandardEditable factory
// Now work with string | undefined payloads directly
// Note: These functions may receive ExitPayload instances or ExitPayloadType (string | undefined)
// We extract the data using toJSON() if needed
const standardExitPayloadAdd = (base: ExitPayloadType | ExitPayload, incoming: ExitPayloadType | ExitPayload): ExitPayloadType => {
    const baseData = base instanceof ExitPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof ExitPayload ? incoming.toJSON() : incoming;
    // Replace semantics: incoming wins
    return incomingData;
};

const standardExitPayloadSubtract = (base: ExitPayloadType | ExitPayload, incoming: ExitPayloadType | ExitPayload): { add?: ExitPayloadType, remove?: ExitPayloadType } => {
    const baseData = base instanceof ExitPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof ExitPayload ? incoming.toJSON() : incoming;
    if (baseData === incomingData) {
        return { add: undefined, remove: undefined };
    }
    throw new MergeConflictError('Conflict during subtract operation');
};

const standardExitPayloadDiff = (base: ExitPayloadType | ExitPayload, incoming: ExitPayloadType | ExitPayload): { add?: ExitPayloadType, remove?: ExitPayloadType } => {
    const baseData = base instanceof ExitPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof ExitPayload ? incoming.toJSON() : incoming;
    if (baseData === incomingData) {
        return { add: undefined, remove: undefined };
    }
    return { add: incomingData, remove: baseData };
};

// Create StandardEditable factory
// Note: The type signatures expect ExitPayloadType (string | undefined), but addDelta passes ExitPayload instances.
// Our functions handle both by extracting data using toJSON() when needed.
export const {
    constructorDelta: factory,
    typeguard: isStandardExitPayloadData,
    merge,
    diff
} = standardEditableFactory({
    typeguard: isExitPayload,
    payloadFactory: payloadFactory,
    payload: ExitPayload,
    add: standardExitPayloadAdd as (base: ExitPayloadType, incoming: ExitPayloadType) => ExitPayloadType,
    subtract: standardExitPayloadSubtract as (base: ExitPayloadType, incoming: ExitPayloadType) => { add?: ExitPayloadType, remove?: ExitPayloadType },
    diff: standardExitPayloadDiff as (base: ExitPayloadType, incoming: ExitPayloadType) => { add?: ExitPayloadType, remove?: ExitPayloadType }
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
    
    // StandardReference constructor: if toValue is a ComponentUUID string, pass it directly.
    // If it's just a key, pass it as an object with key and tag.
    if (typeof toValue === 'string' && isSchemaComponentUUID(toValue)) {
        return new StandardReference(toValue, 'Room');
    } else {
        return new StandardReference({ key: toValue, tag: 'Room' });
    }
};

export class StandardExitFacet extends facetClassFactory(ExitPayload, 'ExitFacet', exitReferenceFactory) {
    constructor(
        props: StandardFacetData<ExitPayloadType> | StandardExitFacet | { tag: 'Replace'; match: StandardFacetData<ExitPayloadType>; payload: StandardFacetData<ExitPayloadType> } | GenericTree<SchemaTag> | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardExitFacet(instance as StandardExitFacet) as this;
    }
}

// Create concrete list class for ExitFacet
import { facetListClassFactory } from './facetListFactory';
export class ExitFacetList extends facetListClassFactory(StandardExitFacet, 'ExitFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new ExitFacetList(instance as ExitFacetList) as this;
    }
}
