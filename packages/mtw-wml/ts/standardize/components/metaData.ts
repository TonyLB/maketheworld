import { deepEqual, objectFilterEntries } from "../../lib/objects";
import { schemaToWML } from "../../schema";
import { isImportable, isImportableTag, isSchemaExport, isSchemaImport, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { MergeConflictError } from "../baseClasses";
import { ComponentInterface } from "./abstract";
import { StandardImportData, StandardImportItemData } from "./dataTypes/metaData";
import { editWrap } from "./editable";
import { isSchemaTreeNode } from "./utils";

const isImportData = (value: any): value is StandardImportItemData => {
    return (typeof value === 'object') &&
        'fromKey' in value && typeof value.fromKey === 'string' && value.fromKey &&
        'tag' in value && typeof value.tag === 'string' && isImportableTag(value.tag)
}

class ImportItem {
    _from: string;
    _as?: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
    remove?: boolean;
    match?: ImportItem;

    constructor(node: GenericTreeNode<SchemaTag> | StandardImportItemData) {
        if (isImportData(node)) {
            this._from = node.fromKey
            this._as = node.asKey
            this.tag = node.tag
            this.remove = node.remove
            this.match = node.match ? new ImportItem(node.match) : undefined
        }
        else {
            if (!treeNodeTypeguard(isImportable)(node)) {
                throw new Error('Invalid argument to ImportItem constructor')
            }
            this._from = node.data.from ?? node.data.key
            this._as = node.data.from ? node.data.key : undefined
            this.tag = node.data.tag
        }
    }

    get fromKey() { return this._from }
    get asKey() { return this._as }

    toJSON(): StandardImportItemData {
        return {
            fromKey: this._from,
            asKey: this._as,
            tag: this.tag,
            remove: this.remove,
            match: this.match ? this.match.toJSON() : undefined
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const subjectNode = {
            data: { tag: this.tag, key: this.asKey ?? this.fromKey, from: this.asKey ? this.fromKey : undefined } as SchemaTag,
            children: []
        }
        if (this.remove) {
            return {
                data: { tag: 'Remove' },
                children: [subjectNode]
            }
        }
        if (this.match) {
            const matchNode = {
                data: { tag: this.tag, key: this.match.asKey ?? this.match.fromKey, from: this.match.asKey ? this.match.fromKey : undefined } as SchemaTag,
                children: []
            }
            return {
                data: { tag: 'Replace' },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: [matchNode] },
                    { data: { tag: 'ReplacePayload' }, children: [subjectNode] }
                ]
            }
        }
        return subjectNode
    }

    clone() {
        return new ImportItem(this.toJSON())
    }

    get payload() {
        const payloadValue = new ImportItem(this.toJSON())
        payloadValue.match = undefined
        payloadValue.remove = undefined
        return payloadValue
    }

    merge(incoming: ImportItem): ImportItem | undefined {
        if (incoming.remove) {
            if (this.remove || !deepEqual(this.payload.toJSON(), incoming.payload.toJSON())) {
                throw new MergeConflictError()
            }
            if (this.match) {
                const match = this.match?.clone()
                match.remove = true
                return match
            }
            return undefined
        }
        if (incoming.match) {
            if (this.remove || !deepEqual(this.payload.toJSON(), incoming.match?.toJSON())) {
                throw new MergeConflictError()
            }
            if (this.match) {
                const updateMatch = incoming.clone()
                updateMatch.match = this.match
                return updateMatch
            }
            return incoming.payload
        }
        if (this.remove) {
            const updateMatch = incoming.clone()
            const match = this.clone()
            match.remove = undefined
            updateMatch.match = match
            return updateMatch
        }
        return incoming
    }
}

const extractImportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, ImportItem> => {
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.reduce<Record<string, ImportItem>>((previous, childNode) => ({
            ...previous,
            ...extractImportsMap(childNode, { remove: true })
        }), {})
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const payloadValues = node.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportItem>>((previous, childNode) => ({
            ...previous,
            ...extractImportsMap(childNode)
        }), {})
        return node.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportItem>>((previous, childNode) => {
            const matchValues = extractImportsMap(childNode)
            return Object.entries(matchValues).reduce<Record<string, ImportItem>>((accumulator, [key, matchNode]) => {
                const nodeToAddMatch = Object.values(accumulator).find(({ fromKey }) => (fromKey === matchNode.fromKey))
                if (!nodeToAddMatch) {
                    throw new Error('Unmatched entry in Replace at Import parsing')
                }
                const nodeWithMatchApplied = nodeToAddMatch.clone()
                nodeWithMatchApplied.match = matchNode
                return {
                    ...objectFilterEntries(accumulator, ([key]) => (key !== nodeToAddMatch.asKey)),
                    [key]: nodeWithMatchApplied
                }
            }, previous)
        }, payloadValues)
    }
    if (treeNodeTypeguard(isImportable)(node)) {
        return {
            [node.data.key]: new ImportItem({
                fromKey: node.data.from ?? node.data.key,
                asKey: node.data.from ? node.data.key : undefined,
                tag: node.data.tag,
                remove: options?.remove
            })
        }
    }
    return {}
}

export class StandardImport extends editWrap(class StandardImport implements ComponentInterface  {
    key: string;
    _imports: Record<string, ImportItem>;
    constructor(...allArgs: any[]) {
        const args = allArgs[0]
        if ('tag' in args && args.tag === 'Import') {
            this.key = args.key
            this._imports = args.imports
        }
        else {
            if (!isSchemaTreeNode(args)) {
                throw new Error(`Invalid arguments in StandardImport constructor`)
            }
            if (!treeNodeTypeguard(isSchemaImport)(args)) {
                throw new Error('Type mismatch in StandardImport')
            }
            this.key = args.data.from
            this._imports = args.children.reduce<Record<string, ImportItem>>((previous, node) => {
                return {
                    ...previous,
                    ...extractImportsMap(node)
                }
            }, {})    
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const subjectNode = (arg: StandardImport): GenericTreeNode<SchemaTag> => ({
            data: { tag: 'Import', from: arg.key, mapping: {} },
            children: Object.values(arg._imports)
                .sort((itemA, itemB) => ((itemA.asKey ?? itemA.fromKey).localeCompare(itemB.asKey ?? itemB.fromKey)))
                .map((item) => (item.schema))
        })
        return subjectNode(this)
    }

    toJSON(): StandardImportData {
        return {
            tag: 'Import',
            key: this.key,
            imports: this._imports
        }
    }

    clone(): this {
        return new StandardImport(this.toJSON()) as this
    }

    merge(incoming: this): this | undefined {
        if (incoming.key !== this.key) {
            throw new Error('Source mismatch in StandardImport merge')
        }
        const returnValue = this.clone() as this
        returnValue._imports = Object.entries(incoming._imports).reduce<Record<string, ImportItem>>((previous, [key, incomingItem]) => {
            const baseItem = Object.values(previous).find((baseItem) => (baseItem.fromKey === incomingItem.fromKey))
            if (baseItem) {
                const mergedItem = baseItem.merge(incomingItem)
                const filteredPrevious = objectFilterEntries(previous, ([compareKey]) => (compareKey !== (baseItem.asKey ?? baseItem.fromKey)))
                if (mergedItem) {
                    return {
                        ...filteredPrevious,
                        [mergedItem.asKey ?? mergedItem.fromKey]: mergedItem
                    }
                }
                else {
                    return filteredPrevious
                }
            }
            else {
                return {
                    ...previous,
                    [key]: incomingItem
                }
            }
        }, returnValue._imports)
        return returnValue
    }
}, 'StandardImport'){}

const extractExportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, ImportItem> => {
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.reduce<Record<string, ImportItem>>((previous, childNode) => ({
            ...previous,
            ...extractExportsMap(childNode, { remove: true })
        }), {})
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const payloadValues = node.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportItem>>((previous, childNode) => ({
            ...previous,
            ...extractExportsMap(childNode)
        }), {})
        return node.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportItem>>((previous, childNode) => {
            const matchValues = extractExportsMap(childNode)
            return Object.entries(matchValues).reduce<Record<string, ImportItem>>((accumulator, [key, matchNode]) => {
                const nodeToAddMatch = Object.values(accumulator).find(({ fromKey }) => (fromKey === matchNode.fromKey))
                if (!nodeToAddMatch) {
                    throw new Error('Unmatched entry in Replace at Import parsing')
                }
                const nodeWithMatchApplied = nodeToAddMatch.clone()
                nodeWithMatchApplied.match = matchNode
                return {
                    ...objectFilterEntries(accumulator, ([key]) => (key !== nodeToAddMatch.asKey)),
                    [key]: nodeWithMatchApplied
                }
            }, previous)
        }, payloadValues)
    }
    if (treeNodeTypeguard(isImportable)(node)) {
        return {
            [node.data.key]: new ImportItem({
                fromKey: node.data.key,
                asKey: node.data.as,
                tag: node.data.tag,
                remove: options?.remove
            })
        }
    }
    return {}
}

export class StandardExport extends editWrap(class StandardExport implements ComponentInterface  {
    key: 'export' = 'export';
    _exports: Record<string, ImportItem>;
    constructor(...allArgs: any[]) {
        const args = allArgs[0]
        if ('tag' in args && args.tag === 'Export') {
            this._exports = args.imports
        }
        else {
            if (!isSchemaTreeNode(args)) {
                throw new Error(`Invalid arguments in StandardImport constructor`)
            }
            if (!treeNodeTypeguard(isSchemaExport)(args)) {
                throw new Error('Type mismatch in StandardExport')
            }
            this._exports = args.children.reduce<Record<string, ImportItem>>((previous, node) => {
                return {
                    ...previous,
                    ...extractExportsMap(node)
                }
            }, {})    
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const subjectNode = (arg: StandardExport): GenericTreeNode<SchemaTag> => ({
            data: { tag: 'Export', mapping: {} },
            children: Object.values(arg._exports)
                .sort((itemA, itemB) => ((itemA.asKey ?? itemA.fromKey).localeCompare(itemB.asKey ?? itemB.fromKey)))
                .map((item) => (item.schema))
        })
        return subjectNode(this)
    }

    toJSON(): StandardImportData {
        return {
            tag: 'Import',
            key: this.key,
            imports: this._exports
        }
    }

    clone(): this {
        return new StandardExport(this.toJSON()) as this
    }

    merge(incoming: this): this | undefined {
        if (incoming.key !== this.key) {
            throw new Error('Source mismatch in StandardExport merge')
        }
        const returnValue = this.clone() as this
        returnValue._exports = Object.entries(incoming._exports).reduce<Record<string, ImportItem>>((previous, [key, incomingItem]) => {
            const baseItem = Object.values(previous).find((baseItem) => (baseItem.fromKey === incomingItem.fromKey))
            if (baseItem) {
                const mergedItem = baseItem.merge(incomingItem)
                const filteredPrevious = objectFilterEntries(previous, ([compareKey]) => (compareKey !== baseItem.fromKey))
                if (mergedItem) {
                    return {
                        ...filteredPrevious,
                        [mergedItem.fromKey]: mergedItem
                    }
                }
                else {
                    return filteredPrevious
                }
            }
            else {
                return {
                    ...previous,
                    [key]: incomingItem
                }
            }
        }, returnValue._exports)
        return returnValue
    }
}, 'StandardExport'){}
