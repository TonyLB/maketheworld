import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { ReferenceFormat } from "../../components/utils/references"
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists"
import { isSchemaTreeNode } from "../../../schema"
import { LookupMappings } from "../reference"
import { StandardExitEdgeData } from "./dataTypes/exitEdge"
import { EdgeListItem } from "./edgeFactory"

export const edgeListClassFactory = <
    TBase extends new (...args: any[]) => EdgeListItem
>(EdgeClass: TBase, label: string) => {
    return class GeneratedEdgeListClass {
        _items: InstanceType<TBase>[] = []

        constructor(arg: any) {
            if (arg instanceof GeneratedEdgeListClass) {
                this._items = arg._items.map((item) => item.clone() as InstanceType<TBase>)
                return
            }

            if (Array.isArray(arg)) {
                let items: InstanceType<TBase>[]

                if (arg.every((item) => item instanceof EdgeClass)) {
                    items = arg as InstanceType<TBase>[]
                } else if (arg.every(isSchemaTreeNode)) {
                    items = arg.map((item) => new EdgeClass([item]) as InstanceType<TBase>)
                } else {
                    items = arg.map((item) => {
                        if (typeof item === 'object' && item !== null && 'tag' in item && item.tag === 'Replace') {
                            return new EdgeClass(item) as InstanceType<TBase>
                        }
                        return new EdgeClass(item) as InstanceType<TBase>
                    })
                }

                const deduped = items.reduce<InstanceType<TBase>[]>((previous, item) => {
                    const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev))
                    const previousMatch = previous.find((prev) => item.sameKey(prev))
                    if (previousMatch) {
                        const merged = previousMatch.merge(item)
                        if (merged) {
                            return [...unmatchedPrevious, merged as InstanceType<TBase>].filter(excludeUndefined)
                        }
                        return unmatchedPrevious
                    }
                    return [...previous, item]
                }, [])

                this._items = deduped
                return
            }

            throw new Error(`Invalid argument type for ${label} constructor`)
        }

        _wrap(instance: GeneratedEdgeListClass): this {
            return instance as this
        }

        toJSON(): StandardEditableData<StandardExitEdgeData>[] {
            return this._items.map((item) => item.toJSON())
        }

        clone(): GeneratedEdgeListClass {
            return this._wrap(new GeneratedEdgeListClass(this))
        }

        get items(): InstanceType<TBase>[] {
            return this._items
        }

        get payload(): InstanceType<TBase>[] {
            return this._items
        }

        get length(): number {
            return this._items.length
        }

        get schema(): GenericTree<SchemaTag> {
            return this._items.map((item) => (item as any).schema())
        }

        isEmpty(): boolean {
            return this._items.length === 0
        }

        equals(other: GeneratedEdgeListClass): boolean {
            if (!(other instanceof GeneratedEdgeListClass)) {
                return false
            }
            if (this._items.length !== other._items.length) {
                return false
            }
            const otherItems = [...other._items]
            for (const item of this._items) {
                const matchIndex = otherItems.findIndex((otherItem) => item.equals(otherItem))
                if (matchIndex === -1) {
                    return false
                }
                otherItems.splice(matchIndex, 1)
            }
            return true
        }

        merge(incoming: GeneratedEdgeListClass): GeneratedEdgeListClass | undefined {
            if (!(incoming instanceof GeneratedEdgeListClass)) {
                throw new Error(`Cannot merge with non-${label} instance`)
            }

            const unmatchedBaseItems = this._items.filter(item => !incoming._items.some(otherItem => item.sameKey(otherItem)))
            const matchedOtherItems: { base: InstanceType<TBase>, incoming: InstanceType<TBase> }[] = incoming._items.map((incomingItem) => {
                const base = this._items.find(item => item.sameKey(incomingItem))
                if (base) {
                    return { incoming: incomingItem, base }
                }
                return { incoming: incomingItem, base: undefined }
            })
            .filter((value): value is { base: InstanceType<TBase>, incoming: InstanceType<TBase> } => typeof value.base !== 'undefined')

            const unmatchedOtherItems = incoming._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))

            const mergedItems = [
                ...unmatchedBaseItems,
                ...matchedOtherItems.map(({ base, incoming }) => base.merge(incoming)),
                ...unmatchedOtherItems
            ].filter(excludeUndefined)

            if (mergedItems.length === 0) {
                return undefined
            }

            return this._wrap(new GeneratedEdgeListClass(mergedItems))
        }

        diff(incoming: GeneratedEdgeListClass): GeneratedEdgeListClass | undefined {
            if (!(incoming instanceof GeneratedEdgeListClass)) {
                throw new Error(`Cannot diff with non-${label} instance`)
            }

            const unmatchedBaseItems = this._items.filter(item => !incoming._items.some(otherItem => item.sameKey(otherItem)))
            const matchedOtherItems: { base: InstanceType<TBase>, incoming: InstanceType<TBase> }[] = incoming._items.map((incomingItem) => {
                const base = this._items.find(item => item.sameKey(incomingItem))
                if (base) {
                    return { incoming: incomingItem, base }
                }
                return { incoming: incomingItem, base: undefined }
            })
            .filter((value): value is { base: InstanceType<TBase>, incoming: InstanceType<TBase> } => typeof value.base !== 'undefined')

            const unmatchedOtherItems = incoming._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))

            const diffedItems = [
                ...unmatchedBaseItems.map(item => item.invert()),
                ...matchedOtherItems.map(({ base, incoming }) => base.diff(incoming)),
                ...unmatchedOtherItems
            ].filter(excludeUndefined)

            if (diffedItems.length === 0) {
                return undefined
            }

            return this._wrap(new GeneratedEdgeListClass(diffedItems))
        }

        invert(): GeneratedEdgeListClass {
            const invertedItems = this._items.map(item => item.invert())
            return this._wrap(new GeneratedEdgeListClass(invertedItems))
        }

        mapContents(callback: (edge: InstanceType<TBase>) => InstanceType<TBase>): GeneratedEdgeListClass {
            const mappedItems = this._items.map(callback)
            return this._wrap(new GeneratedEdgeListClass(mappedItems))
        }

        toFormat(format: ReferenceFormat): GeneratedEdgeListClass {
            const formattedItems = this._items.map(item => item.toFormat(format))
            return this._wrap(new GeneratedEdgeListClass(formattedItems))
        }

        lookup(mappings: LookupMappings): GeneratedEdgeListClass {
            const lookedUpItems = this._items.map(item => item.lookup(mappings))
            return this._wrap(new GeneratedEdgeListClass(lookedUpItems))
        }
    }
}
