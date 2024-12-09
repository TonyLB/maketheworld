import { deepEqual, objectFilterEntries, objectMap } from "../../lib/objects";
import { isImportable, isImportableTag, isSchemaExport, isSchemaImport, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { unwrapSubject, wrappedNodeTypeGuard } from "../../schema/utils";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { MergeConflictError } from "../baseClasses";
import { ComponentInterface } from "./abstract";
import { StandardComponentImport, StandardComponentImportContent, StandardComponentImportRemove, StandardComponentImportReplace, StandardImportData, StandardImportItemData } from "./dataTypes/metaData";
import { editWrap } from "./editable";
import { isSchemaTreeNode } from "./utils";

const isImportData = (value: any): value is StandardImportItemData => {
    return (typeof value === 'object') &&
        'key' in value && typeof value.key === 'string' && value.key &&
        'tag' in value && typeof value.tag === 'string' && isImportableTag(value.tag)
}

export interface StandardImportItem {
    toJSON(): StandardComponentImport;
    merge(incoming: StandardImportItem): StandardImportItem | undefined;
    assetId: string;
    fromKey: string;
}

export class ImportItemContent implements StandardImportItem {
    _assetId: string;
    _fromKey: string;

    constructor(assetId: string, fromKey: string) {
        this._assetId = assetId
        this._fromKey = fromKey
    }

    get assetId() { return this._assetId }
    get fromKey() { return this._fromKey }

    toJSON(): StandardComponentImportContent {
        return {
            action: 'Content',
            payload: {
                assetId: this.assetId,
                fromKey: this.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemContent) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return this
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemRemove) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return undefined
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemReplace) {
            if (this.assetId === incoming.assetId && this.fromKey === incoming.fromKey) {
                return new ImportItemContent(incoming._payload.assetId, incoming._payload.fromKey)
            }
            throw new MergeConflictError()
        }
        return undefined
    }
}

export class ImportItemRemove implements StandardImportItem {
    _assetId: string;
    _fromKey: string;

    constructor(assetId: string, fromKey: string) {
        this._assetId = assetId
        this._fromKey = fromKey
    }

    get assetId() { return this._assetId }
    get fromKey() { return this._fromKey }

    toJSON(): StandardComponentImportRemove {
        return {
            action: 'Remove',
            match: {
                assetId: this.assetId,
                fromKey: this.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemRemove || incoming instanceof ImportItemReplace) {
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemContent) {
            return new ImportItemReplace(
                { assetId: this.assetId, fromKey: this.fromKey },
                { assetId: incoming.assetId, fromKey: incoming.fromKey }
            )
        }
        return undefined
    }
}

export class ImportItemReplace implements StandardImportItem {
    _match: {
        assetId: string;
        fromKey: string;    
    }
    _payload: {
        assetId: string;
        fromKey: string;    
    }

    constructor(match: { assetId: string, fromKey: string }, payload: { assetId: string, fromKey: string }) {
        this._payload = payload
        this._match = match
    }

    get assetId() { return this._match.assetId }
    get fromKey() { return this._match.fromKey }

    toJSON(): StandardComponentImportReplace {
        return {
            action: 'Replace',
            match: {
                assetId: this.assetId,
                fromKey: this.fromKey
            },
            payload: {
                assetId: this._payload.assetId,
                fromKey: this._payload.fromKey
            }
        }
    }

    merge(incoming: StandardImportItem): StandardImportItem | undefined {
        if (incoming instanceof ImportItemReplace) {
            if (this._payload.assetId === incoming.assetId && this._payload.fromKey === incoming.fromKey) {
                return new ImportItemReplace(
                    this._match,
                    incoming._payload
                )
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemRemove) {
            if (this._payload.assetId === incoming.assetId && this._payload.fromKey === incoming.fromKey) {
                return new ImportItemRemove(this.assetId, this.fromKey)
            }
            throw new MergeConflictError()
        }
        if (incoming instanceof ImportItemContent) {
            const mergedPayload = new ImportItemContent(this._payload.assetId, this._payload.fromKey).merge(incoming)
            if (!mergedPayload) {
                throw new MergeConflictError()
            }
            return new ImportItemReplace(
                this._match,
                { assetId: mergedPayload.assetId, fromKey: mergedPayload.fromKey }
            )
        }
        return undefined
    }
}

// export class ExportItem extends editWrap(class ExportItem implements ComponentInterface {
//     _from: string;
//     _as?: string;
//     tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];

//     constructor(node: GenericTreeNode<SchemaTag> | StandardImportItemData) {
//         if (isImportData(node)) {
//             this._from = node.key
//             this._as = node.asKey
//             this.tag = node.tag
//         }
//         else {
//             if (!treeNodeTypeguard(isImportable)(node)) {
//                 throw new Error('Invalid argument to ExportItem constructor')
//             }
//             this._from = node.data.key
//             this._as = node.data.as ? node.data.as : undefined
//             this.tag = node.data.tag
//         }
//     }

//     get key() { return this._from }
//     get asKey() { return this._as }

//     withUniversalKey(key: string): this {
//         return this
//     }

//     toJSON(): StandardImportItemData {
//         return {
//             key: this._from,
//             asKey: this._as,
//             tag: this.tag
//         }
//     }

//     get schema(): GenericTreeNode<SchemaTag> {
//         const subjectNode = {
//             data: { tag: this.tag, key: this.key, as: this.asKey } as SchemaTag,
//             children: []
//         }
//         return subjectNode
//     }

//     clone(): this {
//         return new ExportItem(this.toJSON()) as this
//     }

//     merge(incoming: ExportItem): this | undefined {
//         return incoming as this
//     }
// }, 'StandardExport', { typeGuard: isImportData }){}

// const extractImportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, StandardImportItem> => {
//     if (wrappedNodeTypeGuard(isImportable)(node)) {
//         const subject = unwrapSubject(node)
//         if (subject && treeNodeTypeguard(isImportable)(subject)) {
//             return {
//                 [subject.data.key]: new ImportItem(node)
//             }
//         }
//     }
//     return {}
// }

// export class StandardImport extends editWrap(class StandardImport implements ComponentInterface  {
//     key: string;
//     _imports: Record<string, StandardImportItem>;
//     _universalKey?: string;
//     constructor(...allArgs: any[]) {
//         const args = allArgs[0]
//         if ('tag' in args && args.tag === 'Import') {
//             this.key = args.key
//             this._imports = objectMap(args.imports, (importData: StandardImportItemData) => (new ImportItem(importData)))
//         }
//         else {
//             if (!isSchemaTreeNode(args)) {
//                 throw new Error(`Invalid arguments in StandardImport constructor`)
//             }
//             if (!treeNodeTypeguard(isSchemaImport)(args)) {
//                 throw new Error('Type mismatch in StandardImport')
//             }
//             this.key = args.data.from
//             this._imports = args.children.reduce<Record<string, StandardImportItem>>((previous, node) => {
//                 return {
//                     ...previous,
//                     ...extractImportsMap(node)
//                 }
//             }, {})    
//         }
//     }

//     get schema(): GenericTreeNode<SchemaTag> {
//         const subjectNode = (arg: StandardImport): GenericTreeNode<SchemaTag> => ({
//             data: { tag: 'Import', from: arg.key, mapping: {} },
//             children: Object.values(arg._imports)
//                 .sort((itemA, itemB) => ((itemA.asKey ?? itemA.fromKey).localeCompare(itemB.asKey ?? itemB.fromKey)))
//                 .map((item) => (item.schema))
//         })
//         return subjectNode(this)
//     }
//     get universalKey(): string | undefined { return this._universalKey }

//     toJSON(): StandardImportData {
//         return {
//             tag: 'Import',
//             key: this.key,
//             imports: objectMap(this._imports, (importItem) => (importItem.toJSON())) as Record<string, StandardImportItemData>
//         }
//     }

//     clone(): this {
//         return new StandardImport(this.toJSON()) as this
//     }

//     merge(incoming: this): this | undefined {
//         if (incoming.key !== this.key) {
//             throw new Error('Source mismatch in StandardImport merge')
//         }
//         const returnValue = this.clone() as this
//         returnValue._imports = Object.entries(incoming._imports).reduce<Record<string, StandardImportItem>>((previous, [key, incomingItem]) => {
//             const baseItem = Object.values(previous).find((baseItem) => (baseItem.fromKey === incomingItem.fromKey))
//             if (baseItem) {
//                 const mergedItem = baseItem.merge(incomingItem)
//                 const filteredPrevious = objectFilterEntries(previous, ([compareKey]) => (compareKey !== (baseItem.asKey ?? baseItem.fromKey)))
//                 if (mergedItem) {
//                     return {
//                         ...filteredPrevious,
//                         [mergedItem.asKey ?? mergedItem.fromKey]: mergedItem
//                     }
//                 }
//                 else {
//                     return filteredPrevious
//                 }
//             }
//             else {
//                 return {
//                     ...previous,
//                     [key]: incomingItem
//                 }
//             }
//         }, returnValue._imports)
//         return returnValue
//     }

//     withUniversalKey(key: string): this {
//         const returnValue = this.clone()
//         returnValue._universalKey = key
//         return returnValue
//     }
// }, 'StandardImport'){}

// const extractExportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, ExportItem> => {
//     if (wrappedNodeTypeGuard(isImportable)(node)) {
//         const subject = unwrapSubject(node)
//         if (subject && treeNodeTypeguard(isImportable)(subject)) {
//             return {
//                 [subject.data.key]: new ExportItem(node)
//             }
//         }
//     }
//     return {}
// }

// export class StandardExport extends editWrap(class StandardExport implements ComponentInterface  {
//     key: 'export' = 'export';
//     _exports: Record<string, ExportItem>;
//     constructor(...allArgs: any[]) {
//         const args = allArgs[0]
//         if ('tag' in args && args.tag === 'Import') {
//             this._exports = objectMap(args.imports, (importData: StandardImportItemData) => (new ExportItem(importData)))
//         }
//         else {
//             if (!isSchemaTreeNode(args)) {
//                 throw new Error(`Invalid arguments in StandardExport constructor`)
//             }
//             if (!treeNodeTypeguard(isSchemaExport)(args)) {
//                 throw new Error('Type mismatch in StandardExport')
//             }
//             this._exports = args.children.reduce<Record<string, ExportItem>>((previous, node) => {
//                 return {
//                     ...previous,
//                     ...extractExportsMap(node)
//                 }
//             }, {})    
//         }
//     }

//     get schema(): GenericTreeNode<SchemaTag> {
//         const subjectNode = (arg: StandardExport): GenericTreeNode<SchemaTag> => ({
//             data: { tag: 'Export', mapping: {} },
//             children: Object.values(arg._exports)
//                 .sort((itemA, itemB) => ((itemA.asKey ?? itemA.key).localeCompare(itemB.asKey ?? itemB.key)))
//                 .map((item) => (item.schema))
//         })
//         return subjectNode(this)
//     }
//     get universalKey(): string | undefined { return undefined }

//     toJSON(): StandardImportData {
//         return {
//             tag: 'Import',
//             key: this.key,
//             imports: this._exports
//         }
//     }

//     clone(): this {
//         return new StandardExport(this.toJSON()) as this
//     }

//     merge(incoming: this): this | undefined {
//         if (incoming.key !== this.key) {
//             throw new Error('Source mismatch in StandardExport merge')
//         }
//         const returnValue = this.clone() as this
//         returnValue._exports = Object.entries(incoming._exports).reduce<Record<string, ExportItem>>((previous, [key, incomingItem]) => {
//             const baseItem = Object.values(previous).find((baseItem) => (baseItem.key === incomingItem.key))
//             if (baseItem) {
//                 const mergedItem = baseItem.merge(incomingItem)
//                 const filteredPrevious = objectFilterEntries(previous, ([compareKey]) => (compareKey !== baseItem.key))
//                 if (mergedItem) {
//                     return {
//                         ...filteredPrevious,
//                         [mergedItem.key]: mergedItem
//                     }
//                 }
//                 else {
//                     return filteredPrevious
//                 }
//             }
//             else {
//                 return {
//                     ...previous,
//                     [key]: incomingItem
//                 }
//             }
//         }, returnValue._exports)
//         return returnValue
//     }

//     withUniversalKey(key: string): this {
//         return this
//     }
// }, 'StandardExport'){}
