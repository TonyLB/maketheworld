import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { PayloadDataType, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { isSchemaTreeNode } from "../../schema";
import { excludeUndefined } from "../../lib/lists";
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";

interface EditableListItem<D extends StandardEditablePayload<any>> extends StandardEditableWrapper<D> {
    sameKey(other: this): boolean;
    invert(): this;
}

interface EditableList<D extends StandardEditablePayload<any>> {
    toJSON(): StandardEditableData<PayloadDataType<D>>[];
    clone(): EditableList<D>;
    merge(other: EditableList<D>): EditableList<D> | undefined;
    diff(other: EditableList<D>): EditableList<D> | undefined;
}

export const editableListClassFactory = <D extends StandardEditablePayload<any>, TBase extends new (...args: any[]) => EditableListItem<D>>(Base: TBase, label: string) => {
    return class GeneratedEditableListClass implements EditableList<D> {
        _items: EditableListItem<D>[] = [];

        constructor(arg: any) {
            if (arg instanceof GeneratedEditableListClass) {
                this._items = arg._items.map((item) => item.clone() as EditableListItem<D>);
            } else if (Array.isArray(arg)) {
                if (arg.every((item) => item instanceof Base)) {
                    this._items = arg as EditableListItem<D>[]
                }
                else if (arg.every(isSchemaTreeNode)) {
                    this._items = arg.map((item) => new Base([item]))
                }
                else {
                    this._items = arg.map((item) => new Base(item))
                }
                const swapSpace = this._items.reduce<EditableListItem<D>[]>((previous, item) => {
                    const unmatchedPrevious = previous.filter((prev) => !item.sameKey(prev))
                    const previousMatch = previous.find((prev) => item.sameKey(prev))
                    if (previousMatch) {
                        return [...unmatchedPrevious, previousMatch.merge(item) as EditableListItem<D>].filter(excludeUndefined)
                    }
                    return [...previous, item]
                }, [])
                this._items = swapSpace
            } else {
                throw new Error(`Invalid argument type for ${label} constructor`)
            }
        }

        toJSON(): StandardEditableData<PayloadDataType<D>>[] {
            return this._items.map((item) => {
                if (item instanceof Base) {
                    return item.toJSON()
                }
                throw new Error(`Item in ${label} is not an instance of ${Base.name}`)
            })
        }

        get schema(): GenericTree<SchemaTag> {
            return this._items.map(item => item.schema).flat(1).filter(isSchemaTreeNode)
        }

        clone(): EditableList<D> {
            return new GeneratedEditableListClass(this)
        }

        merge(other: EditableList<D>): EditableList<D> | undefined {
            if (!(other instanceof GeneratedEditableListClass)) {
                throw new Error(`Cannot merge with non-${label} instance`)
            }
            const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
            const matchedOtherItems: { base: EditableListItem<D>, incoming: EditableListItem<D> }[] = other._items.map((incoming) => {
                    const base = this._items.find(item => item.sameKey(incoming))
                    if (base) {
                        return { incoming, base }
                    }
                    return { incoming, base: undefined }
                })
                .filter((value): value is { base: EditableListItem<D>, incoming: EditableListItem<D> } => typeof value.base !== 'undefined')
            const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
            return new GeneratedEditableListClass([
                ...unmatchedBaseItems,
                ...matchedOtherItems.map(({ base, incoming }) => (base.merge(incoming))),
                ...unmatchedOtherItems
            ].filter(excludeUndefined))
        }

        diff(other: EditableList<D>): EditableList<D> | undefined {
            if (!(other instanceof GeneratedEditableListClass)) {
                throw new Error(`Cannot diff with non-${label} instance`)
            }
            const unmatchedBaseItems = this._items.filter(item => !other._items.some(otherItem => item.sameKey(otherItem)))
            const matchedOtherItems: { base: EditableListItem<D>, incoming: EditableListItem<D> }[] = other._items.map((incoming) => {
                    const base = this._items.find(item => item.sameKey(incoming))
                    if (base) {
                        return { incoming, base }
                    }
                    return { incoming, base: undefined }
                })
                .filter((value): value is { base: EditableListItem<D>, incoming: EditableListItem<D> } => typeof value.base !== 'undefined')
            const unmatchedOtherItems = other._items.filter(item => !this._items.some(baseItem => baseItem.sameKey(item)))
            return new GeneratedEditableListClass([
                ...unmatchedBaseItems.map(item => item.invert()),
                ...matchedOtherItems.map(({ base, incoming }) => (base.diff(incoming))),
                ...unmatchedOtherItems
            ].filter(excludeUndefined))
        }

    }
}
