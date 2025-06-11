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
import { ComponentKey, hasComponentKey } from "./dataTypes/key"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { KeyPayload } from "./key";
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace, StandardExportItem, StandardImportItem } from "./metaData";
import { isSchemaTreeNode, nodeFromWML } from "../../schema";
import { ComponentUUID, isSchemaComponent, isSchemaComponentTag, isSchemaComponentUUID, isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { deepEqual } from "../../lib/objects";
import { StandardReplace } from "./edits";
import { StandardComponentData, StandardFormSubsetRequest } from "../baseClasses";
import { mapReferenceToFormat, ReferenceFormat } from "./utils/references";
import { StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { isStandardReferenceData, StandardReferenceSimple, StandardKey } from "./reference";

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
    remapReferences?: (props: { mappings: { key: string; universalKey: ComponentUUID }[], mapTo: ReferenceFormat }) => this;
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this;
}

export const componentClassFactory = <D extends StandardComponentData, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key: StandardKey;
        _payload: InstanceType<typeof Base>;
        _import?: StandardImportItem;
        _export?: StandardExportItem;
        leastCommonContext: StandardReferenceSimple[];
        constructor(props: string | D | GenericTreeNode<SchemaTag> | GeneratedComponentClass) {
            this._payload = new Base() as InstanceType<typeof Base>
            if (props instanceof GeneratedComponentClass) {
                this._key = new StandardKey(props._key)
                this._payload = props._payload
                this._import = props._import
                this._export = props._export
                this.leastCommonContext = props.leastCommonContext.map((context) => (context.clone()))
                return
            }
            if (typeof props === 'string' && isLegalKey(props)) {
                this._key = new StandardKey({
                    tag: this._payload.tag,
                    key: props
                })
                this.leastCommonContext = []
                return
            }
            if (typeof props === 'string' && isSchemaComponentUUID(props)) {
                this._key = new StandardKey(props)
                this.leastCommonContext = []
                return
            }
            if (isSchemaTreeNode(props) || typeof props === 'string') {
                const node = typeof props === 'string'
                    ? nodeFromWML(props)
                    : props
                if (!treeNodeTypeguard(isSchemaWithKey)(node)) {
                    throw new Error(`No key found in ${label} constructor call.`)
                }
                const tag = node.data.tag
                if (!isSchemaComponentTag(tag)) {
                    throw new Error(`Invalid schema node type in ${label} constructor call: ${node.data.tag}`)
                }
                this._key = new StandardKey({ tag, key: node.data.key, universalKey: 'uuid' in node.data ? node.data.uuid : undefined })
                this._payload.fromSchema(node)
                this.leastCommonContext = []
                return
            }
            this._key = isStandardReferenceData(props) ? new StandardKey(props) : (typeof props === 'string' ? new StandardKey(props) : new StandardKey(''))
            this._payload.fromJSON(props)
            this.leastCommonContext = []
        }

        get key(): string | undefined { return this._key.key }
        get universalKey(): ComponentUUID | undefined { return this._key.universalKey }
        get fileName(): string | undefined { return undefined }
        get tag(): ComponentTag { return this._payload.tag }
        get import(): StandardImportItem | undefined { return this._import }
        get export(): StandardExportItem | undefined { return this._export }
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

        remapReferences(props: { mappings: { key: string; universalKey: ComponentUUID; }[]; mapTo: ReferenceFormat; }): StandardComponent {
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
                ...this._payload.toJSON(options),
                ...(this.import ? { from: this.import.toJSON() } : {}),
                ...(this.export ? { exportAs: this.export.toJSON() } : {})
            } as D
        }

        get schema(): GenericTreeNode<SchemaTag> {
            return this._payload.schema(this.key, this.universalKey)
        }

        nestedSchema(lookup: (value: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
            const { context } = options
            const contextKey = new StandardKey(this._key)
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
                    this.leastCommonContext.length > 0 &&
                    this.leastCommonContext.slice(-1)[0].payload.equals(context.slice(-1)[0])
                )
                : Boolean((this.leastCommonContext?.length ?? 0) === 0)

            if (!inLeastCommonContext) {
                const reference = (new StandardReference(this.key ?? this.universalKey))
                return reference.schema[0]
            }
            return this._payload.nestedSchema
                ? this._payload.nestedSchema(lookup, { ...options, key: contextKey, context: newContext, inLeastCommonContext })
                : this._payload.schema(this.key, this.universalKey)
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
            returnValue._key = this._key.merge(incoming._key)
            returnValue._payload = this._payload.merge((incoming as any)._payload)
            //
            // Merge base and incoming import and export
            //
            returnValue._import = (this.import && incoming.import) ? this.import.merge(incoming.import) : this.import ?? incoming.import
            returnValue._export = (this.export && incoming.export) ? this.export.merge(incoming.export) : this.export ?? incoming.export
            returnValue.leastCommonContext = this.leastCommonContext.filter((reference) => (
                incoming.leastCommonContext.some((incomingReference) => (
                    reference.equals(incomingReference)
                ))
            ))

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
                const leastCommonContext = this.leastCommonContext.filter((reference) => (
                    incoming.leastCommonContext.some((incomingReference) => (
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

        withLeastCommonContext(leastCommonContext: StandardReferenceSimple[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue.leastCommonContext = leastCommonContext.map((context) => (context.clone()))
            return returnValue
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // returnValue._key._fileName = key
            return returnValue
        }

        withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            if (importData) {
                let importItem: StandardImportItem | undefined = undefined

                if (importData instanceof ImportItemContent || importData instanceof ImportItemRemove || importData instanceof ImportItemReplace) {
                    importItem = importData
                }
                else if ('action' in importData) {
                    switch(importData.action) {
                        case 'Content':
                            importItem = new ImportItemContent(importData.payload.assetId, importData.payload.fromKey)
                            break
                        case 'Remove':
                            importItem = new ImportItemRemove(importData.match.assetId, importData.match.fromKey)
                            break
                        case 'Replace':
                            importItem = new ImportItemReplace(
                                { assetId: importData.match.assetId, fromKey: importData.match.fromKey },
                                { assetId: importData.payload.assetId, fromKey: importData.payload.fromKey }
                            )
                            break
                    }
                }
                if (importItem) {
                    returnValue._import = importItem
                }
            }
            else {
                returnValue._import = undefined
            }
            return returnValue
        }

        withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            if (exportData) {
                let exportItem: StandardExportItem | undefined = undefined

                if (typeof exportData === 'string') {
                    exportItem = new ExportItemContent(exportData)
                }
                else if (exportData instanceof ExportItemContent || exportData instanceof ExportItemRemove || exportData instanceof ExportItemReplace) {
                    exportItem = exportData
                }
                else if ('action' in exportData) {
                    switch(exportData.action) {
                        case 'Content':
                            exportItem = new ExportItemContent(exportData.payload)
                            break
                        case 'Remove':
                            exportItem = new ExportItemRemove(exportData.match)
                            break
                        case 'Replace':
                            exportItem = new ExportItemReplace(exportData.match, exportData.payload)
                            break
                    }
                }
                if (exportItem) {
                    returnValue._export = exportItem
                }
            }
            else {
                returnValue._export = undefined
            }
            return returnValue
        }
    }
}
