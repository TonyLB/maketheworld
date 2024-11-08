import { deepEqual, objectFilterEntries } from "../../lib/objects";
import { schemaToWML } from "../../schema";
import { isImportable, isImportableTag, isSchemaImport, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { MergeConflictError } from "../baseClasses";

type ImportData = {
    fromKey: string;
    asKey?: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
    remove?: boolean;
    match?: ImportData;
}

const isImportData = (value: any): value is ImportData => {
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

    constructor(node: GenericTreeNode<SchemaTag> | ImportData) {
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
            this._from = node.data.key
            this._as = node.data.as
            this.tag = node.data.tag
        }
    }

    get fromKey() { return this._from }
    get asKey() { return this._as }

    toJSON(): ImportData {
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
            data: { tag: this.tag, key: this.fromKey, as: this.asKey } as SchemaTag,
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
                data: { tag: this.tag, key: this.match.fromKey, as: this.match.asKey } as SchemaTag,
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
            [node.data.as ?? node.data.key]: new ImportItem({
                fromKey: node.data.key,
                asKey: node.data.as,
                tag: node.data.tag,
                remove: options?.remove
            })
        }
    }
    return {}
}

export class StandardImport  {
    _from: string;
    _imports: Record<string, ImportItem>;
    _remove?: boolean;
    _match?: StandardImport;
    constructor(args: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRemove)(args)) {
            const childImports = args.children.map((child) => (new StandardImport(child)))
            if (childImports.length !== 1) {
                throw new Error('Remove error in StandardImport')
            }
            this._remove = true
            this._from = childImports[0]._from
            this._imports = childImports[0]._imports
        }
        else if (treeNodeTypeguard(isSchemaReplace)(args)) {
            const payloadValues = args.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1)
            const matchValues = args.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1)
            if (payloadValues.length !== 1 || matchValues.length !== 1) {
                throw new Error('Replace error in StandardImport')
            }
            const payload = new StandardImport(payloadValues[0])
            const match = new StandardImport(matchValues[0])
            this._from = payload._from
            this._imports = payload._imports
            this._match = match
        }
        else {
            if (!treeNodeTypeguard(isSchemaImport)(args)) {
                throw new Error('Type mismatch in StandardImport')
            }
            this._from = args.data.from
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
            data: { tag: 'Import', from: arg._from, mapping: {} },
            children: Object.values(arg._imports)
                .sort((itemA, itemB) => ((itemA.asKey ?? itemA.fromKey).localeCompare(itemB.asKey ?? itemB.fromKey)))
                .map((item) => (item.schema))
        })
        if (this._remove) {
            return {
                data: { tag: 'Remove' as const },
                children: [subjectNode(this)]
            }
        }
        if (this._match) {
            return {
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: [subjectNode(this._match)] },
                    { data: { tag: 'ReplacePayload' }, children: [subjectNode(this)] }
                ]
            }    
        }
        return subjectNode(this)
    }

    merge(incoming: StandardImport): StandardImport {
        if (incoming._from !== this._from) {
            throw new Error('Source mismatch in StandardImport merge')
        }
        const returnValue = new StandardImport(this.schema)
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

}