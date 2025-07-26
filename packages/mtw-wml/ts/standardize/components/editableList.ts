import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { PayloadDataType, StandardEditablePayload, StandardEditableWrapper } from "../../generics/editable";
import { isSchemaTreeNode } from "../../schema";

interface EditableListItem<D extends StandardEditablePayload<any>> extends StandardEditableWrapper<D> {
    sameKey(other: this): boolean;
}

interface EditableList<D extends StandardEditablePayload<any>> {
    toJSON(): StandardEditableData<PayloadDataType<D>>[];
    clone(): EditableList<D>;
}

export const editableListClassFactory = <D extends StandardEditablePayload<any>, TBase extends new (...args: any[]) => EditableListItem<D>>(Base: TBase, label: string) => {
    return class GeneratedEditableListClass implements EditableList<D> {
        _items: EditableListItem<D>[] = [];

        constructor(arg: any) {
            if (arg instanceof GeneratedEditableListClass) {
                this._items = arg._items.map((item) => item.clone() as EditableListItem<D>);
            } else if (Array.isArray(arg)) {
                if (arg.every(isSchemaTreeNode)) {
                    this._items = arg.map((item) => new Base([item]));
                }
                else {
                    this._items = arg.map((item) => new Base(item))
                }
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

        clone(): EditableList<D> {
            return new GeneratedEditableListClass(this)
        }

    }
}
