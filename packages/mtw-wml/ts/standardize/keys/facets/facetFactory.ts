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
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { ComponentTag } from "../../components/dataTypes/abstract";
import { StandardFacetData, isStandardFacetEnvelopeWithOptionalPayload } from "./dataTypes/facet";
import { ReferenceFormat } from "../../components/utils/references";
import { StandardReference, LookupMappings } from "../reference";
import { StandardKey } from "../key";
import { treeFromWML, isSchemaTreeNode } from "../../../schema";
import { StandardComponent } from "../../components/baseClasses";

export const facetClassFactory = <D, PayloadClass extends { renderFacet: (...args: any[]) => any, fromSchema: (...args: any[]) => any, clone: () => any, toJSON: () => any, merge: (other: any) => any, diff: (other: any) => any, invert: () => any }>(
    PayloadClass: new (...args: any[]) => PayloadClass,
    createPayload: (arg: any) => PayloadClass,
    label: string,
    referenceFactory?: (schema: GenericTree<SchemaTag>) => StandardReference,
    options?: {
        missingPayloadDefault?: () => any
    }
) => {
    return class GeneratedFacetClass {
        _reference: StandardReference;
        _payloadInstance: PayloadClass;

        constructor(
            arg: StandardFacetData<D> | GeneratedFacetClass | GenericTree<SchemaTag> | string
        ) {
            // Handle GeneratedFacetClass instance (cloning)
            if (arg instanceof GeneratedFacetClass) {
                this._reference = arg._reference.clone();
                this._payloadInstance = arg.payload.clone() as any;
                return;
            }

            // Handle StandardFacetData (JSON format)
            if (isStandardFacetEnvelopeWithOptionalPayload(arg)) {
                this._reference = new StandardReference(arg.reference);
                const payloadValue = Object.prototype.hasOwnProperty.call(arg, 'payload')
                    ? arg.payload
                    : options?.missingPayloadDefault?.();
                // Use createPayload to dispatch to correct extended class
                this._payloadInstance = createPayload(payloadValue);
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

                // Handle Remove-wrapped schemas at facet level
                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    // Extract the interior schema (children of Remove)
                    const interiorSchema = firstElement.children;
                    if (interiorSchema.length === 0) {
                        throw new Error(`Remove wrapper must have children in ${label} constructor`);
                    }
                    // Parse interior as a normal facet (recursive call to constructor)
                    const interiorFacet = new GeneratedFacetClass(interiorSchema);
                    // Invert the resulting facet (both reference and payload)
                    const invertedFacet = interiorFacet.invert();
                    this._reference = invertedFacet._reference;
                    this._payloadInstance = invertedFacet._payloadInstance;
                    return;
                }

                // Handle Replace-wrapped schemas at facet level
                if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    const replaceMatch = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch));
                    const replacePayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload));
                    
                    if (!replaceMatch || !replacePayload) {
                        throw new Error(`Replace must have both a ReplaceMatch and a ReplacePayload in ${label} constructor`);
                    }

                    // Parse ReplaceMatch.children as a normal facet
                    const matchFacet = new GeneratedFacetClass(replaceMatch.children);
                    // Parse ReplacePayload.children as a normal facet
                    const payloadFacet = new GeneratedFacetClass(replacePayload.children);
                    
                    // Validate that match and payload reference the same component
                    if (!matchFacet.sameKey(payloadFacet)) {
                        throw new Error(`Replace match and payload must reference the same component in ${label} constructor`);
                    }
                    
                    // Call matchFacet.diff(payloadFacet) to get the difference
                    const diffFacet = matchFacet.diff(payloadFacet);
                    if (!diffFacet) {
                        // No difference means no change - this shouldn't happen for a Replace, but handle it
                        throw new Error(`Replace operation resulted in no difference in ${label} constructor`);
                    }
                    
                    // Check if references match exactly (diffReference would be undefined in diff method)
                    // We need to check this before calling diff, since diff returns a facet with a reference
                    const referenceDiff = matchFacet._reference.diff(payloadFacet._reference);
                    // If diffReference is undefined (references match exactly), use ref=0
                    const finalReference = referenceDiff === undefined
                        ? matchFacet._reference.withRef(0)
                        : diffFacet._reference;
                    
                    // Use the diffPayload from the diff result
                    this._reference = finalReference;
                    this._payloadInstance = diffFacet._payloadInstance;
                    return;
                }

                // Handle plain schemas (no Replace wrapper)
                // Extract reference
                const reference = referenceFactory 
                    ? referenceFactory(schema)
                    : new StandardReference(schema);

                // Extract payload children from schema (facet-specific logic)
                // For facets, payload is typically in children of the reference tag
                // This is facet-specific, so we pass the full schema and let fromSchema extract it
                // But createPayload needs just the payload children, so we need to extract them
                // For now, pass the full schema and let createPayload handle it
                // (createPayload will call fromSchema if needed)
                this._reference = reference;
                this._payloadInstance = createPayload(schema);
                return;
            }

            throw new Error(`Invalid argument to ${label} constructor: expected StandardFacetData, GeneratedFacetClass instance, WML string, or GenericTree<SchemaTag>, got ${JSON.stringify(arg)}`);
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
        get payload(): PayloadClass {
            return this._payloadInstance;
        }

        // Core methods
        clone(): GeneratedFacetClass {
            return this._wrap(new GeneratedFacetClass(this));
        }

        toJSON(): StandardFacetData<D> {
            return {
                reference: this._reference.toJSON(),
                payload: this.payload.toJSON()
            };
        }

        equals(other: GeneratedFacetClass): boolean {
            if (!this.sameKey(other)) {
                return false;
            }
            if (this._reference.ref !== other._reference.ref) {
                return false;
            }
            // Delegate payload comparison to payload.toJSON() - handles all cases including Replace
            return JSON.stringify(this.payload.toJSON()) === JSON.stringify(other.payload.toJSON());
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
            
            // Merge payloads using v2 instance's merge method
            const mergedPayload = this.payload.merge(incoming.payload);
            if (mergedReference === undefined && mergedPayload === undefined) {
                // Both reference and payload cancelled out
                return undefined;
            }
            
            if (mergedReference === undefined) {
                // Reference cancelled out, but payload remains
                // Create result with reference at ref=0 (cancelled out) and merged payload
                const result = new GeneratedFacetClass({
                    reference: this._reference.withRef(0).toJSON(),
                    payload: mergedPayload?.toJSON() ?? this.payload.toJSON()
                });
                return this._wrap(result);
            }
            
            if (mergedPayload === undefined) {
                // Payload cancelled out, but reference remains
                // This shouldn't happen in practice, but handle it
                const result = new GeneratedFacetClass({
                    reference: mergedReference.toJSON(),
                    payload: this.payload.toJSON()
                });
                return this._wrap(result);
            }
            
            // Both merged successfully
            const result = new GeneratedFacetClass({
                reference: mergedReference.toJSON(),
                payload: mergedPayload.toJSON()
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
                // Diff the payload using v2 instance's diff method
                const diffPayload = this.payload.diff(incoming.payload);

                // If both reference and payload are the same, no change
                if (diffReference === undefined && diffPayload === undefined) {
                    return undefined;
                }

                // If payloads differ, create Replace operation
                if (diffPayload !== undefined) {
                    const referenceData = diffReference ? diffReference.toJSON() : this._reference.toJSON();
                    const result = new GeneratedFacetClass({
                        reference: referenceData,
                        payload: diffPayload.toJSON()
                    });
                    return this._wrap(result);
                }

                // Only reference changed, return reference diff only
                if (diffReference) {
                    const result = new GeneratedFacetClass({
                        reference: diffReference.toJSON(),
                        payload: this.payload.toJSON()
                    });
                    return this._wrap(result);
                }

                return undefined;
            } else {
                // Diff from this facet to nothing: invert
                const invertedReference = this._reference.invert();
                const invertedPayload = this.payload.invert();
                const result = new GeneratedFacetClass({
                    reference: invertedReference.toJSON(),
                    payload: invertedPayload.toJSON()
                });
                return this._wrap(result);
            }
        }

        invert(): GeneratedFacetClass {
            // Invert the reference (ref arithmetic)
            const invertedReference = this._reference.invert();
            // Invert the payload using v2 instance's invert method
            const invertedPayload = this.payload.invert();
            const result = new GeneratedFacetClass({
                reference: invertedReference.toJSON(),
                payload: invertedPayload.toJSON()
            });
            return this._wrap(result);
        }

        /**
         * Render facet for parent component orchestration.
         * 
         * This method delegates rendering to the payload class's `renderFacet()` method,
         * which handles all cases including Plain, Remove, and Replace operations.
         * 
         * @param referenceRender - Optional pre-existing render of the reference already in the parent's schema tree.
         *   If not provided, a plain reference render is generated from `this._reference.schema`.
         * @param lookup - Optional lookup function to resolve universal keys to local keys for rendering.
         *   When provided, allows facets to render human-readable local keys instead of universal keys.
         * @returns An object with either `newNode` (for Exit-style facets) or `aggregatedNode` (for Position/Mark-style facets).
         */
        renderFacet(referenceRender?: GenericTreeNode<SchemaTag>, lookup?: (key: string | StandardKey) => StandardComponent | undefined): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> } {
            // If reference is negative (facet is being removed), invert the payload before rendering
            // This ensures transitivity: removal of the facet also removes the payload
            const refIsNegative = this._reference.ref < 0;
            const invertedPayload = refIsNegative ? this.payload.invert() : null;
            const payloadData = refIsNegative
                ? invertedPayload!.toJSON()
                : this.payload.toJSON();
            // Delegate rendering to payload class's renderFacet (handles all cases including Replace)
            // For negative references, use the inverted payload instance to render (so it uses RemoveClass.renderFacet which creates Remove-wrapped schema)
            const payloadInstance = refIsNegative ? invertedPayload! : this.payload;
            return payloadInstance.renderFacet(this._reference, payloadData, referenceRender, lookup);
        }

        // Format conversion
        toFormat(format: ReferenceFormat, mappings?: LookupMappings): GeneratedFacetClass {
            const formattedReference = this._reference.toFormat(format, mappings);
            const result = new GeneratedFacetClass({
                reference: formattedReference.toJSON(),
                payload: this.payload.toJSON()
            });
            return this._wrap(result);
        }

        lookup(mappings: LookupMappings): GeneratedFacetClass {
            const lookedUpReference = this._reference.lookup(mappings);
            const result = new GeneratedFacetClass({
                reference: lookedUpReference.toJSON(),
                payload: this.payload.toJSON()
            });
            return this._wrap(result);
        }
    };
};

