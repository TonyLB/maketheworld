import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import type { ExitPayload as ExitPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isSchemaExit, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from './facetFactory';
import { EditableClass, PlainClass, RemoveClass, ReplaceClass, isStandardLiteralData } from "../../literal";
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";

// Extended StandardLiteral v2 classes for Exit facets with FacetPayloadBase methods
// Note: Exit payload is string | undefined, but StandardLiteral works with string.
// We convert undefined <-> empty string for StandardLiteral compatibility.

export class ExitFacetPlainClass extends PlainClass {
    // Helper to convert undefined to empty string for StandardLiteral
    private static normalizeForLiteral(value: ExitPayloadType): string {
        return value ?? '';
    }
    
    // Helper to convert empty string back to undefined for Exit payload
    private static denormalizeFromLiteral(value: string): ExitPayloadType {
        return value === '' ? undefined : value;
    }
    
    // Override toJSON to convert empty string back to undefined
    override toJSON(): any {
        const literalJSON = super.toJSON();
        if (typeof literalJSON === 'string') {
            return ExitFacetPlainClass.denormalizeFromLiteral(literalJSON);
        }
        return literalJSON;
    }
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): ExitFacetPlainClass | ExitFacetRemoveClass | ExitFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof ExitFacetPlainClass || instance instanceof ExitFacetRemoveClass || instance instanceof ExitFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createExitFacetPayload(data);
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

        return description;
    }

    renderFacet(reference: StandardReference, payload: ExitPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const toKey = reference.standardKey.toFormat('key');
        const toValue = toKey.key ?? toKey.universalKey ?? '';

        // Use schema directly (no wrapper) - just String tag as children of Exit
        const stringSchema = this.schema; // Returns [{ data: { tag: 'String', value: ... }, children: [] }]
        const exitNode: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Exit' as const, to: toValue },
            children: payload !== undefined ? stringSchema : []
        };

        const exitSchema = reference.schema;
        if (exitSchema.length > 0) {
            const firstNode = exitSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                return {
                    newNode: {
                        ...firstNode,
                        children: [exitNode]
                    }
                };
            }
        }

        return { newNode: exitNode };
    }
}

export class ExitFacetRemoveClass extends RemoveClass {
    // Helper methods (same as PlainClass)
    private static normalizeForLiteral(value: ExitPayloadType): string {
        return value ?? '';
    }
    
    private static denormalizeFromLiteral(value: string): ExitPayloadType {
        return value === '' ? undefined : value;
    }
    
    override toJSON(): any {
        const literalJSON = super.toJSON();
        if (literalJSON && typeof literalJSON === 'object' && 'tag' in literalJSON && literalJSON.tag === 'Remove' && 'match' in literalJSON) {
            return {
                tag: 'Remove' as const,
                match: ExitFacetRemoveClass.denormalizeFromLiteral(literalJSON.match)
            };
        }
        return literalJSON;
    }
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): ExitFacetPlainClass | ExitFacetRemoveClass | ExitFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof ExitFacetPlainClass || instance instanceof ExitFacetRemoveClass || instance instanceof ExitFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createExitFacetPayload(data);
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): ExitPayloadType {
        const match = (this as any).match;
        if (match && match.data) {
            return ExitFacetRemoveClass.denormalizeFromLiteral(match.data);
        }
        // Fallback: parse from schema
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }
        const firstElement = node[0];
        let exitNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
            exitNode = firstElement;
        } else {
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
        const description = exitNode.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('') || undefined;
        return description;
    }

    renderFacet(reference: StandardReference, payload: ExitPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const toKey = reference.standardKey.toFormat('key');
        const toValue = toKey.key ?? toKey.universalKey ?? '';

        // For Remove, extract match schema (the String tag)
        const match = (this as any).match;
        const stringSchema = match?.schema ?? [];
        const exitNode: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Exit' as const, to: toValue },
            children: stringSchema
        };

        const exitSchema = reference.schema;
        if (exitSchema.length > 0) {
            const firstNode = exitSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                return {
                    newNode: {
                        ...firstNode,
                        children: [exitNode]
                    }
                };
            }
        }

        return { newNode: exitNode };
    }
}

export class ExitFacetReplaceClass extends ReplaceClass {
    // Helper methods (same as PlainClass)
    private static normalizeForLiteral(value: ExitPayloadType): string {
        return value ?? '';
    }
    
    private static denormalizeFromLiteral(value: string): ExitPayloadType {
        return value === '' ? undefined : value;
    }
    
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): ExitFacetPlainClass | ExitFacetRemoveClass | ExitFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof ExitFacetPlainClass || instance instanceof ExitFacetRemoveClass || instance instanceof ExitFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createExitFacetPayload(data);
    }
    
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): ExitPayloadType {
        const payload = (this as any).payload;
        if (payload && payload.data) {
            return ExitFacetReplaceClass.denormalizeFromLiteral(payload.data);
        }
        // Fallback: parse from schema
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }
        const firstElement = node[0];
        let exitNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
            exitNode = firstElement;
        } else {
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
        const description = exitNode.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('') || undefined;
        return description;
    }

    renderFacet(reference: StandardReference, payload: ExitPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const toKey = reference.standardKey.toFormat('key');
        const toValue = toKey.key ?? toKey.universalKey ?? '';

        // Use schema getter which already returns Replace-wrapped structure
        const replaceSchema = this.schema[0];
        const exitNode: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Exit' as const, to: toValue },
            children: [replaceSchema]
        };

        const exitSchema = reference.schema;
        if (exitSchema.length > 0) {
            const firstNode = exitSchema[0];
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                return {
                    newNode: {
                        ...firstNode,
                        children: [exitNode]
                    }
                };
            }
        }

        // For Replace operations on Exit facets, wrap Replace structure in Room and return aggregatedNode
        // The replaceSchema has ReplaceMatch/ReplacePayload with String children, but we need Exit tags inside them
        // Extract ReplaceMatch and ReplacePayload, wrap their String children in Exit tags, reconstruct Replace
        const replaceMatch = replaceSchema.children.find(child => treeNodeTypeguard(isSchemaReplaceMatch)(child));
        const replacePayload = replaceSchema.children.find(child => treeNodeTypeguard(isSchemaReplacePayload)(child));
        
        if (replaceMatch && replacePayload) {
            // Extract String children from ReplaceMatch and ReplacePayload, wrap each in Exit tag
            const exitMatchNode: GenericTreeNode<SchemaTag> = {
                data: { tag: 'Exit' as const, to: toValue },
                children: replaceMatch.children // String tags from match
            };
            const exitPayloadNode: GenericTreeNode<SchemaTag> = {
                data: { tag: 'Exit' as const, to: toValue },
                children: replacePayload.children // String tags from payload
            };
            
            // Reconstruct Replace structure with Exit tags inside ReplaceMatch/ReplacePayload
            const exitReplaceSchema: GenericTreeNode<SchemaTag> = {
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: [exitMatchNode] },
                    { data: { tag: 'ReplacePayload' as const }, children: [exitPayloadNode] }
                ]
            };
            
            // Wrap in Room and return aggregatedNode
            const roomSchema = reference.schema;
            if (roomSchema.length > 0) {
                const firstNode = roomSchema[0];
                if (treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                    const roomNode: GenericTreeNode<SchemaTag> = {
                        ...firstNode,
                        children: [
                            exitReplaceSchema,
                            ...firstNode.children
                        ]
                    };
                    return { aggregatedNode: roomNode };
                }
            }
        }

        return { newNode: exitNode };
    }
}

// Helper to convert undefined to empty string for StandardLiteral
function normalizeForLiteral(value: ExitPayloadType): string {
    return value ?? '';
}

// Helper to convert empty string back to undefined for Exit payload
function denormalizeFromLiteral(value: string): ExitPayloadType {
    return value === '' ? undefined : value;
}

// Custom factory function that replicates EditableClass.create() logic but returns extended classes
function createExitFacetPayload(arg: any): ExitFacetPlainClass | ExitFacetRemoveClass | ExitFacetReplaceClass {
    // Handle RenderTree conversion
    const convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg;
    
    // Convert undefined to empty string for StandardLiteral compatibility
    const normalizedArg = convertedArg === undefined ? '' : (typeof convertedArg === 'object' && convertedArg !== null && 'tag' in convertedArg && convertedArg.tag === 'Remove' && convertedArg.match === undefined)
        ? { ...convertedArg, match: '' }
        : (typeof convertedArg === 'object' && convertedArg !== null && 'tag' in convertedArg && convertedArg.tag === 'Replace' && (convertedArg.match === undefined || convertedArg.payload === undefined))
        ? { ...convertedArg, match: convertedArg.match ?? '', payload: convertedArg.payload ?? '' }
        : convertedArg === undefined ? '' : convertedArg;
    
    // Handle string by parsing to schema tree first
    const factoryProps: any = typeof normalizedArg === 'string' ? treeFromWML(normalizedArg) : normalizedArg;
    
    // Handle Remove/Replace objects BEFORE checking isStandardLiteralData
    // (because isStandardLiteralData may incorrectly return true for Remove/Replace objects)
    if (typeof factoryProps === 'object' && factoryProps !== null && 'tag' in factoryProps) {
        if (factoryProps.tag === 'Remove' && 'match' in factoryProps) {
            const normalizedMatch = normalizeForLiteral(factoryProps.match);
            if (isStandardLiteralData(normalizedMatch)) {
                return new ExitFacetRemoveClass({ tag: 'Remove' as const, match: normalizedMatch });
            }
        }
        if (factoryProps.tag === 'Replace' && 'match' in factoryProps && 'payload' in factoryProps) {
            const normalizedMatch = normalizeForLiteral(factoryProps.match);
            const normalizedPayload = normalizeForLiteral(factoryProps.payload);
            if (isStandardLiteralData(normalizedMatch) && isStandardLiteralData(normalizedPayload)) {
                return new ExitFacetReplaceClass({ tag: 'Replace' as const, match: normalizedMatch, payload: normalizedPayload });
            }
        }
    }
    
    // Handle schema tree parsing for Remove/Replace tags
    if (Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) {
        const schema = factoryProps;
        if (schema.length === 0) {
            return new ExitFacetPlainClass(schema);
        }
        
        const firstElement = schema[0];
        if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
            // Extract String children from Exit tag inside Remove for StandardLiteral payloadFactory
            const exitChild = firstElement.children.find(child => treeNodeTypeguard(isSchemaExit)(child));
            if (exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)) {
                const stringChildren = exitChild.children.filter(child => isSchemaString(child.data));
                // Reconstruct Remove schema with String children instead of Exit tag
                const modifiedSchema: GenericTree<SchemaTag> = [{
                    data: firstElement.data,
                    children: stringChildren
                }];
                return new ExitFacetRemoveClass(modifiedSchema);
            }
            return new ExitFacetRemoveClass(schema);
        }
        else if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
            // Extract String children from Exit tags inside ReplaceMatch and ReplacePayload
            const replaceMatch = firstElement.children.find(child => treeNodeTypeguard(isSchemaReplaceMatch)(child));
            const replacePayload = firstElement.children.find(child => treeNodeTypeguard(isSchemaReplacePayload)(child));
            
            const modifiedChildren: GenericTreeNode<SchemaTag>[] = [];
            
            if (replaceMatch) {
                const exitChild = replaceMatch.children.find(child => treeNodeTypeguard(isSchemaExit)(child));
                const stringChildren = exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)
                    ? exitChild.children.filter(child => isSchemaString(child.data))
                    : replaceMatch.children;
                modifiedChildren.push({
                    data: replaceMatch.data,
                    children: stringChildren
                });
            }
            
            if (replacePayload) {
                const exitChild = replacePayload.children.find(child => treeNodeTypeguard(isSchemaExit)(child));
                const stringChildren = exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)
                    ? exitChild.children.filter(child => isSchemaString(child.data))
                    : replacePayload.children;
                modifiedChildren.push({
                    data: replacePayload.data,
                    children: stringChildren
                });
            }
            
            if (modifiedChildren.length > 0) {
                const modifiedSchema: GenericTree<SchemaTag> = [{
                    data: firstElement.data,
                    children: modifiedChildren
                }];
                return new ExitFacetReplaceClass(modifiedSchema);
            }
            return new ExitFacetReplaceClass(schema);
        }
        else {
            // Extract String children from Exit tag for StandardLiteral payloadFactory
            // payloadFactory expects [{ tag: 'String', value: '...' }] not [{ tag: 'Exit', children: [...] }]
            // For empty descriptions (no String children), pass empty string '' instead of empty array
            let payloadArg: string | GenericTree<SchemaTag>;
            if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
                // Extract String children from Exit tag
                const stringChildren = firstElement.children.filter(child => isSchemaString(child.data));
                if (stringChildren.length === 0) {
                    // Empty description - pass empty string (normalized for StandardLiteral)
                    payloadArg = '';
                } else {
                    // Has String children - pass them to payloadFactory
                    payloadArg = stringChildren;
                }
            } else {
                // If not an Exit tag, pass schema as-is (shouldn't happen for Exit facets, but handle gracefully)
                payloadArg = schema;
            }
            return new ExitFacetPlainClass(payloadArg);
        }
    }
    
    // Check if it's a StandardEditableData of the appropriate type (plain data)
    if (isStandardLiteralData(factoryProps)) {
        return new ExitFacetPlainClass(factoryProps);
    }
    
    // Default to plain
    return new ExitFacetPlainClass(factoryProps);
}

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

export class StandardExitFacet extends facetClassFactory(
    {
        EditableClass: EditableClass,
        PlainClass: ExitFacetPlainClass,
        RemoveClass: ExitFacetRemoveClass,
        ReplaceClass: ExitFacetReplaceClass
    },
    createExitFacetPayload,
    'ExitFacet',
    exitReferenceFactory
) {
    constructor(
        props: StandardFacetData<ExitPayloadType> | StandardExitFacet | GenericTree<SchemaTag> | string
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
