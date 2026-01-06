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
        if (data) {
            if (!isMarkFacetPayload(data)) {
                throw new Error('Invalid MarkFacetPayload data');
            }
            this.narrative = data.narrative;
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
        return {
            type: 'MarkFacet' as const,
            narrative: this.narrative
        };
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

        return {
            type: 'MarkFacet' as const,
            narrative
        };
    }

    // FacetPayloadBase implementation
    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Create Match child tag from payload narrative
        const matchChild: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Match' as const },
            children: [{
                data: { tag: 'String' as const, value: payload.narrative },
                children: []
            }]
        };

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
    if (isMarkFacetPayload(props)) {
        return new MarkFacetPayload(props);
    }
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
            return new MarkFacetPayload({
                type: 'MarkFacet',
                narrative
            });
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
                return new MarkFacetPayload({
                    type: 'MarkFacet',
                    narrative
                });
            }
        }
    }
    throw new Error('Invalid argument in MarkFacetPayload factory');
};

// Add/subtract/diff functions for StandardEditable factory
const standardMarkFacetPayloadAdd = (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType): MarkFacetPayloadType => {
    // Replace semantics: incoming wins
    return incoming;
};

const standardMarkFacetPayloadSubtract = (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType): { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    throw new MergeConflictError('Conflict during subtract operation');
};

const standardMarkFacetPayloadDiff = (base: MarkFacetPayloadType, incoming: MarkFacetPayloadType): { add?: MarkFacetPayloadType, remove?: MarkFacetPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    return { add: incoming, remove: base };
};

// Create StandardEditable factory
export const {
    constructorDelta: factory,
    typeguard: isStandardMarkFacetPayloadData,
    merge,
    diff
} = standardEditableFactory({
    typeguard: isMarkFacetPayload,
    payloadFactory: payloadFactory,
    payload: MarkFacetPayload,
    add: standardMarkFacetPayloadAdd,
    subtract: standardMarkFacetPayloadSubtract,
    diff: standardMarkFacetPayloadDiff
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
