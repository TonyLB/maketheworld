//
// The componentClassFactory class function accepts a payload class that implements
// the ComponentConstructorMethods interface, and returns a class suitable for
// use as a StandardComponent, with key and payload subsections.
//
// The payload class is assumed to *ignore* incoming constructor arguments,
// and to always (initially) create a default object of the relevant type.
// Accepting incoming arguments should occur in the constructor methods,
// which are called by the componentClassFactory wrapper function.
//
// NOTE: For easy access, the returned class should then be extended with getter
// functions to pull data out of the private payload.
//

import { isSchemaWithKey, SchemaTag, SchemaWithKey } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { MergeConflictError } from "../baseClasses";
import { isLegalKey, nodeFromWML } from "../utils";
import { ComponentKey } from "./dataTypes/key"
import { KeyPayload } from "./key";
import { isSchemaTreeNode } from "./utils";

export interface ComponentConstructorMethods<D extends ComponentKey> {
    fromJSON(line: D): void;
    fromSchema(node: GenericTreeNode<SchemaTag>): void;
    merge(incoming: this): this;
    toJSON(): Omit<D, 'key' | 'universalKey'>;
    schema(key: string): GenericTreeNode<SchemaTag>;
    tag: SchemaWithKey["tag"];
}

export const componentClassFactory = <D extends ComponentKey, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass {
        _key: KeyPayload;
        _payload: InstanceType<typeof Base>;
        constructor(props: string | D | GenericTreeNode<SchemaTag>) {
            this._payload = new Base() as InstanceType<typeof Base>
            if (typeof props === 'string' && isLegalKey(props)) {
                this._key = new KeyPayload(props)
                return
            }
            if (isSchemaTreeNode(props) || typeof props === 'string') {
                const node = typeof props === 'string'
                    ? nodeFromWML(props)
                    : props
                if (!treeNodeTypeguard(isSchemaWithKey)(node)) {
                    throw new Error(`No key found in ${label} constructor call.`)
                }
                this._key = new KeyPayload(node.data.key)
                this._payload.fromSchema(node)
                return
            }
            this._key = new KeyPayload(props)
            this._payload.fromJSON(props)
        }

        get key(): string { return this._key.key }
        get universalKey(): string | undefined { return this._key.universalKey }
        get tag(): SchemaWithKey["tag"] { return this._payload.tag }

        toJSON(): D {
            return {
                ...this._key.toJSON(),
                ...this._payload.toJSON()
            } as D
        }

        toNDJSON(): D { return this.toJSON() }

        get schema(): GenericTreeNode<SchemaTag> {
            return this._payload.schema(this.key)
        }

        //
        // The merge method at this level does *not* cope with edit-tags like Replace and Remove.
        // That functionality is handled at the StandardForm level: Merge at the Component level
        // is strictly for merging the content of two non-edit Components.
        //
        merge(incoming: this): this {
            const returnValue = new GeneratedComponentClass(this.key)
            if (incoming.key !== this.key) {
                throw new MergeConflictError(`Merge of two unequal keys in ${label}`)
            }
            returnValue._payload = this._payload.merge(incoming._payload)
            return returnValue as this
        }

    }
}
