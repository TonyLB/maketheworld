import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag } from "../components/dataTypes/abstract";
import { StandardFacetData, StandardFacetPayload, isStandardFacetData, isStandardFacetPayload } from "./dataTypes/facet";
import { FacetPayloadBase } from "./dataTypes/facetPayloadBase";
import { ReferenceFormat } from "../components/utils/references";
import { treeFromWML } from "../../schema";
import { StandardReference, LookupMappings } from "./reference";
import { StandardKey } from "./key";

// Helper function to safely call FacetPayloadBase.schema() method
// Handles both class instances (with methods) and plain objects (fallback to reference)
function callFacetPayloadBaseSchema<TPayload extends StandardFacetPayload>(
    payload: TPayload,
    reference: StandardReference,
    payloadData: TPayload
): GenericTree<SchemaTag> {
    // Try to call _facetSchema method directly (PositionPayload uses this to avoid conflict with getter)
    if (typeof (payload as any)._facetSchema === 'function') {
        return (payload as any)._facetSchema(reference, payloadData);
    }
    // Also try via FacetPayloadBase interface (for other implementations)
    try {
        const payloadBase = payload as unknown as FacetPayloadBase<TPayload>;
        if (typeof payloadBase.schema === 'function') {
            return payloadBase.schema(reference, payloadData);
        }
    } catch (e) {
        // If payload doesn't implement FacetPayloadBase (e.g., plain object), fall through to fallback
    }
    // Fallback: if payload is a plain object or doesn't implement FacetPayloadBase, 
    // just return reference schema (legacy behavior)
    return reference.schema;
}

/**
 * StandardFacet: A first-class relational object that references a target component
 * and carries typed payload data. Composes a StandardReference for target reference
 * and supports both ref-based Add/Remove operations and payload Replace operations.
 * 
 * @template TPayload - The specific payload type (extends StandardFacetPayload)
 */
export class StandardFacet<TPayload extends StandardFacetPayload = StandardFacetPayload> {
    private _reference: StandardReference;
    private _payload: TPayload;
    private _matchPayload: TPayload | undefined; // For Replace operations
    private _isReplace: boolean; // Track if this is a Replace operation

    constructor(
        arg: StandardFacetData<TPayload> | StandardFacet<TPayload> | GenericTree<SchemaTag> | string | { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> },
        explicitTag?: ComponentTag
    ) {
        // Handle StandardFacet instance directly (for cloning)
        if (arg instanceof StandardFacet) {
            this._reference = arg._reference.clone();
            this._payload = arg._payload;
            this._matchPayload = arg._matchPayload ? { ...arg._matchPayload } as TPayload : undefined;
            this._isReplace = arg._isReplace;
            return;
        }

        // Handle Replace JSON structure: { tag: 'Replace', match: StandardFacetData, payload: StandardFacetData }
        if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
            const replaceData = arg as { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> };
            this._reference = new StandardReference(replaceData.payload.reference);
            this._payload = replaceData.payload.payload;
            this._matchPayload = replaceData.match.payload;
            this._isReplace = true;
            return;
        }

        // Handle WML string (needs parsing) - only support Replace format for now
        if (typeof arg === 'string') {
            if (arg.includes('<') || arg.includes('[')) {
                const schema = treeFromWML(arg);
                if (schema.length === 0) {
                    throw new Error('Invalid WML string in StandardFacet constructor: empty schema');
                }
                const firstElement = schema[0];

                // Check for Replace tag
                if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    const replaceMatch = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch));
                    const replacePayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload));
                    if (!replaceMatch || !replacePayload) {
                        throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload');
                    }
                    // For Replace in WML, we need StandardFacetData format in the children
                    // This is complex - for now, require StandardFacetData format
                    throw new Error('WML Replace format for facets requires StandardFacetData - parse to StandardFacetData first');
                }

                // WML string format not fully supported - require StandardFacetData
                throw new Error('WML string construction for facets requires StandardFacetData format - parse to StandardFacetData first');
            }
        }

        // Handle GenericTree<SchemaTag> - only support Replace format for now
        if (Array.isArray(arg) && arg.length > 0) {
            const firstElement = arg[0];

            // Check for Replace tag
            if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                const replaceMatch = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch));
                const replacePayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload));
                if (!replaceMatch || !replacePayload) {
                    throw new Error('Replace must have both a ReplaceMatch and a ReplacePayload');
                }
                // For Replace in schema trees, the children should contain StandardFacetData
                // This is complex without knowing payload structure - require StandardFacetData format
                throw new Error('GenericTree Replace format for facets requires StandardFacetData - use StandardFacetData constructor instead');
            }

            // Plain schema trees require StandardFacetData format
            // Facets need both reference and payload, which is hard to parse generically from schema
            throw new Error('GenericTree<SchemaTag> construction for facets requires StandardFacetData format - facets need both reference and payload');
        }

        // Handle StandardFacetData (JSON format)
        if (isStandardFacetData(arg)) {
            this._reference = new StandardReference(arg.reference);
            this._payload = arg.payload as TPayload;
            this._matchPayload = undefined;
            this._isReplace = false;
            return;
        }

        throw new Error(`Invalid argument to StandardFacet constructor: ${JSON.stringify(arg)}`);
    }

    // Reference accessors (following StandardReference.standardKey pattern)
    get reference(): StandardReference {
        return this._reference;
    }

    get standardKey(): StandardKey {
        return this._reference.standardKey;
    }

    get ref(): number {
        return this._reference.ref;
    }

    get tag(): ComponentTag {
        return this._reference.tag;
    }

    get key(): string | undefined {
        return this._reference.key;
    }

    get universalKey(): ComponentUUID | undefined {
        return this._reference.universalKey;
    }

    // Payload access
    get payload(): TPayload {
        return this._payload;
    }

    // Check if this is a Replace operation
    get isReplace(): boolean {
        return this._isReplace;
    }

    // Get match payload for Replace operations
    get matchPayload(): TPayload | undefined {
        return this._matchPayload;
    }

    // Core methods
    clone(): StandardFacet<TPayload> {
        return new StandardFacet(this);
    }

    toJSON(): StandardFacetData<TPayload> | { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> } {
        if (this._isReplace && this._matchPayload !== undefined) {
            return {
                tag: 'Replace' as const,
                match: {
                    reference: this._reference.toJSON(),
                    payload: this._matchPayload
                },
                payload: {
                    reference: this._reference.toJSON(),
                    payload: this._payload
                }
            };
        }
        return {
            reference: this._reference.toJSON(),
            payload: this._payload
        };
    }

    equals(other: StandardFacet<TPayload>): boolean {
        if (!this.sameKey(other)) {
            return false;
        }
        if (this._reference.ref !== other._reference.ref) {
            return false;
        }
        if (this._isReplace !== other._isReplace) {
            return false;
        }
        if (this._isReplace) {
            // For Replace operations, compare both match and payload
            if (!this.payloadsEqual(this._matchPayload, other._matchPayload)) {
                return false;
            }
        }
        return this.payloadsEqual(this._payload, other._payload);
    }

    sameKey(other: StandardFacet<TPayload>): boolean {
        return this._reference.sameKey(other._reference);
    }

    // Helper method to compare payloads for equality
    private payloadsEqual(a: TPayload | undefined, b: TPayload | undefined): boolean {
        if (a === undefined && b === undefined) {
            return true;
        }
        if (a === undefined || b === undefined) {
            return false;
        }
        // Deep equality comparison using JSON.stringify
        // This works for plain objects with primitive values
        return JSON.stringify(a) === JSON.stringify(b);
    }

    // Merge/diff operations
    merge(incoming: StandardFacet<TPayload>): StandardFacet<TPayload> | undefined {
        if (!this.sameKey(incoming)) {
            throw new Error('Cannot change which component a facet points to');
        }

        // Merge the reference (ref arithmetic)
        const mergedReference = this._reference.merge(incoming._reference);
        if (mergedReference === undefined) {
            // Reference merge cancelled out - check if payloads differ
            // If payloads are the same, complete cancellation
            if (this.payloadsEqual(this._payload, incoming._payload)) {
                return undefined;
            }
            // If payloads differ, we still have a Replace operation
            // Create a new facet with the incoming payload and match as this payload
            const result = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: incoming._payload
            });
            (result as any)._matchPayload = this._payload;
            (result as any)._isReplace = true;
            return result;
        }

        // Check if payloads differ
        const payloadsDiffer = !this.payloadsEqual(this._payload, incoming._payload);

        if (payloadsDiffer) {
            // Create Replace operation
            const result = new StandardFacet<TPayload>({
                reference: mergedReference.toJSON(),
                payload: incoming._payload
            });
            (result as any)._matchPayload = this._payload;
            (result as any)._isReplace = true;
            return result;
        }

        // Payloads are the same, just merge reference
        const result = new StandardFacet<TPayload>({
            reference: mergedReference.toJSON(),
            payload: this._payload
        });
        return result;
    }

    diff(incoming: StandardFacet<TPayload> | undefined): StandardFacet<TPayload> | undefined {
        if (incoming) {
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot change which component a facet points to');
            }

            // Diff the reference
            const diffReference = this._reference.diff(incoming._reference);
            const payloadsDiffer = !this.payloadsEqual(this._payload, incoming._payload);

            // If both reference and payload are the same, no change
            if (diffReference === undefined && !payloadsDiffer) {
                return undefined;
            }

            // If payloads differ, create Replace operation
            if (payloadsDiffer) {
                const referenceData = diffReference ? diffReference.toJSON() : this._reference.toJSON();
                const result = new StandardFacet<TPayload>({
                    reference: referenceData,
                    payload: incoming._payload
                });
                (result as any)._matchPayload = this._payload;
                (result as any)._isReplace = true;
                return result;
            }

            // Only reference changed, return reference diff only
            if (diffReference) {
                return new StandardFacet<TPayload>({
                    reference: diffReference.toJSON(),
                    payload: this._payload
                });
            }

            return undefined;
        } else {
            // Diff from this facet to nothing: invert
            const invertedReference = this._reference.invert();
            const result = new StandardFacet<TPayload>({
                reference: invertedReference.toJSON(),
                payload: this._payload
            });
            // If this was a Replace, the inverted version should also be a Replace
            if (this._isReplace && this._matchPayload !== undefined) {
                (result as any)._matchPayload = this._matchPayload;
                (result as any)._isReplace = true;
            }
            return result;
        }
    }

    invert(): StandardFacet<TPayload> {
        // Invert the reference (ref arithmetic)
        const invertedReference = this._reference.invert();
        const result = new StandardFacet<TPayload>({
            reference: invertedReference.toJSON(),
            payload: this._payload
        });
        // If this was a Replace, the inverted version should also be a Replace
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._matchPayload;
            (result as any)._isReplace = true;
        }
        return result;
    }

    // Schema generation
    get schema(): GenericTree<SchemaTag> {
        // If this is a Replace operation, generate Replace schema
        if (this._isReplace && this._matchPayload !== undefined) {
            const matchFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._matchPayload
            });
            const payloadFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._payload
            });
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: matchFacet._getPlainSchema() },
                    { data: { tag: 'ReplacePayload' as const }, children: payloadFacet._getPlainSchema() }
                ]
            }];
        }

        // For plain facets or Remove facets, use reference schema
        // The reference schema already handles Remove (negative ref)
        // Payload is stored separately in component data, not in WML schema
        return this._reference.schema;
    }

    private _getPlainSchema(): GenericTree<SchemaTag> {
        // Generate schema with reference as the main structure
        // Payload is stored in component data structure, not directly in WML schema
        // The reference schema represents the target component
        return this._reference.schema;
    }

    nestedSchema(tag: SchemaTag, componentSchema?: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        if (this._isReplace && this._matchPayload !== undefined) {
            const matchFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._matchPayload
            });
            const payloadFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._payload
            });
            const matchSchema = matchFacet._getNestedSchema(tag, componentSchema);
            const payloadSchema = payloadFacet._getNestedSchema(tag, componentSchema);
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    {
                        data: { tag: 'ReplaceMatch' as const },
                        children: matchSchema
                    },
                    {
                        data: { tag: 'ReplacePayload' as const },
                        children: payloadSchema
                    }
                ]
            }];
        }
        return this._getNestedSchema(tag, componentSchema);
    }

    private _getNestedSchema(tag: SchemaTag, componentSchema?: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        // Use FacetPayloadBase.nestedSchema() if componentSchema is provided
        if (componentSchema) {
            try {
                const payloadBase = this._payload as unknown as FacetPayloadBase<TPayload>;
                if (typeof payloadBase.nestedSchema === 'function') {
                    const mergedSchema = payloadBase.nestedSchema(this._reference, this._payload, componentSchema);
                    return [{ data: tag, children: [mergedSchema] }];
                }
            } catch (e) {
                // If payload doesn't implement FacetPayloadBase, fall through to fallback
            }
        }
        // Fallback: wrap plain schema in tag
        return [{ data: tag, children: this._getPlainSchema() }];
    }

    // Format conversion
    toFormat(format: ReferenceFormat, mappings?: LookupMappings): StandardFacet<TPayload> {
        const formattedReference = this._reference.toFormat(format, mappings);
        const result = new StandardFacet<TPayload>({
            reference: formattedReference.toJSON(),
            payload: this._payload
        });
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._matchPayload;
            (result as any)._isReplace = true;
        }
        return result;
    }

    lookup(mappings: LookupMappings): StandardFacet<TPayload> {
        const lookedUpReference = this._reference.lookup(mappings);
        const result = new StandardFacet<TPayload>({
            reference: lookedUpReference.toJSON(),
            payload: this._payload
        });
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._matchPayload;
            (result as any)._isReplace = true;
        }
        return result;
    }
}
