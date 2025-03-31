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
import { SerializeNDJSONMixin } from "../baseClasses";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { isLegalKey, nodeFromWML } from "../utils";
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses";
import { StandardComponentData } from "./dataTypes";
import { ComponentKey } from "./dataTypes/key"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { KeyPayload } from "./key";
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace, StandardExportItem, StandardImportItem } from "./metaData";
import { isSchemaTreeNode } from "./utils";
import { isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { deepEqual } from "../../lib/objects";
import { StandardReplace } from "./edits";

export type ComponentConstructorMethodsDiff<D extends ComponentKey> = {
    action: 'Replace';
} | {
    action: 'Edit';
    payload: D;
}

export interface ComponentConstructorMethods<D extends ComponentKey> {
    fromJSON(line: D): void;
    fromSchema(node: GenericTreeNode<SchemaTag>): void;
    merge(incoming: this): this;
    toJSON(options?: StandardToJSONOptions): Omit<D, 'key' | 'universalKey'>;
    schema(key: string): GenericTreeNode<SchemaTag>;
    nestedSchema?(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag>;
    tag: ComponentTag;
    referencedKeys(): StandardComponentReferenceKey[];
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this;
}

export const componentClassFactory = <D extends StandardComponentData & SerializeNDJSONMixin, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key: KeyPayload;
        _payload: InstanceType<typeof Base>;
        _import?: StandardImportItem;
        _export?: StandardExportItem;
        constructor(props: string | D | GenericTreeNode<SchemaTag> | GeneratedComponentClass) {
            this._payload = new Base() as InstanceType<typeof Base>
            if (props instanceof GeneratedComponentClass) {
                this._key = new KeyPayload(props._key)
                this._payload = props._payload
                this._import = props._import
                this._export = props._export
                return
            }
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
        get fileName(): string | undefined { return this._key.fileName }
        get tag(): ComponentTag { return this._payload.tag }
        get import(): StandardImportItem | undefined { return this._import }
        get export(): StandardExportItem | undefined { return this._export }
        get global(): boolean | undefined { return true }

        clone(): StandardComponent {
            return new GeneratedComponentClass(this)
        }

        mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._payload = returnValue._payload.mapContents(callback)
            return returnValue
        }

        toJSON(options?: StandardToJSONOptions): D {
            return {
                ...this._key.toJSON(options),
                ...this._payload.toJSON(options),
                ...(this.import ? { from: this.import.toJSON() } : {}),
                ...(this.export ? { exportAs: this.export.toJSON() } : {})
            } as D
        }

        get schema(): GenericTreeNode<SchemaTag> {
            return this._payload.schema(this.key)
        }

        nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
            return this._payload.nestedSchema
                ? this._payload.nestedSchema(byId, { ...options, localKey: options.localKey ?? this.key, globalKey: options.globalKey ?? this.key })
                : this._payload.schema(options.localKey ?? this.key)
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
            const returnValue = new GeneratedComponentClass(this.key)
            if (incoming.key !== this.key) {
                throw new MergeConflictError(`Merge of two unequal keys in ${label} (${this.key} vs ${incoming.key})`)
            }
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new MergeConflictError(`Merge of two unequal universalKeys in ${label}`)
            }
            returnValue._key._universalKey = this.universalKey ?? incoming.universalKey
            returnValue._key._fileName = incoming.fileName ?? this.fileName
            returnValue._payload = this._payload.merge((incoming as any)._payload)
            //
            // Merge base and incoming import and export
            //
            returnValue._import = (this.import && incoming.import) ? this.import.merge(incoming.import) : this.import ?? incoming.import
            returnValue._export = (this.export && incoming.export) ? this.export.merge(incoming.export) : this.export ?? incoming.export

            return returnValue as StandardComponent
        }

        diff(incoming: StandardComponent): StandardComponent | undefined {
            if (this.key !== incoming.key) {
                throw new Error(`Mismatched keys in StandardComponent diff (${this.key} vs ${incoming.key})`)
            }
            if (deepEqual(this.toJSON(), incoming.toJSON())) {
                return undefined
            }
            else {
                return new StandardReplace(this, incoming)
            }
        }

        withKey(key: string): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            const newKey = new KeyPayload(returnValue._key)
            newKey._key = key
            returnValue._key = newKey
            return returnValue
        }

        withUniversalKey(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key._universalKey = key
            return returnValue
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key._fileName = key
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
