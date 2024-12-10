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
import { MergeConflictError, SerializeNDJSONMixin } from "../baseClasses";
import { isLegalKey, nodeFromWML } from "../utils";
import { StandardComponentData } from "./dataTypes";
import { ComponentKey } from "./dataTypes/key"
import { mergeStandardComponentExport, mergeStandardComponentImport, StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { KeyPayload } from "./key";
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace, StandardExportItem, StandardImportItem } from "./metaData";
import { isSchemaTreeNode } from "./utils";

export interface ComponentConstructorMethods<D extends ComponentKey> {
    fromJSON(line: D): void;
    fromSchema(node: GenericTreeNode<SchemaTag>): void;
    merge(incoming: this): this;
    toJSON(): Omit<D, 'key' | 'universalKey'>;
    schema(key: string): GenericTreeNode<SchemaTag>;
    tag: SchemaWithKey["tag"];
}

export interface StandardComponent {
    key: string;
    universalKey?: string;
    withUniversalKey(key: string | undefined): StandardComponent;
    fileName?: string;
    withFileName(key: string | undefined): StandardComponent;
    import?: StandardImportItem;
    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent;
    export?: StandardExportItem;
    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent;
    tag: SchemaWithKey["tag"] | 'Remove' | 'Replace';
    toJSON(): StandardComponentData & SerializeNDJSONMixin;
    toNDJSON(args: { from?: { assetId: string; key: string; }; exportAs?: string; }): StandardComponentData & SerializeNDJSONMixin;
    schema: GenericTreeNode<SchemaTag>;
    merge(incoming: StandardComponent): StandardComponent | undefined;
}

export const componentClassFactory = <D extends StandardComponentData & SerializeNDJSONMixin, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key: KeyPayload;
        _payload: InstanceType<typeof Base>;
        _import?: StandardImportItem;
        _export?: StandardExportItem;
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
        get fileName(): string | undefined { return this._key.fileName }
        get tag(): SchemaWithKey["tag"] { return this._payload.tag }
        get import(): StandardImportItem | undefined { return this._import }
        get export(): StandardExportItem | undefined { return this._export }

        toJSON(): D {
            return {
                ...this._key.toJSON(),
                ...this._payload.toJSON(),
                ...(this.import ? { from: this.import.toJSON() } : {}),
                ...(this.export ? { exportAs: this.export.toJSON() } : {})
            } as D
        }

        toNDJSON(args): D {
            return this.toJSON()
        }

        get schema(): GenericTreeNode<SchemaTag> {
            return this._payload.schema(this.key)
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
                throw new MergeConflictError(`Merge of two unequal keys in ${label}`)
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

        withUniversalKey(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.key)
            returnValue._payload = this._payload
            returnValue._key._fileName = this._key._fileName
            returnValue._key._universalKey = key
            returnValue._import = this._import
            returnValue._export = this._export
            return returnValue
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.key)
            returnValue._payload = this._payload
            returnValue._key._fileName = key
            returnValue._key._universalKey = this._key._universalKey
            returnValue._import = this._import
            returnValue._export = this._export
            return returnValue
        }

        withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.key)
            returnValue._payload = this._payload
            returnValue._key = this._key
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
            returnValue._export = this._export
            return returnValue
        }

        withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.key)
            returnValue._payload = this._payload
            returnValue._key = this._key
            returnValue._import = this._import
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
            return returnValue
        }
    }
}
