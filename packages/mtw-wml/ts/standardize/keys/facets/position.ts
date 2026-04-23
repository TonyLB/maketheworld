import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { standardEditableFactory, StandardEditablePayload } from "../../../generics/editable";
import { MergeConflictError, TagMismatchError } from "@tonylb/mtw-base/ts/standardize";
import { deepEqual } from "../../../lib/objects";
import { StandardReference } from "../reference";
import type { PositionPayload as PositionPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isPositionPayload } from "./dataTypes/facet";
import { isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from './facetFactory';
import { isSchemaTreeNode, treeFromWML } from "../../../schema";
import { transformNestedChildren, splitTaggedChildren } from "../../../schema/utils";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";

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

// Add/subtract/diff functions for standardEditableFactory
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

// Create standardEditableFactory for PositionPayload
export const { 
    EditableClass: PositionEditableClass, 
    PlainClass: PositionPlainClass, 
    RemoveClass: PositionRemoveClass, 
    ReplaceClass: PositionReplaceClass, 
    dataTypeguard: isStandardPositionPayloadData 
} = standardEditableFactory({
    typeguard: isPositionPayload,
    payloadFactory: payloadFactory,
    payload: StandardPositionPayloadBase,
    add: standardPositionPayloadAdd,
    subtract: standardPositionPayloadSubtract,
    diff: standardPositionPayloadDiff
}, 'StandardPositionPayload')

// Unified PositionFacetPayload wrapper class (similar to StandardLiteral but for Position payloads)
export class PositionFacetPayload {
    _payload: InstanceType<typeof PositionEditableClass>;

    constructor(arg: any) {
        // If arg is already a PositionEditableClass instance, use it directly
        // (e.g., when called from clone(), merge(), diff(), invert())
        if (arg && typeof arg === 'object' && '_delta' in arg && 'toJSON' in arg && 'schema' in arg) {
            this._payload = arg as InstanceType<typeof PositionEditableClass>;
        } else {
            // Use PositionEditableClass.create() for dispatch to Plain/Remove/Replace
            this._payload = PositionEditableClass.create(arg);
        }
    }

    get schema(): GenericTree<SchemaTag> {
        return this._payload.schema;
    }

    nestedSchema(tag?: SchemaTag): GenericTree<SchemaTag> {
        // Position doesn't need a wrapper tag, just return schema directly
        return this._payload.schema;
    }

    clone(): PositionFacetPayload {
        return new PositionFacetPayload(this._payload.clone());
    }

    toJSON(): PositionPayloadType | { tag: 'Remove', match: PositionPayloadType } | { tag: 'Replace', match: PositionPayloadType, payload: PositionPayloadType } {
        return this._payload.toJSON();
    }

    merge(incoming: PositionFacetPayload): PositionFacetPayload | undefined {
        const merged = this._payload.merge(incoming._payload);
        if (merged) {
            return new PositionFacetPayload(merged);
        }
        return undefined;
    }

    diff(incoming: PositionFacetPayload | undefined): PositionFacetPayload | undefined {
        if (incoming) {
            const diff = this._payload.diff(incoming._payload);
            if (diff) {
                return new PositionFacetPayload(diff);
            }
            return undefined;
        } else {
            const inverted = this._payload.invert();
            return new PositionFacetPayload(inverted);
        }
    }

    invert(): PositionFacetPayload {
        const inverted = this._payload.invert();
        return new PositionFacetPayload(inverted);
    }

    get plain(): StandardPositionPayloadBase | undefined {
        return this._payload.plain;
    }

    // FacetPayloadBase method: parse from schema
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference, context?: StandardizeFromSchemaContext): PositionPayloadType {
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

    // FacetPayloadBase method: render facet
    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Unified implementation that works for Plain/Remove/Replace via schema getter
        const positionChild = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const transformRoomChildren = transformNestedChildren({
            tag: 'Room',
            transform: (children) => [positionChild, ...children]
        });

        if (referenceRender) {
            try {
                const roomNode = transformRoomChildren(referenceRender);
                return { aggregatedNode: roomNode };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error('Invalid referenceRender: expected Room tag');
                }
                throw error;
            }
        } else {
            // Format reference to use local key if lookup finds one, otherwise use existing key or universal key
            // This ensures we render human-readable keys when components exist in the asset
            const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
            const formattedReference = lookedUpReference.toFormat('key').withRef(reference.ref);
            const roomSchema = formattedReference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            const roomNode = transformRoomChildren(firstNode);
            return { aggregatedNode: roomNode };
        }
    }
}

// Legacy classes kept temporarily for backwards compatibility during refactor

export class PositionFacetPlainClass extends PositionPlainClass {
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): PositionFacetPlainClass | PositionFacetRemoveClass | PositionFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof PositionFacetPlainClass || instance instanceof PositionFacetRemoveClass || instance instanceof PositionFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        const unifiedPayload = createPositionFacetPayload(data);
        // For backward compatibility, we'd need to wrap back to old classes, but since we're phasing them out,
        // just return the unified class (tests will need updating)
        return unifiedPayload as any;
    }
    
    // FacetPayloadBase methods
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference, context?: StandardizeFromSchemaContext): PositionPayloadType {
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

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use schema directly (no wrapper) - just Position tag as children of Room
        const positionChild = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const transformRoomChildren = transformNestedChildren({
            tag: 'Room',
            transform: (children) => [positionChild, ...children]
        });

        if (referenceRender) {
            try {
                const roomNode = transformRoomChildren(referenceRender);
                return { aggregatedNode: roomNode };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error('Invalid referenceRender: expected Room tag');
                }
                throw error;
            }
        } else {
            // Format reference to use local key if lookup finds one, otherwise use existing key or universal key
            // This ensures we render human-readable keys when components exist in the asset
            const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
            const formattedReference = lookedUpReference.toFormat('key').withRef(reference.ref);
            const roomSchema = formattedReference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            const roomNode = transformRoomChildren(firstNode);
            return { aggregatedNode: roomNode };
        }
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
        const unifiedPayload = createPositionFacetPayload(data);
        // For backward compatibility, we'd need to wrap back to old classes, but since we're phasing them out,
        // just return the unified class (tests will need updating)
        return unifiedPayload as any;
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference, context?: StandardizeFromSchemaContext): PositionPayloadType {
        const match = (this as any).match;
        if (match && match.x !== undefined && match.y !== undefined) {
            return { x: match.x, y: match.y };
        }
        // Fallback: parse from schema
        const plainClass = new PositionFacetPlainClass(node);
        return plainClass.fromSchema(node, reference, context);
    }

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use this.schema which returns Remove-wrapped Position: [{ tag: 'Remove', children: [Position] }]
        // Extract the Remove-wrapped Position structure for nested Remove tags when ref < 0
        const removeWrappedPosition = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const transformRoomChildren = transformNestedChildren({
            tag: 'Room',
            transform: (children) => [removeWrappedPosition, ...children]
        });

        if (referenceRender) {
            try {
                const roomNode = transformRoomChildren(referenceRender);
                return { aggregatedNode: roomNode };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error('Invalid referenceRender: expected Room tag');
                }
                throw error;
            }
        } else {
            // Format reference to use local key if lookup finds one, otherwise use existing key or universal key
            // This ensures we render human-readable keys when components exist in the asset
            const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
            const formattedReference = lookedUpReference.toFormat('key').withRef(reference.ref);
            const roomSchema = formattedReference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            const roomNode = transformRoomChildren(firstNode);
            return { aggregatedNode: roomNode };
        }
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
        const unifiedPayload = createPositionFacetPayload(data);
        // For backward compatibility, we'd need to wrap back to old classes, but since we're phasing them out,
        // just return the unified class (tests will need updating)
        return unifiedPayload as any;
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference, context?: StandardizeFromSchemaContext): PositionPayloadType {
        const payload = (this as any).payload;
        if (payload && payload.x !== undefined && payload.y !== undefined) {
            return { x: payload.x, y: payload.y };
        }
        // Fallback: parse from schema
        const plainClass = new PositionFacetPlainClass(node);
        return plainClass.fromSchema(node, reference, context);
    }

    renderFacet(reference: StandardReference, payload: PositionPayloadType, referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use schema getter which already returns Replace-wrapped structure
        const replaceSchema = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const transformRoomChildren = transformNestedChildren({
            tag: 'Room',
            transform: (children) => [replaceSchema, ...children]
        });

        if (referenceRender) {
            try {
                const roomNode = transformRoomChildren(referenceRender);
                return { aggregatedNode: roomNode };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error('Invalid referenceRender: expected Room tag');
                }
                throw error;
            }
        } else {
            // Format reference to use local key if lookup finds one, otherwise use existing key or universal key
            // This ensures we render human-readable keys when components exist in the asset
            const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
            const formattedReference = lookedUpReference.toFormat('key').withRef(reference.ref);
            const roomSchema = formattedReference.schema;
            if (roomSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = roomSchema[0];
            const roomNode = transformRoomChildren(firstNode);
            return { aggregatedNode: roomNode };
        }
    }
}

// Factory function - PositionEditableClass.create() handles all dispatch logic
export function createPositionFacetPayload(arg: any): PositionFacetPayload {
    // Handle string by parsing to schema tree first
    const factoryProps: any = typeof arg === 'string' ? treeFromWML(arg) : arg;
    
    // Handle schema tree that might contain Room tag - extract Position children
    if (Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) {
        const schema = factoryProps;
        if (schema.length > 0) {
            const firstElement = schema[0];
            // If first element is a Room tag, extract only Position children (and Remove/Replace wrappers containing Position)
            if (treeNodeTypeguard(isSchemaRoom)(firstElement)) {
                // Extract only Position children from Room tag - splitTaggedChildren handles Remove/Replace wrappers
                // This ensures payloadFactory receives a tree where the first element is a Position tag (or Remove/Replace wrapper)
                const { matched: positionChildren } = splitTaggedChildren({ children: firstElement.children, tag: 'Position' });
                if (positionChildren.length === 0) {
                    throw new Error('Room node does not contain Position children');
                }
                // PositionEditableClass expects a tree where Position tags (or their wrappers) are the top-level elements
                return new PositionFacetPayload(positionChildren);
            }
        }
    }
    
    // PositionEditableClass.create() handles:
    // - Remove/Replace objects
    // - Schema tree parsing (including Remove/Replace tags)
    // - StandardEditableData handling
    return new PositionFacetPayload(factoryProps);
}


export class StandardPositionFacet extends facetClassFactory(
    PositionFacetPayload,
    createPositionFacetPayload,
    'PositionFacet',
    undefined,
    {
        missingPayloadDefault: () => ({ x: 0, y: 0 })
    }
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
import { StandardKey } from "../key";
import { StandardComponent } from "../../components/baseClasses";
export class PositionFacetList extends facetListClassFactory(StandardPositionFacet, 'PositionFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new PositionFacetList(instance as PositionFacetList) as this;
    }
}
