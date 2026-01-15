import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import type { MarkFacetPayload as MarkFacetPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from './facetFactory';
import { EditableClass, PlainClass, RemoveClass, ReplaceClass, isStandardLiteralData, StandardLiteral } from "../../literal";
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";

// Extended StandardLiteral v2 classes for Mark facets with FacetPayloadBase methods

export class MarkFacetPlainClass extends PlainClass {
    // Override nestedSchema to wrap in Match tag
    override nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        // Wrap the String schema in Match tag
        return [{ data: { tag: 'Match' as const }, children: this.schema }];
    }
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): MarkFacetPlainClass | MarkFacetRemoveClass | MarkFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof MarkFacetPlainClass || instance instanceof MarkFacetRemoveClass || instance instanceof MarkFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createMarkFacetPayload(data);
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

        return narrative;
    }

    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use nestedSchema to wrap content in Match tag (already overridden above)
        const matchChild = this.nestedSchema({ tag: 'Match' as const })[0];

        // Handle Remove-wrapped referenceRender: pass through unchanged
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let markNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
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
            const markSchema = reference.schema;
            if (markSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = markSchema[0];
            
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                if (!firstNode.children || firstNode.children.length === 0) {
                    throw new Error('Invalid Remove-wrapped reference schema: Remove node has no children');
                }
                const innerMark = firstNode.children[0];
                if (!innerMark || !treeNodeTypeguard(isSchemaMark)(innerMark)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Mark tag inside Remove');
                }
                const enhancedMark: GenericTreeNode<SchemaTag> = {
                    data: { ...innerMark.data },
                    children: [
                        matchChild,
                        ...innerMark.children
                    ]
                };
                if (!treeNodeTypeguard(isSchemaMark)(enhancedMark)) {
                    throw new Error('Failed to create valid Mark node in Remove wrapper');
                }
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
            markNode = {
                ...firstNode,
                children: [
                    matchChild,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: markNode };
    }
}

export class MarkFacetRemoveClass extends RemoveClass {
    // Override nestedSchema to wrap match in Match tag, then in Remove
    override nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        const match = (this as any).match;
        return [{
            data: { tag: 'Remove' as const },
            children: [{ data: { tag: 'Match' as const }, children: match?.schema ?? [] }]
        }];
    }
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): MarkFacetPlainClass | MarkFacetRemoveClass | MarkFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof MarkFacetPlainClass || instance instanceof MarkFacetRemoveClass || instance instanceof MarkFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createMarkFacetPayload(data);
    }
    
    // FacetPayloadBase methods
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): MarkFacetPayloadType {
        // For Remove, extract from the match payload
        // The match property contains the StandardLiteralSimpleBase instance
        const match = (this as any).match;
        if (match && match.data) {
            return match.data;
        }
        // Fallback: parse from schema using the same logic as PlainClass
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }
        const firstElement = node[0];
        let markNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaMark)(firstElement)) {
            markNode = firstElement;
        } else {
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
        const matchTag = markNode.children.find(treeNodeTypeguard(isSchemaMatch));
        if (!matchTag || !treeNodeTypeguard(isSchemaMatch)(matchTag)) {
            throw new Error('Invalid schema: Match child not found in Mark');
        }
        const narrative = matchTag.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('');
        return narrative;
    }

    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use nestedSchema to get the wrapped structure (Remove > Match > String)
        // Then extract just the Match part for rendering
        const nested = this.nestedSchema({ tag: 'Match' as const });
        const removeNode = nested[0];
        const matchChild = removeNode?.children?.[0] as GenericTreeNode<SchemaTag> | undefined;
        if (!matchChild) {
            throw new Error('Invalid nested schema structure for Remove');
        }

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let markNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
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
            const markSchema = reference.schema;
            if (markSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = markSchema[0];
            
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                if (!firstNode.children || firstNode.children.length === 0) {
                    throw new Error('Invalid Remove-wrapped reference schema: Remove node has no children');
                }
                const innerMark = firstNode.children[0];
                if (!innerMark || !treeNodeTypeguard(isSchemaMark)(innerMark)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Mark tag inside Remove');
                }
                const enhancedMark: GenericTreeNode<SchemaTag> = {
                    data: { ...innerMark.data },
                    children: [
                        matchChild,
                        ...innerMark.children
                    ]
                };
                if (!treeNodeTypeguard(isSchemaMark)(enhancedMark)) {
                    throw new Error('Failed to create valid Mark node in Remove wrapper');
                }
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
            markNode = {
                ...firstNode,
                children: [
                    matchChild,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: markNode };
    }
}

export class MarkFacetReplaceClass extends ReplaceClass {
    // Override nestedSchema to wrap match and payload in Match tags, then in Replace
    override nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
        const match = (this as any).match;
        const payload = (this as any).payload;
        return [{
            data: { tag: 'Replace' as const },
            children: [
                { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: 'Match' as const }, children: match?.schema ?? [] }] },
                { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: 'Match' as const }, children: payload?.schema ?? [] }] }
            ]
        }];
    }
    
    // Override _wrap to convert base class instances to appropriate extended facet classes
    override _wrap(instance: any): MarkFacetPlainClass | MarkFacetRemoveClass | MarkFacetReplaceClass {
        // If already an extended facet class, return as-is
        if (instance instanceof MarkFacetPlainClass || instance instanceof MarkFacetRemoveClass || instance instanceof MarkFacetReplaceClass) {
            return instance;
        }
        // Use the custom factory to dispatch to the correct extended class based on instance type
        const data = instance.toJSON();
        return createMarkFacetPayload(data);
    }
    
    // FacetPayloadBase methods
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): MarkFacetPayloadType {
        // For Replace, extract from the payload (not match)
        const payload = (this as any).payload;
        if (payload && payload.data) {
            return payload.data;
        }
        // Fallback: parse from schema using the same logic as PlainClass
        if (node.length === 0) {
            throw new Error('Invalid schema: empty node');
        }
        const firstElement = node[0];
        let markNode: GenericTreeNode<SchemaTag> | undefined;
        if (treeNodeTypeguard(isSchemaMark)(firstElement)) {
            markNode = firstElement;
        } else {
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
        const matchTag = markNode.children.find(treeNodeTypeguard(isSchemaMatch));
        if (!matchTag || !treeNodeTypeguard(isSchemaMatch)(matchTag)) {
            throw new Error('Invalid schema: Match child not found in Mark');
        }
        const narrative = matchTag.children
            .map(({ data }) => data)
            .filter(isSchemaString)
            .map(({ value }) => value)
            .join('');
        return narrative;
    }

    renderFacet(reference: StandardReference, payload: MarkFacetPayloadType, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Use schema getter which already returns Replace-wrapped structure
        const replaceSchema = this.schema[0];

        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        let markNode: GenericTreeNode<SchemaTag>;

        if (referenceRender) {
            if (!treeNodeTypeguard(isSchemaMark)(referenceRender)) {
                throw new Error('Invalid referenceRender: expected Mark tag');
            }
            markNode = {
                ...referenceRender,
                children: [
                    replaceSchema,
                    ...referenceRender.children
                ]
            };
        } else {
            const markSchema = reference.schema;
            if (markSchema.length === 0) {
                throw new Error('Invalid reference schema: empty');
            }
            const firstNode = markSchema[0];
            
            if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
                if (!firstNode.children || firstNode.children.length === 0) {
                    throw new Error('Invalid Remove-wrapped reference schema: Remove node has no children');
                }
                const innerMark = firstNode.children[0];
                if (!innerMark || !treeNodeTypeguard(isSchemaMark)(innerMark)) {
                    throw new Error('Invalid Remove-wrapped reference schema: expected Mark tag inside Remove');
                }
                const enhancedMark: GenericTreeNode<SchemaTag> = {
                    data: { ...innerMark.data },
                    children: [
                        replaceSchema,
                        ...innerMark.children
                    ]
                };
                if (!treeNodeTypeguard(isSchemaMark)(enhancedMark)) {
                    throw new Error('Failed to create valid Mark node in Remove wrapper');
                }
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
            markNode = {
                ...firstNode,
                children: [
                    replaceSchema,
                    ...firstNode.children
                ]
            };
        }

        return { aggregatedNode: markNode };
    }
}

// Custom factory function that replicates EditableClass.create() logic but returns extended classes
function createMarkFacetPayload(arg: any): MarkFacetPlainClass | MarkFacetRemoveClass | MarkFacetReplaceClass {
    // Handle RenderTree conversion
    const convertedArg = isRenderTree(arg) ? renderTreeToSchema(arg) : arg;
    
    // Handle string by parsing to schema tree first
    const factoryProps: any = typeof convertedArg === 'string' ? treeFromWML(convertedArg) : convertedArg;
    
    // Handle Remove/Replace objects BEFORE checking isStandardLiteralData
    // (because isStandardLiteralData may incorrectly return true for Remove/Replace objects)
    if (typeof factoryProps === 'object' && factoryProps !== null && 'tag' in factoryProps) {
        if (factoryProps.tag === 'Remove' && 'match' in factoryProps && isStandardLiteralData(factoryProps.match)) {
            return new MarkFacetRemoveClass(factoryProps);
        }
        if (factoryProps.tag === 'Replace' && 'match' in factoryProps && 'payload' in factoryProps 
            && isStandardLiteralData(factoryProps.match) && isStandardLiteralData(factoryProps.payload)) {
            return new MarkFacetReplaceClass(factoryProps);
        }
    }
    
    // Handle schema tree parsing for Remove/Replace tags
    if (Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) {
        const schema = factoryProps;
        if (schema.length === 0) {
            return new MarkFacetPlainClass(schema);
        }
        
        const firstElement = schema[0];
        
        // Check if first element is Remove or Replace directly
        if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
            return new MarkFacetRemoveClass(schema);
        }
        else if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
            return new MarkFacetReplaceClass(schema);
        }
        // Check if first element is a Mark node - extract payload children (the Mark's children contain the payload)
        else if (treeNodeTypeguard(isSchemaMark)(firstElement)) {
            // The payload is in the Mark's children - pass those children to createPayload recursively
            // This handles Replace/Remove/Match structures nested inside the Mark
            return createMarkFacetPayload(firstElement.children);
        }
        // Check if first element is a Match tag - use StandardLiteral to strip wrapper
        else if (treeNodeTypeguard(isSchemaMatch)(firstElement)) {
            // Use StandardLiteral with tag option to strip Match wrapper tag
            const literal = new StandardLiteral(schema, { tag: 'Match' });
            // Create PlainClass from the extracted string
            return new MarkFacetPlainClass(literal.toJSON());
        }
        else {
            return new MarkFacetPlainClass(schema);
        }
    }
    
    // Check if it's a StandardEditableData of the appropriate type (plain data)
    if (isStandardLiteralData(factoryProps)) {
        return new MarkFacetPlainClass(factoryProps);
    }
    
    // Default to plain
    return new MarkFacetPlainClass(factoryProps);
}

export class StandardMarkFacet extends facetClassFactory(
    {
        EditableClass: EditableClass,
        PlainClass: MarkFacetPlainClass,
        RemoveClass: MarkFacetRemoveClass,
        ReplaceClass: MarkFacetReplaceClass
    },
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
export class MarkFacetList extends facetListClassFactory(StandardMarkFacet, 'MarkFacetList') {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new MarkFacetList(instance as MarkFacetList) as this;
    }
}
