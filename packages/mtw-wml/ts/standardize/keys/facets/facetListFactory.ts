import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "../../components/utils/references";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import { isSchemaTreeNode } from "../../../schema";
import { LookupMappings } from "../reference";
import { StandardFacetData, StandardFacetPayload } from "./dataTypes/facet";

/**
 * FacetListItem: Interface for items in a FacetList
 * Each item must support sameKey, clone, merge, diff, invert, equals operations
 */
export interface FacetListItem {
    sameKey(other: this): boolean;
    clone(): this;
    merge(incoming: this): this | undefined;
    diff(incoming: this | undefined): this | undefined;
    invert(): this;
    equals(other: this): boolean;
    toJSON(): StandardFacetData<StandardFacetPayload> | { tag: 'Replace'; match: StandardFacetData<StandardFacetPayload>; payload: StandardFacetData<StandardFacetPayload> };
    toFormat(format: ReferenceFormat): this;
    lookup(mappings: LookupMappings): this;
    readonly reference: { mapContents(callback: (data: any) => any): any; toJSON(): any };
    readonly isReplace?: boolean;
    readonly matchPayload?: any;
}

/**
 * FacetListClassFactory: Factory function that generates concrete list classes for facets
 * 
 * Similar to editableListClassFactory but adapted for facets with:
 * - Reference normalization (like ReferenceList)
 * - Schema tree construction support
 * - Replace operation handling
 * 
 * @param FacetClass - The concrete facet class constructor (e.g., StandardPositionFacet)
 * @param label - Label string for error messages (e.g., 'PositionFacetList')
 * @returns A generated list class that stores arrays of the concrete facet type
 */
export const facetListClassFactory = <
    TFacet extends FacetListItem,
    TBase extends new (...args: any[]) => TFacet
>(FacetClass: TBase, label: string) => {
    return class GeneratedFacetListClass {
        _items: TFacet[] = [];

        constructor(arg: any) {
            // Handle cloning from another list of the same type
            if (arg instanceof GeneratedFacetListClass) {
                this._items = arg._items.map((item) => item.clone() as TFacet);
                return;
            }

            // Handle array input
            if (Array.isArray(arg)) {
                let items: TFacet[];

                // Check if array contains concrete facet instances
                if (arg.every((item) => item instanceof FacetClass)) {
                    items = arg as TFacet[];
                }
                // Check if array contains schema tree nodes
                else if (arg.every(isSchemaTreeNode)) {
                    items = arg.map((item) => new FacetClass([item]) as TFacet);
                }
                // Otherwise, treat as StandardFacetData (JSON) or Replace-wrapped data
                else {
                    items = arg.map((item) => {
                        // Handle Replace-wrapped data structures
                        if (typeof item === 'object' && item !== null && 'tag' in item && item.tag === 'Replace') {
                            return new FacetClass(item) as TFacet;
                        }
                        // Handle plain StandardFacetData
                        return new FacetClass(item) as TFacet;
                    });
                }

                // Deduplication: Merge items with the same key
                const swapSpace = items.reduce<TFacet[]>((previous, item) => {
                    const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev));
                    const previousMatch = previous.find((prev) => item.sameKey(prev));
                    if (previousMatch) {
                        const merged = previousMatch.merge(item);
                        if (merged) {
                            return [...unmatchedPrevious, merged as TFacet].filter(excludeUndefined);
                        }
                        return unmatchedPrevious;
                    }
                    return [...previous, item];
                }, []);

                this._items = swapSpace;

                //
                // Guarantee that the facet stored has normalized reference data
                // Since facets compose StandardReference, we ensure the reference
                // is in the minimum key information format
                //
                this._items = this._items.map<TFacet>((item) => {
                    // Normalize the reference within the facet by calling mapContents
                    // This ensures the reference is in canonical form (handles string vs object form, preserves ref)
                    // The callback just passes through - the normalization happens in mapContents itself
                    const normalizedReference = item.reference.mapContents((data) => data);

                    // Reconstruct facet with normalized reference
                    const facetJSON = item.toJSON();
                    if (typeof facetJSON === 'object' && facetJSON !== null && 'tag' in facetJSON && facetJSON.tag === 'Replace') {
                        // Handle Replace operations
                        const replaceData = facetJSON as { tag: 'Replace'; match: StandardFacetData<StandardFacetPayload>; payload: StandardFacetData<StandardFacetPayload> };
                        const normalizedMatch: StandardFacetData<StandardFacetPayload> = {
                            reference: normalizedReference.toJSON(),
                            payload: replaceData.match.payload
                        };
                        const normalizedPayload: StandardFacetData<StandardFacetPayload> = {
                            reference: normalizedReference.toJSON(),
                            payload: replaceData.payload.payload
                        };
                        return new FacetClass({
                            tag: 'Replace' as const,
                            match: normalizedMatch,
                            payload: normalizedPayload
                        }) as TFacet;
                    } else {
                        // Handle plain facets
                        const facetData = facetJSON as StandardFacetData<StandardFacetPayload>;
                        const normalizedFacetData: StandardFacetData<StandardFacetPayload> = {
                            reference: normalizedReference.toJSON(),
                            payload: facetData.payload
                        };
                        return new FacetClass(normalizedFacetData) as TFacet;
                    }
                });
                return;
            }

            throw new Error(`Invalid argument type for ${label} constructor`);
        }

        _wrap(instance: GeneratedFacetListClass): this {
            return instance as this;
        }

        toJSON(): StandardEditableData<StandardFacetData<StandardFacetPayload>>[] {
            return this._items.map((item) => {
                if (item instanceof FacetClass) {
                    return item.toJSON() as StandardEditableData<StandardFacetData<StandardFacetPayload>>;
                }
                throw new Error(`Item in ${label} is not an instance of ${FacetClass.name}`);
            });
        }

        clone(): GeneratedFacetListClass {
            return this._wrap(new GeneratedFacetListClass(this));
        }

        get items(): TFacet[] {
            return this._items;
        }

        get length(): number {
            return this._items.length;
        }

        equals(other: GeneratedFacetListClass): boolean {
            if (!(other instanceof GeneratedFacetListClass)) {
                return false;
            }
            if (this._items.length !== other._items.length) {
                return false;
            }
            // Compare items regardless of order (set-like comparison)
            const otherItems = [...other._items];
            for (const item of this._items) {
                const matchIndex = otherItems.findIndex((otherItem) => item.equals(otherItem));
                if (matchIndex === -1) {
                    return false;
                }
                // Remove matched item to handle duplicates correctly
                otherItems.splice(matchIndex, 1);
            }
            return true;
        }

        merge(incoming: GeneratedFacetListClass): GeneratedFacetListClass | undefined {
            if (!(incoming instanceof GeneratedFacetListClass)) {
                throw new Error(`Cannot merge with non-${label} instance`);
            }

            // Find unmatched base items (items in this not in incoming)
            const unmatchedBaseItems = this._items.filter(item => !incoming._items.some(otherItem => item.sameKey(otherItem)));

            // Find matched items (items with same key in both lists)
            const matchedOtherItems: { base: TFacet, incoming: TFacet }[] = incoming._items.map((incomingItem) => {
                const base = this._items.find(item => item.sameKey(incomingItem));
                if (base) {
                    return { incoming: incomingItem, base };
                }
                return { incoming: incomingItem, base: undefined };
            })
            .filter((value): value is { base: TFacet, incoming: TFacet } => typeof value.base !== 'undefined');

            // Find unmatched incoming items (items in incoming not in this)
            const unmatchedOtherItems = incoming._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)));

            // Merge matched items using facet.merge() which handles ref arithmetic + payload Replace
            const mergedItems = [
                ...unmatchedBaseItems,
                ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming)),
                ...unmatchedOtherItems
            ].filter(excludeUndefined);

            if (mergedItems.length === 0) {
                return undefined;
            }

            return this._wrap(new GeneratedFacetListClass(mergedItems));
        }

        diff(incoming: GeneratedFacetListClass): GeneratedFacetListClass | undefined {
            if (!(incoming instanceof GeneratedFacetListClass)) {
                throw new Error(`Cannot diff with non-${label} instance`);
            }

            // Find unmatched base items (items in this not in incoming) - invert them
            const unmatchedBaseItems = this._items.filter(item => !incoming._items.some(otherItem => item.sameKey(otherItem)));

            // Find matched items (items with same key in both lists) - diff them
            const matchedOtherItems: { base: TFacet, incoming: TFacet }[] = incoming._items.map((incomingItem) => {
                const base = this._items.find(item => item.sameKey(incomingItem));
                if (base) {
                    return { incoming: incomingItem, base };
                }
                return { incoming: incomingItem, base: undefined };
            })
            .filter((value): value is { base: TFacet, incoming: TFacet } => typeof value.base !== 'undefined');

            // Find unmatched incoming items (items in incoming not in this) - include as-is
            const unmatchedOtherItems = incoming._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)));

            // Diff matched items using facet.diff() which handles ref arithmetic + payload Replace
            const diffedItems = [
                ...unmatchedBaseItems.map(item => item.invert()),
                ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
                ...unmatchedOtherItems
            ].filter(excludeUndefined);

            if (diffedItems.length === 0) {
                return undefined;
            }

            return this._wrap(new GeneratedFacetListClass(diffedItems));
        }

        invert(): GeneratedFacetListClass {
            // Map each item through facet.invert()
            const invertedItems = this._items.map(item => item.invert());
            return this._wrap(new GeneratedFacetListClass(invertedItems));
        }

        mapContents(callback: (facet: TFacet) => TFacet): GeneratedFacetListClass {
            // Map _items through the callback
            const mappedItems = this._items.map(callback);
            return this._wrap(new GeneratedFacetListClass(mappedItems));
        }

        toFormat(format: ReferenceFormat): GeneratedFacetListClass {
            // Map each item through facet.toFormat(format)
            const formattedItems = this._items.map(item => item.toFormat(format));
            return this._wrap(new GeneratedFacetListClass(formattedItems));
        }

        lookup(mappings: LookupMappings): GeneratedFacetListClass {
            // Map each item through facet.lookup(mappings)
            const lookedUpItems = this._items.map(item => item.lookup(mappings));
            return this._wrap(new GeneratedFacetListClass(lookedUpItems));
        }
    };
};
