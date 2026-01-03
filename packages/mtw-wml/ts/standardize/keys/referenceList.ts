import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isStandardReferenceData, StandardReferenceData } from "../components/dataTypes/reference";
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

    toJSON(): StandardEditableData<StandardReferenceData>[] {
        return this._items.map((item) => item.toJSON())
    }

    get schema(): GenericTree<SchemaTag> {
        return this._items.map(item => item.schema).flat(1).filter(isSchemaTreeNode)
    }

    clone(): ReferenceList {
        return new ReferenceList(this)
    }

    get payload(): StandardReference[] {
        return this._items
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
        
        return new ReferenceList(mergedItems)
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
        
        return new ReferenceList(diffedItems)
    }

    assureItem(item: StandardReference): ReferenceList {
        if (!this._items.some(existingItem => existingItem.sameKey(item))) {
            const returnValue = this.clone()
            returnValue._items = [...returnValue._items, item]
            return returnValue
        }
        return this
    }

    map(callback: (item: StandardReference) => StandardReference): ReferenceList {
        const returnValue = this.clone()
        returnValue._items = this._items.map(callback)
        return returnValue
    }

    filter(predicate: (item: StandardReference) => boolean): ReferenceList {
        return new ReferenceList(this._items.filter(predicate))
    }

    toFormat(format: ReferenceFormat, mappings?: LookupMappings): ReferenceList {
        // First lookup if mappings provided
        const list = mappings ? this.lookup(mappings) : this
        // Then format all items (don't pass mappings again, already looked up)
        const formatted = list.payload.map((item) => item.toFormat(format, undefined));
        
        return new ReferenceList(formatted)
    }

    lookup(arg: LookupMappings): ReferenceList {
        return new ReferenceList(this.payload.map((item) => item.lookup(arg)))
    }

    invert(): ReferenceList {
        return new ReferenceList(this.payload.map((item) => item.invert()))
    }

}

export default ReferenceList;
