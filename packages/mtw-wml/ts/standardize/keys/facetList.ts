import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardFacetData, StandardFacetData, StandardFacetPayload } from "./dataTypes/facet";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "../components/utils/references";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import { isSchemaTreeNode } from "../../schema";
import { StandardFacet } from "./facet";
import { LookupMappings } from "./reference";
import { FacetListData } from "./abstract";

/**
 * Helper to validate StandardFacetData with optional payload type guard
 * If payloadTypeGuard is provided, validates the specific payload type at runtime.
 * Otherwise, only validates structure.
 */
function validateFacetData<TPayload extends StandardFacetPayload>(
    arg: any,
    payloadTypeGuard?: (arg: any) => arg is TPayload
): arg is StandardFacetData<TPayload> {
    // First validate it's StandardFacetData structure
    if (!isStandardFacetData(arg)) {
        return false
    }
    // If a payload type guard is provided, use it to validate the specific payload type
    if (payloadTypeGuard) {
        return payloadTypeGuard(arg.payload)
    }
    // Otherwise, just validate structure (no runtime type checking for specific TPayload)
    return true
}

/**
 * FacetList: A generic collection type for managing StandardFacet objects
 * Similar structure to ReferenceList but parameterized by payload type
 * 
 * @template TPayload - The specific payload type for all facets in the list
 * 
 * @example
 * // Without type guard (structure validation only, relies on TypeScript compile-time checking)
 * const list1 = new FacetList<PositionPayload>(data)
 * 
 * @example
 * // With type guard (runtime validation of specific payload type)
 * import { isPositionPayload } from './dataTypes/facet'
 * const list2 = new FacetList<PositionPayload>(data, isPositionPayload)
 */
export class FacetList<TPayload extends StandardFacetPayload = StandardFacetPayload> {
    _items: StandardFacet<TPayload>[] = []
    private _payloadTypeGuard?: (arg: any) => arg is TPayload

    /**
     * @param args - Array of StandardFacet instances, StandardFacetData, or another FacetList to clone
     * @param payloadTypeGuard - Optional type guard function to validate payload type at runtime.
     *                          If provided, ensures all facets have the correct payload type.
     *                          If omitted, only validates structure (no runtime type checking for TPayload).
     */
    constructor(
        args: any,
        payloadTypeGuard?: (arg: any) => arg is TPayload
    ) {
        this._payloadTypeGuard = payloadTypeGuard
        // Handle cloning from another FacetList
        if (args instanceof FacetList) {
            this._items = args._items.map((item) => item.clone())
            // Preserve the type guard from the source, or use the provided one
            this._payloadTypeGuard = payloadTypeGuard ?? args._payloadTypeGuard
            return
        }
        
        // Handle array input
        if (Array.isArray(args)) {
            let items: StandardFacet<TPayload>[]
            
            // Check if array contains StandardFacet instances
            if (args.every((item) => item instanceof StandardFacet)) {
                items = args as StandardFacet<TPayload>[]
            }
            // Check if array contains schema tree nodes
            else if (args.every(isSchemaTreeNode)) {
                // Schema tree nodes need to be parsed to StandardFacetData first
                // For now, throw an error as StandardFacet doesn't fully support schema tree construction
                throw new Error('Schema tree construction for FacetList requires StandardFacetData format - parse to StandardFacetData first')
            }
            // Otherwise, treat as StandardFacetData (JSON) or StandardEditableData<StandardFacetData>
            else {
                items = args.map((item) => {
                    // Handle StandardEditableData wrapper (e.g., from Replace operations)
                    if (typeof item === 'object' && item !== null && 'tag' in item && item.tag === 'Replace') {
                        // For Replace operations, validate both match and payload
                        const replaceItem = item as { tag: 'Replace'; match: any; payload: any }
                        if (validateFacetData(replaceItem.match, this._payloadTypeGuard) &&
                            validateFacetData(replaceItem.payload, this._payloadTypeGuard)) {
                            return new StandardFacet(item as { tag: 'Replace'; match: StandardFacetData<TPayload>; payload: StandardFacetData<TPayload> })
                        }
                        // If validation fails and we have a type guard, throw an error
                        if (this._payloadTypeGuard) {
                            throw new Error(`FacetList: Replace operation payload type mismatch. Expected payload type validated by provided type guard.`)
                        }
                        // If no type guard, construct anyway (structure validated, but payload type not checked)
                        return new StandardFacet(item as any)
                    }
                    // Handle plain StandardFacetData with optional type validation
                    if (validateFacetData(item, this._payloadTypeGuard)) {
                        return new StandardFacet(item)
                    }
                    // If validation fails and we have a type guard, throw an error
                    if (this._payloadTypeGuard) {
                        throw new Error(`FacetList: Facet data payload type mismatch. Expected payload type validated by provided type guard.`)
                    }
                    // If not valid StandardFacetData structure, try to construct anyway (might be wrapped)
                    // This will throw at runtime if the structure is invalid
                    return new StandardFacet(item as StandardFacetData<TPayload>)
                })
            }
            
            // Deduplication: Merge items with the same key
            const swapSpace = items.reduce<StandardFacet<TPayload>[]>((previous, item) => {
                const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev))
                const previousMatch = previous.find((prev) => item.sameKey(prev))
                if (previousMatch) {
                    const merged = previousMatch.merge(item)
                    if (merged) {
                        return [...unmatchedPrevious, merged].filter(excludeUndefined)
                    }
                    return unmatchedPrevious
                }
                return [...previous, item]
            }, [])
            
            this._items = swapSpace
            
            //
            // Guarantee that the facet stored has normalized reference data
            // Since StandardFacet composes StandardReference, we ensure the reference
            // is in the minimum key information format
            //
            this._items = this._items.map<StandardFacet<TPayload>>((item) => {
                if (item instanceof StandardFacet) {
                    // Normalize the reference within the facet
                    // Create a new facet with normalized reference data
                    const normalizedReference = item.reference.mapContents((data) => {
                        if (typeof data === 'string') {
                            return data
                        }
                        if (typeof data === 'object' && data !== null) {
                            return {
                                ...data
                            }
                        }
                        return data
                    })
                    // Reconstruct facet with normalized reference
                    const facetData: StandardFacetData<TPayload> = {
                        reference: normalizedReference.toJSON(),
                        payload: item.payload
                    }
                    // If this was a Replace operation, preserve it
                    if (item.isReplace && item.matchPayload !== undefined) {
                        const matchData: StandardFacetData<TPayload> = {
                            reference: normalizedReference.toJSON(),
                            payload: item.matchPayload
                        }
                        return new StandardFacet({
                            tag: 'Replace' as const,
                            match: matchData,
                            payload: facetData
                        })
                    }
                    return new StandardFacet(facetData)
                }
                return item
            })
            return
        }
        
        throw new Error('Invalid argument type for FacetList constructor')
    }

    toJSON(): FacetListData<TPayload> {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._items.map(item => item.schema).flat(1).filter(isSchemaTreeNode)
    }

    clone(): FacetList<TPayload> {
        return new FacetList(this)
    }

    get items(): StandardFacet<TPayload>[] {
        return this._items
    }

    get length(): number {
        return this._items.length
    }

    equals(other: FacetList<TPayload>): boolean {
        if (!(other instanceof FacetList)) {
            return false
        }
        if (this._items.length !== other._items.length) {
            return false
        }
        // Compare items regardless of order (set-like comparison)
        // For each item in this list, find a matching item in the other list
        const otherItems = [...other._items]
        for (const item of this._items) {
            const matchIndex = otherItems.findIndex((otherItem) => item.equals(otherItem))
            if (matchIndex === -1) {
                return false
            }
            // Remove matched item to handle duplicates correctly
            otherItems.splice(matchIndex, 1)
        }
        return true
    }

    // Stub implementations for Phase 4, Task 2
    // NOTE: When implementing these methods, ensure they preserve this._payloadTypeGuard
    // when creating new FacetList instances (e.g., new FacetList(items, this._payloadTypeGuard))
    merge(incoming: FacetList<TPayload>): FacetList<TPayload> {
        throw new Error('FacetList.merge() not yet implemented - see Phase 4, Task 2')
    }

    diff(incoming: FacetList<TPayload>): FacetList<TPayload> {
        throw new Error('FacetList.diff() not yet implemented - see Phase 4, Task 2')
    }

    invert(): FacetList<TPayload> {
        throw new Error('FacetList.invert() not yet implemented - see Phase 4, Task 2')
    }

    mapContents(callback: (facet: StandardFacet<TPayload>) => StandardFacet<TPayload>): FacetList<TPayload> {
        throw new Error('FacetList.mapContents() not yet implemented - see Phase 4, Task 2')
    }

    toFormat(format: ReferenceFormat): FacetList<TPayload> {
        throw new Error('FacetList.toFormat() not yet implemented - see Phase 4, Task 2')
    }

    lookup(mappings: LookupMappings): FacetList<TPayload> {
        throw new Error('FacetList.lookup() not yet implemented - see Phase 4, Task 2')
    }
}

export default FacetList;
