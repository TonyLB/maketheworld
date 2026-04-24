import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardReferenceData, StandardReferenceData } from "./dataTypes/reference";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ReferenceFormat } from "../components/utils/references";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import { isSchemaTreeNode } from "../../schema";
import StandardReference, { LookupMappings } from "./reference";

export class ReferenceList {
    _items: StandardReference[] = []

    constructor(args: any) {
        // Handle cloning from another ReferenceList
        if (args instanceof ReferenceList) {
            this._items = args._items.map((item) => item.clone())
            return
        }
        
        // Handle array input
        if (Array.isArray(args)) {
            let items: StandardReference[]
            
            // Check if array contains StandardReference instances
            if (args.every((item) => item instanceof StandardReference)) {
                items = args as StandardReference[]
            }
            // Check if array contains schema tree nodes
            else if (args.every(isSchemaTreeNode)) {
                items = args.map((item) => new StandardReference([item]))
            }
            // Otherwise, treat as StandardReferenceData (JSON)
            else {
                items = args.map((item) => new StandardReference(item))
            }
            
            // Deduplication: Merge items with the same key
            const swapSpace = items.reduce<StandardReference[]>((previous, item) => {
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
            // Guarantee that the reference stored is to the minimum key information needed to correctly
            // identify the component, without context.
            //
            this._items = this._items.map<StandardReference>((item) => {
                if (item instanceof StandardReference) {
                    return item.mapContents((data) => {
                        if (isStandardReferenceData(data)) {
                            if (typeof data === 'string') {
                                return data
                            }
                            return {
                                ...data
                            }
                        }
                        return data
                    })
                }
                return item
            })
            return
        }
        
        throw new Error('Invalid argument type for ReferenceList constructor')
    }

    //
    // _wrap(list):
    //  - Hook for subclasses that want ReferenceList operations (clone, merge,
    //    diff, map, filter, etc.) to return a more specific list type.
    //  - Base implementations in this class always:
    //      * build a new ReferenceList instance, then
    //      * return this._wrap(new ReferenceList(...)).
    //  - Subclasses can override _wrap to construct their own type from that
    //    intermediate ReferenceList payload.
    //
    // Important: _wrap only affects the runtime instance that is returned. It
    // does not change the static TypeScript return types of these methods.
    // When a subclass needs narrower return types (for example, methods that
    // are typed as returning SingleReference instead of ReferenceList), that
    // subclass must still declare explicit overrides with the desired
    // signatures.
    //
    protected _wrap(list: ReferenceList): ReferenceList {
        return list
    }

    toJSON(): StandardEditableData<StandardReferenceData>[] {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._items.map(item => item.schema).flat(1).filter(isSchemaTreeNode)
    }

    clone(): ReferenceList {
        return this._wrap(new ReferenceList(this))
    }

    get payload(): StandardReference[] {
        return this._items
    }

    isEmpty(): boolean {
        return this._items.length === 0 || this._items.every((item) => item.ref === 0)
    }

    equals(other: ReferenceList): boolean {
        if (!(other instanceof ReferenceList)) {
            return false
        }

        const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
        if (unmatchedBaseItems.length > 0) {
            return false
        }
        const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
        if (unmatchedOtherItems.length > 0) {
            return false
        }
        return this._items.every((item) => {
            const matchingItem = other._items.find((otherItem) => item.sameKey(otherItem))
            return matchingItem ? matchingItem.ref === item.ref : false
        })
    }

    merge(other: ReferenceList, options?: { cleanEmptyReferences?: boolean }): ReferenceList | undefined {
        if (!(other instanceof ReferenceList)) {
            throw new Error('Cannot merge with non-ReferenceList instance')
        }
        
        const { cleanEmptyReferences = true } = options ?? {}
        
        const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
        const matchedOtherItems: { base: StandardReference, incoming: StandardReference }[] = other._items.map((incoming) => {
                const base = this._items.find(item => item.sameKey(incoming))
                if (base) {
                    return { incoming, base }
                }
                return { incoming, base: undefined }
            })
            .filter((value): value is { base: StandardReference, incoming: StandardReference } => typeof value.base !== 'undefined')
        const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
        
        // Filter unmatched incoming items: if cleanEmptyReferences is true (default), exclude items with ref === 0
        // because ref={0} means "reference only, don't add if not already present"
        // Note: ref < 0 (Remove operations) should be kept, only ref === 0 should be filtered
        const filteredUnmatchedOtherItems = cleanEmptyReferences
            ? unmatchedOtherItems.filter(item => item.ref !== 0)
            : unmatchedOtherItems
        
        const mergedItems = [
            ...unmatchedBaseItems,
            ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming, options)),
            ...filteredUnmatchedOtherItems
        ].filter(excludeUndefined)
        const mergedList = new ReferenceList(mergedItems)
        return this._wrap(mergedList)
    }

    diff(other: ReferenceList): ReferenceList | undefined {
        if (!(other instanceof ReferenceList)) {
            throw new Error('Cannot diff with non-ReferenceList instance')
        }
        
        const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
        const matchedOtherItems: { base: StandardReference, incoming: StandardReference }[] = other._items.map((incoming) => {
                const base = this._items.find(item => item.sameKey(incoming))
                if (base) {
                    return { incoming, base }
                }
                return { incoming, base: undefined }
            })
            .filter((value): value is { base: StandardReference, incoming: StandardReference } => typeof value.base !== 'undefined')
        const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
        
        const diffedItems = [
            ...unmatchedBaseItems.map(item => item.invert()),
            ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
            ...unmatchedOtherItems
        ].filter(excludeUndefined)
        const diffList = new ReferenceList(diffedItems)
        return this._wrap(diffList)
    }

    assureItem(item: StandardReference): ReferenceList {
        if (!this._items.some(existingItem => existingItem.sameKey(item))) {
            const next = new ReferenceList([...this._items, item])
            return this._wrap(next)
        }
        return this
    }

    map(callback: (item: StandardReference) => StandardReference): ReferenceList {
        const mapped = this._items.map(callback)
        const next = new ReferenceList(mapped)
        return this._wrap(next)
    }

    filter(predicate: (item: StandardReference) => boolean): ReferenceList {
        const next = new ReferenceList(this._items.filter(predicate))
        return this._wrap(next)
    }

    toFormat(format: ReferenceFormat, mappings?: LookupMappings): ReferenceList {
        // First lookup if mappings provided
        const list = mappings ? this.lookup(mappings) : this
        // Then format all items (don't pass mappings again, already looked up)
        const formatted = list.payload.map((item) => item.toFormat(format, undefined));

        const next = new ReferenceList(formatted)
        return this._wrap(next)
    }

    lookup(arg: LookupMappings): ReferenceList {
        const next = new ReferenceList(this.payload.map((item) => item.lookup(arg)))
        return this._wrap(next)
    }

    invert(): ReferenceList {
        const next = new ReferenceList(this.payload.map((item) => item.invert()))
        return this._wrap(next)
    }

}

export default ReferenceList;
