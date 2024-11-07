import { objectFilterEntries } from "../../lib/objects";
import { isImportable, isImportableTag, isSchemaImport, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"

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
    match?: ImportData;

    constructor(node: GenericTreeNode<SchemaTag> | ImportData) {
        if (isImportData(node)) {
            this._from = node.fromKey
            this._as = node.asKey
            this.tag = node.tag
            this.remove = node.remove
            this.match = node.match
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

    clone() {
        return new ImportItem({
            fromKey: this._from,
            asKey: this._as,
            tag: this.tag,
            remove: this.remove,
            match: this.match
        })
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
    _imports: Record<string, ImportData>;
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
            this._imports = args.children.reduce<Record<string, ImportData>>((previous, node) => {
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
            children: Object.values(arg._imports).map(({ fromKey, asKey, tag, remove, match }): GenericTreeNode<SchemaTag> => {
                const subjectNode = {
                    data: { tag, key: fromKey, as: asKey } as SchemaTag,
                    children: []
                }
                if (remove) {
                    return {
                        data: { tag: 'Remove' },
                        children: [subjectNode]
                    }
                }
                if (match) {
                    const matchNode = {
                        data: { tag, key: match.fromKey, as: match.asKey } as SchemaTag,
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
            })
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
        returnValue._imports = Object.assign(returnValue._imports, incoming._imports)
        return returnValue
    }

}