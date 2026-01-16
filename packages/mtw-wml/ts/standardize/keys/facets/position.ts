import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { v2StandardEditableFactory, StandardEditablePayload } from "../../../generics/editable";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { PositionPayload as PositionPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isPositionPayload } from "./dataTypes/facet";
import { isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from './facetFactory';
import { isSchemaTreeNode, treeFromWML } from "../../../schema";

//
// StandardPositionPayloadBase holds the contents for a simple PositionPayload
//
export class StandardPositionPayloadBase implements StandardEditablePayload<PositionPayloadType> {
    x: number;
    y: number;

    constructor(data: PositionPayloadType) {
        if (!isPositionPayload(data)) {
            throw new Error('Invalid StandardPositionPayloadBase data');
        }
        this.x = data.x;
        this.y = data.y;
    }

    clone(): StandardEditablePayload<PositionPayloadType> {
        return new StandardPositionPayloadBase(this.toJSON());
    }

    toJSON(): PositionPayloadType {
        return {
            x: this.x,
            y: this.y
        };
    }

    get schema(): GenericTree<SchemaTag> {
        return [{
            data: { tag: 'Position' as const, x: this.x, y: this.y },
            children: []
        }];
    }
}

// Factory function for creating StandardPositionPayloadBase instances
const payloadFactory = (props: PositionPayloadType | GenericTree<SchemaTag>): StandardPositionPayloadBase | undefined => {
    // Handle {x, y} object input
    if (isPositionPayload(props)) {
        return new StandardPositionPayloadBase(props);
    }
    // Handle GenericTree<SchemaTag> input (schema parsing)
    if (Array.isArray(props) && props.length > 0) {
        // Handle plain Position tag
        const firstElement = props[0];
        if (treeNodeTypeguard(isSchemaPosition)(firstElement)) {
            const { x, y } = firstElement.data;
            if (typeof x === 'number' && typeof y === 'number') {
                return new StandardPositionPayloadBase({ x, y });
            }
        }
    }
    throw new Error('Invalid argument in StandardPositionPayloadBase factory');
};

// Add/subtract/diff functions for v2StandardEditableFactory
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

// Create v2StandardEditableFactory for PositionPayload
export const { 
    EditableClass: PositionEditableClass, 
    PlainClass: PositionPlainClass, 
    RemoveClass: PositionRemoveClass, 
    ReplaceClass: PositionReplaceClass, 
    dataTypeguard: isStandardPositionPayloadData 
} = v2StandardEditableFactory({
    typeguard: isPositionPayload,
    payloadFactory: payloadFactory,
    payload: StandardPositionPayloadBase,
    add: standardPositionPayloadAdd,
    subtract: standardPositionPayloadSubtract,
    diff: standardPositionPayloadDiff
}, 'StandardPositionPayload')

// Extended StandardPositionPayload v2 classes for Position facets with FacetPayloadBase methods

export class PositionFacetPlainClass extends PositionPlainClass {
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): PositionFacetPlainClass | PositionFacetRemoveClass | PositionFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof PositionFacetPlainClass || instance instanceof PositionFacetRemoveClass || instance instanceof PositionFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createPositionFacetPayload(data);
    }
    
    // FacetPayloadBase methods
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

        const { x, y } = position.data;
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Invalid schema: Position tag missing x or y coordinates');
        }

        return { x, y };
    }

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use schema directly (no wrapper) - just Position tag as children of Room
        const positionChild = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let roomNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
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
            const roomSchema = reference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                const innerRoom = firstNode.children[0];
                if (!innerRoom || !treeNodeTypeguard(isSchemaRoom)(innerRoom)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Room tag inside Remove');
                }
                const enhancedRoom: GenericTreeNode<SchemaTag> = {
                    ...innerRoom,
                    children: [
                        positionChild,
                        ...innerRoom.children
                    ]
                };
                return {
                    aggregatedNode: {
                        ...firstNode,
                        children: [enhancedRoom]
                    }
                };
            }
            
            if (!treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                throw new Error('Invalid reference schema: expected Room tag');
            }
            roomNode = {
                ...firstNode,
                children: [
                    positionChild,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: roomNode };
    }
}

export class PositionFacetRemoveClass extends PositionRemoveClass {
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): PositionFacetPlainClass | PositionFacetRemoveClass | PositionFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof PositionFacetPlainClass || instance instanceof PositionFacetRemoveClass || instance instanceof PositionFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createPositionFacetPayload(data);
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): PositionPayloadType {
        const match = (this as any).match;
        if (match && match.x !== undefined && match.y !== undefined) {
            return { x: match.x, y: match.y };
        }
        // Fallback: parse from schema
        const plainClass = new PositionFacetPlainClass(node);
        return plainClass.fromSchema(node, reference);
    }

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use this.schema which returns Remove-wrapped Position: [{ tag: 'Remove', children: [Position] }]
        // Extract the Remove-wrapped Position structure for nested Remove tags when ref < 0
        const removeWrappedPosition = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let roomNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
            if (!treeNodeTypeguard(isSchemaRoom)(referenceRender)) {
                throw new Error('Invalid referenceRender: expected Room tag');
            }
            roomNode = {
                ...referenceRender,
                children: [
                    removeWrappedPosition,
                    ...referenceRender.children
                ]
            };
        } else {
            const roomSchema = reference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                const innerRoom = firstNode.children[0];
                if (!innerRoom || !treeNodeTypeguard(isSchemaRoom)(innerRoom)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Room tag inside Remove');
                }
                // When both reference and payload are Remove-wrapped, create nested Remove structure
                // removeWrappedPosition is already <Remove><Position/></Remove>, so we get nested Removes
                const enhancedRoom: GenericTreeNode<SchemaTag> = {
                    ...innerRoom,
                    children: [
                        removeWrappedPosition,  // This is already Remove-wrapped Position: <Remove><Position/></Remove>
                        ...innerRoom.children
                    ]
                };
                return {
                    aggregatedNode: {
                        ...firstNode,
                        children: [enhancedRoom]
                    }
                };
            }
            
            if (!treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                throw new Error('Invalid reference schema: expected Room tag');
            }
            roomNode = {
                ...firstNode,
                children: [
                    removeWrappedPosition,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: roomNode };
    }
}

export class PositionFacetReplaceClass extends PositionReplaceClass {
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): PositionFacetPlainClass | PositionFacetRemoveClass | PositionFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof PositionFacetPlainClass || instance instanceof PositionFacetRemoveClass || instance instanceof PositionFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createPositionFacetPayload(data);
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): PositionPayloadType {
        const payload = (this as any).payload;
        if (payload && payload.x !== undefined && payload.y !== undefined) {
            return { x: payload.x, y: payload.y };
        }
        // Fallback: parse from schema
        const plainClass = new PositionFacetPlainClass(node);
        return plainClass.fromSchema(node, reference);
    }

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use schema getter which already returns Replace-wrapped structure
        const replaceSchema = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let roomNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
            if (!treeNodeTypeguard(isSchemaRoom)(referenceRender)) {
                throw new Error('Invalid referenceRender: expected Room tag');
            }
            roomNode = {
                ...referenceRender,
                children: [
                    replaceSchema,
                    ...referenceRender.children
                ]
            };
        } else {
            const roomSchema = reference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                const innerRoom = firstNode.children[0];
                if (!innerRoom || !treeNodeTypeguard(isSchemaRoom)(innerRoom)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Room tag inside Remove');
                }
                const enhancedRoom: GenericTreeNode<SchemaTag> = {
                    ...innerRoom,
                    children: [
                        replaceSchema,
                        ...innerRoom.children
                    ]
                };
                return {
                    aggregatedNode: {
                        ...firstNode,
                        children: [enhancedRoom]
                    }
                };
            }
            
            if (!treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                throw new Error('Invalid reference schema: expected Room tag');
            }
            roomNode = {
                ...firstNode,
                children: [
                    replaceSchema,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: roomNode };
    }
}

// Custom factory function that replicates EditableClass.create() logic but returns extended classes
export function createPositionFacetPayload(arg: any): PositionFacetPlainClass | PositionFacetRemoveClass | PositionFacetReplaceClass {
    // Handle string by parsing to schema tree first
    const factoryProps: any = typeof arg === 'string' ? treeFromWML(arg) : arg;
    
    // Handle Remove/Replace objects BEFORE checking isStandardPositionPayloadData
    // (because isStandardPositionPayloadData may incorrectly return true for Remove/Replace objects)
    if (typeof factoryProps === 'object' && factoryProps !== null && 'tag' in factoryProps) {
        if (factoryProps.tag === 'Remove' && 'match' in factoryProps && isStandardPositionPayloadData(factoryProps.match)) {
            return new PositionFacetRemoveClass(factoryProps);
        }
        if (factoryProps.tag === 'Replace' && 'match' in factoryProps && 'payload' in factoryProps 
            && isStandardPositionPayloadData(factoryProps.match) && isStandardPositionPayloadData(factoryProps.payload)) {
            return new PositionFacetReplaceClass(factoryProps);
        }
    }
    
    // Handle schema tree parsing for Remove/Replace tags
    if (Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) {
        const schema = factoryProps;
        if (schema.length === 0) {
            return new PositionFacetPlainClass(schema);
        }
        
        const firstElement = schema[0];
        if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
            return new PositionFacetRemoveClass(schema);
        }
        else if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
            return new PositionFacetReplaceClass(schema);
        }
        else {
            // Schema tree doesn't start with Remove/Replace - might be a full facet schema (e.g., <Room><Position.../>)
            // Handle nested Remove structures: <Room><Remove><Position /></Remove></Room>
            // Extract Remove-wrapped Position structure if present
            if (treeNodeTypeguard(isSchemaRoom)(firstElement)) {
                const removeChild = firstElement.children.find(child => treeNodeTypeguard(isSchemaRemove)(child));
                if (removeChild && treeNodeTypeguard(isSchemaRemove)(removeChild)) {
                    // Nested Remove: extract Remove-wrapped Position schema for RemoveClass
                    // Structure: <Remove><Position /></Remove>
                    const removeSchema: GenericTree<SchemaTag> = [removeChild];
                    return new PositionFacetRemoveClass(removeSchema);
                }
                // No nested Remove - try normal Position extraction
            }
            // Try to extract Position child using fromSchema
            const tempPayload = new PositionFacetPlainClass({ x: 0, y: 0 });
            try {
                const extractedData = tempPayload.fromSchema(schema, new StandardReference('ROOM#temp', 'Room'));
                return new PositionFacetPlainClass(extractedData);
            } catch {
                // If fromSchema fails, try passing schema directly (might be just Position tag)
                return new PositionFacetPlainClass(schema);
            }
        }
    }
    
    // Check if it's a StandardEditableData of the appropriate type (plain data)
    if (isStandardPositionPayloadData(factoryProps)) {
        return new PositionFacetPlainClass(factoryProps);
    }
    
    // Default to plain - might be a schema tree that needs parsing
    // Try to extract using fromSchema if it looks like a schema
    if (Array.isArray(factoryProps) && factoryProps.length > 0) {
        const tempPayload = new PositionFacetPlainClass({ x: 0, y: 0 });
        try {
            const extractedData = tempPayload.fromSchema(factoryProps, new StandardReference('ROOM#temp', 'Room'));
            return new PositionFacetPlainClass(extractedData);
        } catch {
            // If fromSchema fails, pass as-is
        }
    }
    return new PositionFacetPlainClass(factoryProps);
}

export class StandardPositionFacet extends facetClassFactory(
    {
        EditableClass: PositionEditableClass,
        PlainClass: PositionFacetPlainClass,
        RemoveClass: PositionFacetRemoveClass,
        ReplaceClass: PositionFacetReplaceClass
    },
    createPositionFacetPayload,
    'PositionFacet'
) {
    constructor(
        props: StandardFacetData<PositionPayloadType> | StandardPositionFacet | GenericTree<SchemaTag> | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardPositionFacet(instance as StandardPositionFacet) as this;
    }
}

// Create concrete list class for PositionFacet
import { facetListClassFactory } from './facetListFactory';
export class PositionFacetList extends facetListClassFactory(StandardPositionFacet, 'PositionFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new PositionFacetList(instance as PositionFacetList) as this;
    }
}
