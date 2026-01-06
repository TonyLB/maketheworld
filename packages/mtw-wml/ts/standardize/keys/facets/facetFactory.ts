//
// The facetClassFactory function accepts a payload class that implements
// the FacetConstructorMethods interface, and returns a class suitable for
// use as a StandardFacet, with reference and payload subsections.
//
// The payload class is assumed to accept constructor arguments (unlike component payloads),
// and will be instantiated with payload data directly.
//
// NOTE: For easy access, the returned class should then be extended with getter
// functions to pull data out of the private payload if needed.

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag } from "../../components/dataTypes/abstract";
import { StandardFacetData, StandardFacetPayload, isStandardFacetData } from "./dataTypes/facet";
import { StandardEditablePayload } from "../../../generics/editable";
import { ReferenceFormat } from "../../components/utils/references";
import { StandardReference, LookupMappings } from "../reference";
import { StandardKey } from "../key";
import { treeFromWML, isSchemaTreeNode } from "../../../schema";

/**
 * FacetConstructorMethods: Interface for payload classes used by facetClassFactory
 * 
 * Documents the methods that payload classes must implement to be used with facetClassFactory.
 * Payload classes must implement both FacetPayloadBase and StandardEditablePayload interfaces.
 */
export interface FacetConstructorMethods<D extends StandardFacetPayload> {
    /**
     * Parse payload data from WML schema tree (from FacetPayloadBase)
     */
    fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): D;

    /**
     * Render facet for parent component orchestration (from FacetPayloadBase)
     */
    renderFacet(reference: StandardReference, payload: D, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> };

    /**
     * Clone the payload instance (from StandardEditablePayload)
     */
    clone(): StandardEditablePayload<D>;

    /**
     * Convert payload to JSON format (from StandardEditablePayload)
     */
    toJSON(): D;

    /**
     * Get schema for payload (from StandardEditablePayload)
     */
    get schema(): GenericTree<SchemaTag>;
}

export const facetClassFactory = <
    D extends StandardFacetPayload,
    TBase extends new (...args: any[]) => FacetConstructorMethods<D>
>(Base: TBase, label: string, referenceFactory?: (schema: GenericTree<SchemaTag>) => StandardReference) => {
    return class GeneratedFacetClass {
        _reference: StandardReference;
        _payload: InstanceType<typeof Base>;
        _matchPayload: InstanceType<typeof Base> | undefined;
        _isReplace: boolean;

        constructor(
            arg: StandardFacetData<D> | GeneratedFacetClass | { tag: 'Replace'; match: StandardFacetData<D>; payload: StandardFacetData<D> } | GenericTree<SchemaTag> | string
        ) {
            // Handle GeneratedFacetClass instance (cloning)
            if (arg instanceof GeneratedFacetClass) {
                this._reference = arg._reference.clone();
                this._payload = arg._payload.clone() as InstanceType<typeof Base>;
                this._matchPayload = arg._matchPayload ? arg._matchPayload.clone() as InstanceType<typeof Base> : undefined;
                this._isReplace = arg._isReplace;
                return;
            }

            // Handle Replace JSON structure: { tag: 'Replace', match: StandardFacetData, payload: StandardFacetData }
            if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace' && 'match' in arg && 'payload' in arg) {
                const replaceData = arg as { tag: 'Replace'; match: StandardFacetData<D>; payload: StandardFacetData<D> };
                this._reference = new StandardReference(replaceData.payload.reference);
                this._payload = new Base(replaceData.payload.payload) as InstanceType<typeof Base>;
                this._matchPayload = new Base(replaceData.match.payload) as InstanceType<typeof Base>;
                this._isReplace = true;
                return;
            }

            // Handle StandardFacetData (JSON format)
            if (isStandardFacetData(arg)) {
                this._reference = new StandardReference(arg.reference);
                this._payload = new Base(arg.payload) as InstanceType<typeof Base>;
                this._matchPayload = undefined;
                this._isReplace = false;
                return;
            }

            // Handle WML string (needs parsing)
            if (typeof arg === 'string' && (arg.includes('<') || arg.includes('['))) {
                const schema = treeFromWML(arg);
                if (schema.length === 0) {
                    throw new Error(`Invalid WML string in ${label} constructor: empty schema`);
                }
                // Continue with schema tree handling below
                arg = schema;
            }

            // Handle GenericTree<SchemaTag>
            if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
                const schema = arg as GenericTree<SchemaTag>;
                const firstElement = schema[0];

                // Handle Replace-wrapped schemas
                if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    const replaceMatch = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch));
                    const replacePayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload));
                    
                    if (!replaceMatch || !replacePayload) {
                        throw new Error(`Replace must have both a ReplaceMatch and a ReplacePayload in ${label} constructor`);
                    }

                    // Extract reference from ReplacePayload schema
                    // Use referenceFactory if provided, else default to StandardReference(replacePayload.children[0])
                    const reference = referenceFactory 
                        ? referenceFactory(replacePayload.children)
                        : new StandardReference(replacePayload.children);

                    // Parse match payload
                    const payloadInstance = new Base();
                    const matchData = payloadInstance.fromSchema(replaceMatch.children, reference);

                    // Parse payload
                    const payloadData = payloadInstance.fromSchema(replacePayload.children, reference);

                    // Construct facet with Replace structure
                    this._reference = reference;
                    this._payload = new Base(payloadData) as InstanceType<typeof Base>;
                    this._matchPayload = new Base(matchData) as InstanceType<typeof Base>;
                    this._isReplace = true;
                    return;
                }

                // Handle plain schemas (no Replace wrapper)
                // Extract reference
                const reference = referenceFactory 
                    ? referenceFactory(schema)
                    : new StandardReference(schema);

                // Parse payload
                const payloadInstance = new Base();
                const payloadData = payloadInstance.fromSchema(schema, reference);

                // Construct facet normally
                this._reference = reference;
                this._payload = new Base(payloadData) as InstanceType<typeof Base>;
                this._matchPayload = undefined;
                this._isReplace = false;
                return;
            }

            throw new Error(`Invalid argument to ${label} constructor: expected StandardFacetData, Replace structure, GeneratedFacetClass instance, WML string, or GenericTree<SchemaTag>, got ${JSON.stringify(arg)}`);
        }

        _wrap(instance: GeneratedFacetClass): this {
            return instance as this;
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

        // Payload accessors
        // Return the concrete class instance type so methods like toJSON() are available
        get payload(): InstanceType<typeof Base> {
            return this._payload;
        }

        get matchPayload(): InstanceType<typeof Base> | undefined {
            return this._matchPayload;
        }

        get isReplace(): boolean {
            return this._isReplace;
        }

        // Core methods
        clone(): GeneratedFacetClass {
            return this._wrap(new GeneratedFacetClass(this));
        }

        toJSON(): StandardFacetData<D> | { tag: 'Replace'; match: StandardFacetData<D>; payload: StandardFacetData<D> } {
            if (this._isReplace && this._matchPayload !== undefined) {
                return {
                    tag: 'Replace' as const,
                    match: {
                        reference: this._reference.toJSON(),
                        payload: this._matchPayload.toJSON()
                    },
                    payload: {
                        reference: this._reference.toJSON(),
                        payload: this._payload.toJSON()
                    }
                };
            }
            return {
                reference: this._reference.toJSON(),
                payload: this._payload.toJSON()
            };
        }

        equals(other: GeneratedFacetClass): boolean {
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
                if (JSON.stringify(this._matchPayload?.toJSON()) !== JSON.stringify(other._matchPayload?.toJSON())) {
                    return false;
                }
            }
            return JSON.stringify(this._payload.toJSON()) === JSON.stringify(other._payload.toJSON());
        }

        sameKey(other: GeneratedFacetClass): boolean {
            return this._reference.sameKey(other._reference);
        }

        // Merge/diff operations
        merge(incoming: GeneratedFacetClass): GeneratedFacetClass | undefined {
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot change which component a facet points to');
            }

            // Merge the reference (ref arithmetic)
            const mergedReference = this._reference.merge(incoming._reference);
            if (mergedReference === undefined) {
                // Reference merge cancelled out - check if payloads differ
                // If payloads are the same, complete cancellation
                if (JSON.stringify(this._payload.toJSON()) === JSON.stringify(incoming._payload.toJSON())) {
                    return undefined;
                }
                // If payloads differ, we still have a Replace operation
                const result = new GeneratedFacetClass({
                    reference: this._reference.toJSON(),
                    payload: incoming._payload.toJSON()
                });
                (result as any)._matchPayload = this._payload.clone() as InstanceType<typeof Base>;
                (result as any)._isReplace = true;
                return this._wrap(result);
            }

            // Check if payloads differ
            const payloadsDiffer = JSON.stringify(this._payload.toJSON()) !== JSON.stringify(incoming._payload.toJSON());

            if (payloadsDiffer) {
                // Create Replace operation
                const result = new GeneratedFacetClass({
                    reference: mergedReference.toJSON(),
                    payload: incoming._payload.toJSON()
                });
                (result as any)._matchPayload = this._payload.clone() as InstanceType<typeof Base>;
                (result as any)._isReplace = true;
                return this._wrap(result);
            }

            // Payloads are the same, just merge reference
            const result = new GeneratedFacetClass({
                reference: mergedReference.toJSON(),
                payload: this._payload.toJSON()
            });
            return this._wrap(result);
        }

        diff(incoming: GeneratedFacetClass | undefined): GeneratedFacetClass | undefined {
            if (incoming) {
                if (!this.sameKey(incoming)) {
                    throw new Error('Cannot change which component a facet points to');
                }

                // Diff the reference
                const diffReference = this._reference.diff(incoming._reference);
                const payloadsDiffer = JSON.stringify(this._payload.toJSON()) !== JSON.stringify(incoming._payload.toJSON());

                // If both reference and payload are the same, no change
                if (diffReference === undefined && !payloadsDiffer) {
                    return undefined;
                }

                // If payloads differ, create Replace operation
                if (payloadsDiffer) {
                    const referenceData = diffReference ? diffReference.toJSON() : this._reference.toJSON();
                    const result = new GeneratedFacetClass({
                        reference: referenceData,
                        payload: incoming._payload.toJSON()
                    });
                    (result as any)._matchPayload = this._payload.clone() as InstanceType<typeof Base>;
                    (result as any)._isReplace = true;
                    return this._wrap(result);
                }

                // Only reference changed, return reference diff only
                if (diffReference) {
                    const result = new GeneratedFacetClass({
                        reference: diffReference.toJSON(),
                        payload: this._payload.toJSON()
                    });
                    return this._wrap(result);
                }

                return undefined;
            } else {
                // Diff from this facet to nothing: invert
                const invertedReference = this._reference.invert();
                const result = new GeneratedFacetClass({
                    reference: invertedReference.toJSON(),
                    payload: this._payload.toJSON()
                });
                // If this was a Replace, the inverted version should also be a Replace
                if (this._isReplace && this._matchPayload !== undefined) {
                    (result as any)._matchPayload = this._matchPayload.clone() as InstanceType<typeof Base>;
                    (result as any)._isReplace = true;
                }
                return this._wrap(result);
            }
        }

        invert(): GeneratedFacetClass {
            // Invert the reference (ref arithmetic)
            const invertedReference = this._reference.invert();
            const result = new GeneratedFacetClass({
                reference: invertedReference.toJSON(),
                payload: this._payload.toJSON()
            });
            // If this was a Replace, the inverted version should also be a Replace
            if (this._isReplace && this._matchPayload !== undefined) {
                (result as any)._matchPayload = this._matchPayload.clone() as InstanceType<typeof Base>;
                (result as any)._isReplace = true;
            }
            return this._wrap(result);
        }

        // Facet rendering for parent component orchestration
        renderFacet(referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
            // Handle Replace operations
            if (this._isReplace && this._matchPayload !== undefined) {
                // Call payload's renderFacet directly to avoid recursion
                const matchResult = this._matchPayload.renderFacet(this._reference, this._matchPayload.toJSON(), referenceRender);
                const payloadResult = this._payload.renderFacet(this._reference, this._payload.toJSON(), referenceRender);
                
                // For Replace operations, wrap results in Replace structure
                const replaceMatch: GenericTreeNode<SchemaTag> = {
                    data: { tag: 'ReplaceMatch' as const },
                    children: matchResult.newNode ? [matchResult.newNode] : matchResult.aggregatedNode ? [matchResult.aggregatedNode] : []
                };
                const replacePayload: GenericTreeNode<SchemaTag> = {
                    data: { tag: 'ReplacePayload' as const },
                    children: payloadResult.newNode ? [payloadResult.newNode] : payloadResult.aggregatedNode ? [payloadResult.aggregatedNode] : []
                };
                
                return {
                    aggregatedNode: {
                        data: { tag: 'Replace' as const },
                        children: [replaceMatch, replacePayload]
                    }
                };
            }
            
            // For non-Replace operations, delegate to payload class
            return this._payload.renderFacet(this._reference, this._payload.toJSON(), referenceRender);
        }

        // Format conversion
        toFormat(format: ReferenceFormat, mappings?: LookupMappings): GeneratedFacetClass {
            const formattedReference = this._reference.toFormat(format, mappings);
            const result = new GeneratedFacetClass({
                reference: formattedReference.toJSON(),
                payload: this._payload.toJSON()
            });
            if (this._isReplace && this._matchPayload !== undefined) {
                (result as any)._matchPayload = this._matchPayload.clone() as InstanceType<typeof Base>;
                (result as any)._isReplace = true;
            }
            return this._wrap(result);
        }

        lookup(mappings: LookupMappings): GeneratedFacetClass {
            const lookedUpReference = this._reference.lookup(mappings);
            const result = new GeneratedFacetClass({
                reference: lookedUpReference.toJSON(),
                payload: this._payload.toJSON()
            });
            if (this._isReplace && this._matchPayload !== undefined) {
                (result as any)._matchPayload = this._matchPayload.clone() as InstanceType<typeof Base>;
                (result as any)._isReplace = true;
            }
            return this._wrap(result);
        }
    };
};

