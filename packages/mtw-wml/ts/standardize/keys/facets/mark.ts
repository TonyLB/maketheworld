import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditablePayload, standardEditableFactory } from "../../../generics/editable";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { MarkFacetPayload as MarkFacetPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isMarkFacetPayload } from "./dataTypes/facet";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
import { FacetPayloadBase } from "./dataTypes/facetPayloadBase";
import { facetClassFactory } from './facetFactory';

/**
 * MarkFacetPayload class: Implements StandardEditablePayload and FacetPayloadBase
 * 
 * StandardEditablePayload provides payload-level operations (clone, toJSON, schema for payload Replace operations)
 * FacetPayloadBase provides renderFacet() for parent component orchestration
 */
export class MarkFacetPayload implements StandardEditablePayload<MarkFacetPayloadType>, FacetPayloadBase<MarkFacetPayloadType> {
    narrative: string;

    constructor(data?: MarkFacetPayloadType) {
        if (data !== undefined) {
            if (!isMarkFacetPayload(data)) {
                throw new Error('Invalid MarkFacetPayload data');
            }
            // data is now a string (the narrative)
            this.narrative = data;
        } else {
            // Placeholder value for empty constructor (will be overridden by fromSchema)
            this.narrative = '';
        }
    }

    // StandardEditablePayload implementation
    clone(): StandardEditablePayload<MarkFacetPayloadType> {
        return new MarkFacetPayload(this.toJSON());
    }

    toJSON(): MarkFacetPayloadType {
        // Return just the narrative string
        return this.narrative;
    }

    /**
     * Generate schema for just the Match tag (not Mark+Match)
     * This is used by StandardEditable wrappers for payload Replace operations
     */
    get schema(): GenericTree<SchemaTag> {
        return [{
            data: { tag: 'Match' as const },
            children: [{
                data: { tag: 'String' as const, value: this.narrative },
                children: []
            }]
        }];
    }

    // FacetPayloadBase methods
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): MarkFacetPayloadType {
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

        // Return just the narrative string
        return narrative;
    }

    // FacetPayloadBase implementation
    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // payload is now a string (the narrative), use it directly
        const matchChild: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Match' as const },
            children: [{
                data: { tag: 'String' as const, value: payload },
                children: []
            }]
        };

        // Handle Remove-wrapped referenceRender: pass through unchanged
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let markNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
            // If referenceRender provided, enhance it by adding Match child
            if (!treeNodeTypeguard(isSchemaMark)(referenceRender)) {
                throw new Error('Invalid referenceRender: expected Mark tag');
            }
            markNode = {
                ...referenceRender,
                children: [
                    matchChild,
                    ...referenceRender.children
                ]
            };
        } else {
            // If referenceRender not provided, generate plain Mark reference render
            const markSchema = reference.schema;
            if (markSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = markSchema[0];
            
            // Handle Remove-wrapped reference from reference.schema (when ref < 0)
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                // Extract inner Mark node, enhance it, then wrap back in Remove
                // firstNode.children is an array (GenericTree<SchemaTag>)
                if (!firstNode.children || firstNode.children.length === 0) {
                    throw new Error('Invalid Remove-wrapped reference schema: Remove node has no children');
                }
                const innerMark = firstNode.children[0];
                if (!innerMark) {
                    throw new Error('Invalid Remove-wrapped reference schema: Remove node has no Mark child');
                }
                // Verify innerMark is a Mark node
                if (!treeNodeTypeguard(isSchemaMark)(innerMark)) {
                    throw new Error(`Invalid Remove-wrapped reference schema: expected Mark tag inside Remove, got ${innerMark.data?.tag || 'unknown'}`);
                }
                // Create enhanced Mark node with Match child
                // Explicitly preserve the data property to ensure it's recognized as a Mark node
                const enhancedMark: GenericTreeNode<SchemaTag> = {
                    data: { ...innerMark.data },
                    children: [
                        matchChild,
                        ...innerMark.children
                    ]
                };
                // Verify enhancedMark is still a Mark node
                if (!treeNodeTypeguard(isSchemaMark)(enhancedMark)) {
                    throw new Error('Failed to create valid Mark node in Remove wrapper');
                }
                // Wrap back in Remove - preserve the Remove node structure
                return {
                    aggregatedNode: {
                        data: firstNode.data,
                        children: [enhancedMark]
                    }
                };
            }
            
            if (!treeNodeTypeguard(isSchemaMark)(firstNode)) {
                throw new Error('Invalid reference schema: expected Mark tag');
            }
            // Create enhanced Mark node with Match child
            markNode = {
                ...firstNode,
                children: [
                    matchChild,
                    ...firstNode.children
                ]
            };
        }

        // Mark facets always enhance Mark references, so return aggregatedNode (never newNode)
        return { aggregatedNode: markNode };
    }
}

// Factory function for creating MarkFacetPayload instances from various formats
const payloadFactory = (props: MarkFacetPayloadType | GenericTree<SchemaTag>): StandardEditablePayload<MarkFacetPayloadType> | undefined => {
    // Handle string input (payload format)
    if (isMarkFacetPayload(props)) {
        return new MarkFacetPayload(props);
    }
    // Handle GenericTree<SchemaTag> input (schema parsing)
    if (Array.isArray(props) && props.length > 0) {
        // For GenericTree<SchemaTag>, we need a reference to parse
        // This factory is used by StandardEditable, so we'll handle plain Match tag parsing
        const firstElement = props[0];
        if (treeNodeTypeguard(isSchemaMatch)(firstElement)) {
            // Extract narrative from Match tag's String children
            const narrative = firstElement.children
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('');
            return new MarkFacetPayload(narrative);
        }
        // Also handle Mark+Match structure (for FacetPayloadBase.fromSchema compatibility)
        // This would typically be called from FacetPayloadBase.fromSchema, but included for completeness
        const markNode = props.find(node => treeNodeTypeguard(isSchemaMark)(node));
        if (markNode && treeNodeTypeguard(isSchemaMark)(markNode)) {
            const match = markNode.children.find(treeNodeTypeguard(isSchemaMatch));
            if (match && treeNodeTypeguard(isSchemaMatch)(match)) {
                const narrative = match.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('');
                return new MarkFacetPayload(narrative);
            }
        }
    }
    throw new Error('Invalid argument in MarkFacetPayload factory');
};

// Add/subtract/diff functions for StandardEditable factory
// Now work with string payloads directly
// Note: These functions may receive MarkFacetPayload instances or MarkFacetPayloadType (string)
// We extract the data using toJSON() if needed
const standardMarkFacetPayloadAdd = (base: MarkFacetPayloadType | MarkFacetPayload, incoming: MarkFacetPayloadType | MarkFacetPayload): MarkFacetPayloadType => {
    // const baseData = base instanceof MarkFacetPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof MarkFacetPayload ? incoming.toJSON() : incoming;
    // Replace semantics: incoming wins
    return incomingData;
};

const standardMarkFacetPayloadSubtract = (base: MarkFacetPayloadType | MarkFacetPayload, incoming: MarkFacetPayloadType | MarkFacetPayload): { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType } => {
    const baseData = base instanceof MarkFacetPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof MarkFacetPayload ? incoming.toJSON() : incoming;
    if (baseData === incomingData) {
        return { add: undefined, remove: undefined };
    }
    throw new MergeConflictError('Conflict during subtract operation');
};

const standardMarkFacetPayloadDiff = (base: MarkFacetPayloadType | MarkFacetPayload, incoming: MarkFacetPayloadType | MarkFacetPayload): { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType } => {
    const baseData = base instanceof MarkFacetPayload ? base.toJSON() : base;
    const incomingData = incoming instanceof MarkFacetPayload ? incoming.toJSON() : incoming;
    if (baseData === incomingData) {
        return { add: undefined, remove: undefined };
    }
    return { add: incomingData, remove: baseData };
};

// Create StandardEditable factory
// Note: The type signatures expect MarkFacetPayloadType (string), but addDelta passes MarkFacetPayload instances.
// Our functions handle both by extracting data using toJSON() when needed.
export const {
    constructorDelta: factory,
    typeguard: isStandardMarkFacetPayloadData,
    merge,
    diff
} = standardEditableFactory({
    typeguard: isMarkFacetPayload,
    payloadFactory: payloadFactory,
    payload: MarkFacetPayload,
    add: standardMarkFacetPayloadAdd as (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType) => MarkFacetPayloadType,
    subtract: standardMarkFacetPayloadSubtract as (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType) => { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType },
    diff: standardMarkFacetPayloadDiff as (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType) => { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType }
});

export class StandardMarkFacet extends facetClassFactory(MarkFacetPayload, 'MarkFacet') {
    constructor(
        props: StandardFacetData<MarkFacetPayloadType> | StandardMarkFacet | { tag: 'Replace'; match: StandardFacetData<MarkFacetPayloadType>; payload: StandardFacetData<MarkFacetPayloadType> } | GenericTree<SchemaTag> | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardMarkFacet(instance as StandardMarkFacet) as this;
    }
}

// Create concrete list class for MarkFacet
import { facetListClassFactory } from './facetListFactory';
export class MarkFacetList extends facetListClassFactory(StandardMarkFacet, 'MarkFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new MarkFacetList(instance as MarkFacetList) as this;
    }
}
