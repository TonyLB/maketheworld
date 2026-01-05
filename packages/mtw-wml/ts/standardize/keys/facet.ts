import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag } from "../components/dataTypes/abstract";
import { StandardFacetData, StandardFacetPayload, isStandardFacetData, isStandardFacetPayload, PositionPayload, MarkFacetPayload, ExitPayload, isPositionPayload, isMarkFacetPayload, isExitPayload } from "./dataTypes/facet";
import { FacetPayloadBase } from "./dataTypes/facetPayloadBase";
import { StandardEditablePayload } from "../../generics/editable";
import { ReferenceFormat } from "../components/utils/references";
import { treeFromWML } from "../../schema";
import { StandardReference, LookupMappings } from "./reference";
import { StandardKey } from "./key";
import { PositionPayload as PositionPayloadClass } from "./dataTypes/positionPayload";
import { MarkFacetPayload as MarkFacetPayloadClass } from "./dataTypes/markFacetPayload";
import { ExitPayload as ExitPayloadClass } from "./dataTypes/exitPayload";

/**
 * StandardFacet: A first-class relational object that references a target component
 * and carries typed payload data. Composes a StandardReference for target reference
 * and supports both ref-based Add/Remove operations and payload Replace operations.
 * 
 * @template TPayload - The specific payload type (extends StandardFacetPayload)
 */
export class StandardFacet<TPayload extends StandardFacetPayload = StandardFacetPayload> {
    private _reference: StandardReference;
    private _payload: FacetPayloadBase<TPayload>; // Store payload class instance instead of plain JSON
    private _matchPayload: FacetPayloadBase<TPayload> | undefined; // For Replace operations - store class instance
    private _isReplace: boolean; // Track if this is a Replace operation

    constructor(
        arg: StandardFacetData<TPayload> | StandardFacet<TPayload> | GenericTree<SchemaTag> | string | { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> },
        explicitTag?: ComponentTag
    ) {
        // Handle StandardFacet instance directly (for cloning)
        if (arg instanceof StandardFacet) {
            this._reference = arg._reference.clone();
            // Payload is already a class instance, clone it (cast to StandardEditablePayload for clone method)
            this._payload = this._asEditablePayload(arg._payload).clone() as FacetPayloadBase<TPayload>;
            this._matchPayload = arg._matchPayload ? this._asEditablePayload(arg._matchPayload).clone() as FacetPayloadBase<TPayload> : undefined;
            this._isReplace = arg._isReplace;
            return;
        }

        // Handle Replace JSON structure: { tag: 'Replace', match: StandardFacetData, payload: StandardFacetData }
        if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
            const replaceData = arg as { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> };
            this._reference = new StandardReference(replaceData.payload.reference);
            // Instantiate payload classes from JSON data
            this._payload = this._instantiatePayloadClass(replaceData.payload.payload);
            this._matchPayload = this._instantiatePayloadClass(replaceData.match.payload);
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
            // Instantiate payload class from JSON data
            this._payload = this._instantiatePayloadClass(arg.payload);
            this._matchPayload = undefined;
            this._isReplace = false;
            return;
        }

        throw new Error(`Invalid argument to StandardFacet constructor: ${JSON.stringify(arg)}`);
    }

    /**
     * Helper method to instantiate payload class from JSON data based on type discriminator
     * @private
     */
    private _instantiatePayloadClass(payloadData: TPayload): FacetPayloadBase<TPayload> {
        if (isPositionPayload(payloadData)) {
            return new PositionPayloadClass(payloadData) as FacetPayloadBase<TPayload>;
        } else if (isMarkFacetPayload(payloadData)) {
            return new MarkFacetPayloadClass(payloadData) as FacetPayloadBase<TPayload>;
        } else if (isExitPayload(payloadData)) {
            return new ExitPayloadClass(payloadData) as FacetPayloadBase<TPayload>;
        }
        throw new Error(`Unknown payload type: ${(payloadData as any).type || 'undefined'}`);
    }

    /**
     * Helper method to get StandardEditablePayload interface from FacetPayloadBase
     * Payload classes implement both interfaces, so we can safely cast
     * @private
     */
    private _asEditablePayload(payload: FacetPayloadBase<TPayload>): StandardEditablePayload<TPayload> {
        return payload as unknown as StandardEditablePayload<TPayload>;
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
    // Returns payload class instance (not JSON)
    // For API compatibility, type is TPayload but it's actually a class instance
    get payload(): TPayload {
        return this._payload as unknown as TPayload;
    }

    // Check if this is a Replace operation
    get isReplace(): boolean {
        return this._isReplace;
    }

    // Get match payload for Replace operations
    // Returns payload class instance (not JSON)
    // For API compatibility, type is TPayload but it's actually a class instance
    get matchPayload(): TPayload | undefined {
        return this._matchPayload as unknown as TPayload | undefined;
    }

    // Core methods
    clone(): StandardFacet<TPayload> {
        return new StandardFacet(this);
    }

    toJSON(): StandardFacetData<TPayload> | { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> } {
        // Convert payload class instances back to JSON (cast to StandardEditablePayload for toJSON method)
        if (this._isReplace && this._matchPayload !== undefined) {
            return {
                tag: 'Replace' as const,
                match: {
                    reference: this._reference.toJSON(),
                    payload: this._asEditablePayload(this._matchPayload).toJSON()
                },
                payload: {
                    reference: this._reference.toJSON(),
                    payload: this._asEditablePayload(this._payload).toJSON()
                }
            };
        }
        return {
            reference: this._reference.toJSON(),
            payload: this._asEditablePayload(this._payload).toJSON()
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
    // Now handles payload class instances by converting to JSON for comparison
    private payloadsEqual(a: FacetPayloadBase<TPayload> | undefined, b: FacetPayloadBase<TPayload> | undefined): boolean {
        if (a === undefined && b === undefined) {
            return true;
        }
        if (a === undefined || b === undefined) {
            return false;
        }
        // Convert class instances to JSON for comparison (cast to StandardEditablePayload for toJSON method)
        return JSON.stringify(this._asEditablePayload(a).toJSON()) === JSON.stringify(this._asEditablePayload(b).toJSON());
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
            // Convert payload class instances to JSON for constructor (cast to StandardEditablePayload for toJSON method)
            const result = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._asEditablePayload(incoming._payload).toJSON()
            });
            (result as any)._matchPayload = this._asEditablePayload(this._payload).clone() as FacetPayloadBase<TPayload>;
            (result as any)._isReplace = true;
            return result;
        }

        // Check if payloads differ
        const payloadsDiffer = !this.payloadsEqual(this._payload, incoming._payload);

        if (payloadsDiffer) {
            // Create Replace operation
            // Convert payload class instances to JSON for constructor (cast to StandardEditablePayload for toJSON method)
            const result = new StandardFacet<TPayload>({
                reference: mergedReference.toJSON(),
                payload: this._asEditablePayload(incoming._payload).toJSON()
            });
            (result as any)._matchPayload = this._asEditablePayload(this._payload).clone() as FacetPayloadBase<TPayload>;
            (result as any)._isReplace = true;
            return result;
        }

        // Payloads are the same, just merge reference
        // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
        const result = new StandardFacet<TPayload>({
            reference: mergedReference.toJSON(),
            payload: this._asEditablePayload(this._payload).toJSON()
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
            // Convert payload class instances to JSON for constructor (cast to StandardEditablePayload for toJSON method)
            if (payloadsDiffer) {
                const referenceData = diffReference ? diffReference.toJSON() : this._reference.toJSON();
                const result = new StandardFacet<TPayload>({
                    reference: referenceData,
                    payload: this._asEditablePayload(incoming._payload).toJSON()
                });
                (result as any)._matchPayload = this._asEditablePayload(this._payload).clone() as FacetPayloadBase<TPayload>;
                (result as any)._isReplace = true;
                return result;
            }

            // Only reference changed, return reference diff only
            // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
            if (diffReference) {
                return new StandardFacet<TPayload>({
                    reference: diffReference.toJSON(),
                    payload: this._asEditablePayload(this._payload).toJSON()
                });
            }

            return undefined;
        } else {
            // Diff from this facet to nothing: invert
            // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
            const invertedReference = this._reference.invert();
            const result = new StandardFacet<TPayload>({
                reference: invertedReference.toJSON(),
                payload: this._asEditablePayload(this._payload).toJSON()
            });
            // If this was a Replace, the inverted version should also be a Replace
            if (this._isReplace && this._matchPayload !== undefined) {
                (result as any)._matchPayload = this._asEditablePayload(this._matchPayload).clone() as FacetPayloadBase<TPayload>;
                (result as any)._isReplace = true;
            }
            return result;
        }
    }

    invert(): StandardFacet<TPayload> {
        // Invert the reference (ref arithmetic)
        // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
        const invertedReference = this._reference.invert();
        const result = new StandardFacet<TPayload>({
            reference: invertedReference.toJSON(),
            payload: this._asEditablePayload(this._payload).toJSON()
        });
        // If this was a Replace, the inverted version should also be a Replace
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._asEditablePayload(this._matchPayload).clone() as FacetPayloadBase<TPayload>;
            (result as any)._isReplace = true;
        }
        return result;
    }

    // Facet rendering for parent component orchestration
    renderFacet(referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Handle Replace operations
        // Convert payload class instances to JSON for constructor (cast to StandardEditablePayload for toJSON method)
        if (this._isReplace && this._matchPayload !== undefined) {
            const matchFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._asEditablePayload(this._matchPayload).toJSON()
            });
            const payloadFacet = new StandardFacet<TPayload>({
                reference: this._reference.toJSON(),
                payload: this._asEditablePayload(this._payload).toJSON()
            });
            const matchResult = matchFacet._renderFacetPlain(referenceRender);
            const payloadResult = payloadFacet._renderFacetPlain(referenceRender);
            
            // For Replace operations, wrap results in Replace structure
            // Handle both newNode and aggregatedNode cases
            const replaceMatch: GenericTreeNode<SchemaTag> = {
                data: { tag: 'ReplaceMatch' as const },
                children: matchResult.newNode ? [matchResult.newNode] : matchResult.aggregatedNode ? [matchResult.aggregatedNode] : []
            };
            const replacePayload: GenericTreeNode<SchemaTag> = {
                data: { tag: 'ReplacePayload' as const },
                children: payloadResult.newNode ? [payloadResult.newNode] : payloadResult.aggregatedNode ? [payloadResult.aggregatedNode] : []
            };
            
            // Return aggregated node with Replace wrapper
            // Note: For Replace operations, we return aggregatedNode containing Replace structure
            // This allows parent components to handle Replace at the facet level
            return {
                aggregatedNode: {
                    data: { tag: 'Replace' as const },
                    children: [replaceMatch, replacePayload]
                }
            };
        }
        
        // For non-Replace operations, delegate to payload class
        return this._renderFacetPlain(referenceRender);
    }

    private _renderFacetPlain(referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
        // Payload is now guaranteed to be a class instance with renderFacet() method
        // Convert payload class instance to JSON for renderFacet() call (cast to StandardEditablePayload for toJSON method)
        return this._payload.renderFacet(this._reference, this._asEditablePayload(this._payload).toJSON(), referenceRender);
    }

    // Format conversion
    toFormat(format: ReferenceFormat, mappings?: LookupMappings): StandardFacet<TPayload> {
        // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
        const formattedReference = this._reference.toFormat(format, mappings);
        const result = new StandardFacet<TPayload>({
            reference: formattedReference.toJSON(),
            payload: this._asEditablePayload(this._payload).toJSON()
        });
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._asEditablePayload(this._matchPayload).clone() as FacetPayloadBase<TPayload>;
            (result as any)._isReplace = true;
        }
        return result;
    }

    lookup(mappings: LookupMappings): StandardFacet<TPayload> {
        // Convert payload class instance to JSON for constructor (cast to StandardEditablePayload for toJSON method)
        const lookedUpReference = this._reference.lookup(mappings);
        const result = new StandardFacet<TPayload>({
            reference: lookedUpReference.toJSON(),
            payload: this._asEditablePayload(this._payload).toJSON()
        });
        if (this._isReplace && this._matchPayload !== undefined) {
            (result as any)._matchPayload = this._asEditablePayload(this._matchPayload).clone() as FacetPayloadBase<TPayload>;
            (result as any)._isReplace = true;
        }
        return result;
    }
}
