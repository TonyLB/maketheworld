import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditablePayload, standardEditableFactory } from "../../../generics/editable";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { PositionPayload as PositionPayloadType } from "./dataTypes/facet";
import { isPositionPayload } from "./dataTypes/facet";
import { isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components";
import { FacetPayloadBase } from "./dataTypes/facetPayloadBase";
import { facetClassFactory } from './facetFactory';

/**
 * PositionPayload class: Implements StandardEditablePayload and FacetPayloadBase
 * 
 * StandardEditablePayload provides payload-level operations (clone, toJSON, schema for payload Replace operations)
 * FacetPayloadBase provides renderFacet() for parent component orchestration
 */
export class PositionPayload implements StandardEditablePayload<PositionPayloadType>, FacetPayloadBase<PositionPayloadType> {
    x: number;
    y: number;

    constructor(data?: PositionPayloadType) {
        if (data) {
            if (!isPositionPayload(data)) {
                throw new Error('Invalid PositionPayload data');
            }
            this.x = data.x;
            this.y = data.y;
        } else {
            // Placeholder values for empty constructor (will be overridden by fromSchema)
            this.x = 0;
            this.y = 0;
        }
    }

    // StandardEditablePayload implementation
    clone(): StandardEditablePayload<PositionPayloadType> {
        return new PositionPayload(this.toJSON());
    }

    toJSON(): PositionPayloadType {
        return {
            type: 'PositionFacet' as const,
            x: this.x,
            y: this.y
        };
    }

    /**
     * Generate schema for just the Position tag (not Room+Position)
     * This is used by StandardEditable wrappers for payload Replace operations
     */
    get schema(): GenericTree<SchemaTag> {
        return [{
            data: { tag: 'Position' as const, x: this.x, y: this.y },
            children: []
        }];
    }

    // FacetPayloadBase methods (provided separately since we can't implement both interfaces directly due to schema property/method conflict)
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): PositionPayloadType {
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }

        const firstElement = node[0];

        // Find the Room tag in the node
        let roomNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaRoom)(firstElement)) {
            roomNode = firstElement;
        } else {
            // Try to find Room in children if first element is a wrapper (e.g., ReplaceMatch, ReplacePayload)
            const roomChild = firstElement.children?.find(child => 
                treeNodeTypeguard(isSchemaRoom)(child)
            );
            if (roomChild && treeNodeTypeguard(isSchemaRoom)(roomChild)) {
                roomNode = roomChild;
            }
        }

        if (!roomNode || !treeNodeTypeguard(isSchemaRoom)(roomNode)) {
            throw new Error('Invalid schema: Room tag not found');
        }

        // Extract Position child tag from Room's children
        const position = roomNode.children.find(treeNodeTypeguard(isSchemaPosition));
        if (!position || !treeNodeTypeguard(isSchemaPosition)(position)) {
            throw new Error('Invalid schema: Position child not found in Room');
        }

        // Validate x and y are numbers
        const { x, y } = position.data;
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Invalid schema: Position tag missing x or y coordinates');
        }

        return {
            type: 'PositionFacet' as const,
            x,
            y
        };
    }

    // FacetPayloadBase implementation
    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Create Position child tag from payload
        const positionChild: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Position' as const, x: payload.x, y: payload.y },
            children: []
        };

        let roomNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
            // If referenceRender provided, enhance it by adding Position child
            if (!treeNodeTypeguard(isSchemaRoom)(referenceRender)) {
                throw new Error('Invalid referenceRender: expected Room tag');
            }
            roomNode = {
                ...referenceRender,
                children: [
                    positionChild,
                    ...referenceRender.children
                ]
            };
        } else {
            // If referenceRender not provided, generate plain Room reference render
            const roomSchema = reference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            if (!treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                throw new Error('Invalid reference schema: expected Room tag');
            }
            // Create enhanced Room node with Position child
            roomNode = {
                ...firstNode,
                children: [
                    positionChild,
                    ...firstNode.children
                ]
            };
        }

        // Position facets always enhance Room references, so return aggregatedNode (never newNode)
        return { aggregatedNode: roomNode };
    }
}

// Factory function for creating PositionPayload instances from various formats
const payloadFactory = (props: PositionPayloadType | GenericTree<SchemaTag>): StandardEditablePayload<PositionPayloadType> | undefined => {
    if (isPositionPayload(props)) {
        return new PositionPayload(props);
    }
    if (Array.isArray(props) && props.length > 0) {
        // For GenericTree<SchemaTag>, we need a reference to parse
        // This factory is used by StandardEditable, so we'll handle plain Position tag parsing
        const firstElement = props[0];
        if (treeNodeTypeguard(isSchemaPosition)(firstElement)) {
            const { x, y } = firstElement.data;
            if (typeof x === 'number' && typeof y === 'number') {
                return new PositionPayload({
                    type: 'PositionFacet',
                    x,
                    y
                });
            }
        }
        // Also handle Room+Position structure (for FacetPayloadBase.fromSchema compatibility)
        // This would typically be called from FacetPayloadBase.fromSchema, but included for completeness
        const roomNode = props.find(node => treeNodeTypeguard(isSchemaRoom)(node));
        if (roomNode && treeNodeTypeguard(isSchemaRoom)(roomNode)) {
            const position = roomNode.children.find(treeNodeTypeguard(isSchemaPosition));
            if (position && treeNodeTypeguard(isSchemaPosition)(position)) {
                const { x, y } = position.data;
                if (typeof x === 'number' && typeof y === 'number') {
                    return new PositionPayload({
                        type: 'PositionFacet',
                        x,
                        y
                    });
                }
            }
        }
    }
    throw new Error('Invalid argument in PositionPayload factory');
};

// Add/subtract/diff functions for StandardEditable factory
const standardPositionPayloadAdd = (base: PositionPayloadType, incoming: PositionPayloadType): PositionPayloadType => {
    // Replace semantics: incoming wins
    return incoming;
};

const standardPositionPayloadSubtract = (base: PositionPayloadType, incoming: PositionPayloadType): { add?: PositionPayloadType, remove?: PositionPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    throw new MergeConflictError('Conflict during subtract operation');
};

const standardPositionPayloadDiff = (base: PositionPayloadType, incoming: PositionPayloadType): { add?: PositionPayloadType, remove?: PositionPayloadType } => {
    if (deepEqual(base, incoming)) {
        return { add: undefined, remove: undefined };
    }
    return { add: incoming, remove: base };
};

// Create StandardEditable factory
export const {
    constructorDelta: factory,
    typeguard: isStandardPositionPayloadData,
    merge,
    diff
} = standardEditableFactory({
    typeguard: isPositionPayload,
    payloadFactory: payloadFactory,
    payload: PositionPayload,
    add: standardPositionPayloadAdd,
    subtract: standardPositionPayloadSubtract,
    diff: standardPositionPayloadDiff
});

export const StandardPositionFacet = facetClassFactory(PositionPayload, 'PositionFacet');

// Create concrete list class for PositionFacet
import { facetListClassFactory } from './facetListFactory';
export const PositionFacetList = facetListClassFactory(StandardPositionFacet, 'PositionFacetList');
