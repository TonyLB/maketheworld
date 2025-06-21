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

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { isLegalKey } from "../utils";
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses";
import { ComponentKey } from "./dataTypes/key"
import { isSchemaTreeNode, nodeFromWML } from "../../schema";
import { AssetUUID, ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { deepEqual } from "../../lib/objects";
import { StandardReplace } from "./edits";
import { StandardComponentData, StandardFormSubsetRequest } from "../baseClasses";
import { mapReferenceToFormat, ReferenceFormat } from "./utils/references";
import { isStandardReferencePayloadData, StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { StandardKey } from "./reference";

export type ComponentConstructorMethodsDiff<D extends ComponentKey> = {
    action: 'Replace';
} | {
    action: 'Edit';
    payload: D;
}

export interface ComponentConstructorMethods<D> {
    fromJSON(line: D): void;
    fromSchema(node: GenericTreeNode<SchemaTag>): void;
    subset(options: StandardFormSubsetRequest): this;
    merge(incoming: this): this;
    toJSON(options?: StandardToJSONOptions): Omit<D, 'key' | 'universalKey'>;
    schema(key?: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag>;
    nestedSchema?(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag>;
    tag: ComponentTag;
    referencedKeys(): StandardComponentReferenceKey[];
    remapReferences?: (props: { mappings: StandardKey[], mapTo: ReferenceFormat }) => this;
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this;
}

export const componentClassFactory = <D extends StandardComponentData, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key: StandardKey;
        _payload: InstanceType<typeof Base>;
        _from?: AssetUUID;
        constructor(props: string | D | GenericTreeNode<SchemaTag> | GeneratedComponentClass) {
            this._payload = new Base() as InstanceType<typeof Base>
            if (props instanceof GeneratedComponentClass) {
                this._key = new StandardKey(props._key)
                this._payload = props._payload
                this._from = props._from
                return
            }
            if (typeof props === 'string' && isLegalKey(props)) {
                this._key = new StandardKey({
                    tag: this._payload.tag,
                    key: props
                })
                return
            }
            if (typeof props === 'string' && isSchemaComponentUUID(props)) {
                this._key = new StandardKey(props)
                return
            }
            if (isSchemaTreeNode(props) || typeof props === 'string') {
                const node = typeof props === 'string'
                    ? nodeFromWML(props)
                    : props
                if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                    throw new Error(`Invalid schema node type in ${label} constructor call: ${node.data.tag}`)
                }
                const tag = node.data.tag
                this._key = new StandardKey({ tag, key: node.data.key, universalKey: 'uuid' in node.data ? node.data.uuid : undefined })
                this._from = node.data.from
                this._payload.fromSchema(node)
                return
            }
            this._key = isStandardReferencePayloadData(props) ? new StandardKey(props) : typeof props === 'string' ? new StandardKey(props) : new StandardKey('')
            this._payload.fromJSON(props)
        }

        get key(): string | undefined { return this._key.key }
        get universalKey(): ComponentUUID | undefined { return this._key.universalKey }
        get fileName(): string | undefined { return undefined }
        get tag(): ComponentTag { return this._payload.tag }
        get global(): boolean | undefined { return true }
        get referenceData(): StandardReferenceData {
            if (this.universalKey && !this.key) {
                return this.universalKey
            }
            return {
                tag: this.tag,
                key: this.key,
                universalKey: this.universalKey,
            }
        }

        clone(): StandardComponent {
            return new GeneratedComponentClass(this)
        }

        mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._payload = returnValue._payload.mapContents(callback)
            return returnValue
        }

        remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat; }): StandardComponent {
            if (this._payload.remapReferences) {
                const returnValue = this.clone() as GeneratedComponentClass
                returnValue._payload = returnValue._payload.remapReferences?.(props) ?? returnValue._payload
                return returnValue
            }
            return this
        }

        toJSON(options?: StandardToJSONOptions): D {
            return {
                key: this.key,
                universalKey: this.universalKey,
                context: (this._key?.context ?? []).length > 0 ? (this._key.context ?? []).map((context) => context.toJSON()) : undefined,
                ...this._payload.toJSON(options),
                ...(this._from ? { from: this._from } : {}),
            } as D
        }

        get schema(): GenericTreeNode<SchemaTag> {
            const payload = this._payload.schema(this.key, this.universalKey)
            if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
            }
            return { ...payload, data: { ...payload.data, from: this._from } }
        }

        nestedSchema(lookup: (value: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
            const { context } = options
            const contextKey = this._key.plain
            const newContext = [...(context ?? []), contextKey]
            //
            // inLeastCommonContext should not actually check the *whole* context, because while a sub-element of (say)
            // a global-level element might have a leastCommonContext that shows that it was defined in the context of a
            // room where its parent was referenced, the only relevant questions are whether:
            //   (a) the element is being rendered in the context of its highest-level direct parent, and
            //   (b) the parent has determined that *it* is in the correct context to render
            //
            const inLeastCommonContext = context?.length > 0
                ? Boolean(
                    (this._key?.context ?? []).length > 0 &&
                    (this._key?.context ?? []).slice(-1)[0].equals(context.slice(-1)[0])
                )
                : Boolean((this._key?.context?.length ?? 0) === 0)

            if (!inLeastCommonContext) {
                const reference = mapReferenceToFormat([this._key], 'key')(new StandardReference(this._key))
                return reference.schema[0]
            }
            if (this._payload.nestedSchema) {
                const payload = this._payload.nestedSchema(lookup, { ...options, key: contextKey, context: newContext, inLeastCommonContext })
                if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                    throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
                }
                return { ...payload, data: { ...payload.data, from: this._from } }
            }
                
            return this._payload.schema(this.key, this.universalKey)
        }

        referencedKeys(): StandardComponentReferenceKey[] {
            return this._payload.referencedKeys()
        }

        //
        // The merge method at this level does *not* cope with edit-tags like Replace and Remove.
        // That functionality is handled at the StandardForm level: Merge at the Component level
        // is strictly for merging the content of two non-edit Components. It will, however, merge
        // edit tags on the import and export information of the components
        //
        merge(incoming: StandardComponent): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.universalKey ?? this.key ??'')
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new MergeConflictError(`Merge of two unequal universalKeys in ${label}`)
            }
            if (this.key && incoming.key && this.key !== incoming.key) {
                throw new MergeConflictError(`Merge of two unequal keys in ${label}`)
            }
            if (this._from && incoming._from && this._from !== incoming._from) {
                throw new MergeConflictError(`Merge of two unequal 'from' values in ${label}`)
            }
            returnValue._key = this._key.merge(incoming._key)
            returnValue._from = this._from ?? incoming._from
            returnValue._payload = this._payload.merge((incoming as any)._payload)

            return returnValue as StandardComponent
        }

        diff(incoming: StandardComponent): StandardComponent | undefined {
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new Error(`Mismatched universalKeys in StandardComponent diff (${this.key} vs ${incoming.key})`)
            }
            if (deepEqual(this.toJSON(), incoming.toJSON())) {
                return undefined
            }
            else {
                const leastCommonContext = (this._key?.context ?? []).filter((reference) => (
                    (incoming._key?.context ?? []).some((incomingReference) => (
                        reference.equals(incomingReference)
                    ))
                ))

                return new StandardReplace(this, incoming).withLeastCommonContext(leastCommonContext)
            }
        }

        subset(options: StandardFormSubsetRequest): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._key = this._key
            returnValue._payload = this._payload.subset(options)
            return returnValue
        }

        withKey(key: string): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key.key = key
            return returnValue
        }

        withUniversalKey(key: ComponentUUID | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key.universalKey = key
            return returnValue
        }

        withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            const newContext = leastCommonContext.map((context) => (context.clone()))
            returnValue._key.context = newContext.length > 0 ? newContext : undefined
            return returnValue
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // returnValue._key._fileName = key
            return returnValue
        }

    }
}
