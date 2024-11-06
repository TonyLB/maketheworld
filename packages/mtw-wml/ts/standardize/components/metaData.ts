import { objectFilterEntries } from "../../lib/objects";
import { isImportable, isSchemaImport, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"

type ImportData = {
    fromKey: string;
    asKey?: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
    remove?: boolean;
    match?: ImportData;
}

const extractImportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, ImportData> => {
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.reduce<Record<string, ImportData>>((previous, childNode) => ({
            ...previous,
            ...extractImportsMap(childNode, { remove: true })
        }), {})
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const payloadValues = node.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportData>>((previous, childNode) => ({
            ...previous,
            ...extractImportsMap(childNode)
        }), {})
        return node.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1).reduce<Record<string, ImportData>>((previous, childNode) => {
            const matchValues = extractImportsMap(childNode)
            return Object.entries(matchValues).reduce<Record<string, ImportData>>((accumulator, [key, matchNode]) => {
                const nodeToAddMatch = Object.values(accumulator).find(({ fromKey, asKey }) => (fromKey === matchNode.fromKey))
                if (!nodeToAddMatch) {
                    throw new Error('Unmatched entry in Replace at Import parsing')
                }
                return {
                    ...objectFilterEntries(accumulator, ([key]) => (key !== nodeToAddMatch.asKey)),
                    [key]: {
                        ...nodeToAddMatch,
                        match: matchNode
                    }
                }
            }, previous)
        }, payloadValues)

    }
    if (treeNodeTypeguard(isImportable)(node)) {
        return {
            [node.data.as ?? node.data.key]: {
                fromKey: node.data.key,
                asKey: node.data.as,
                tag: node.data.tag,
                remove: options?.remove
            }
        }
    }
    return {}
}

export class StandardImport  {
    _from: string;
    _imports: Record<string, ImportData>;
    constructor(args: GenericTreeNode<SchemaTag>) {
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

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Import', from: this._from, mapping: {} },
            children: Object.values(this._imports).map(({ fromKey, asKey, tag, remove, match }): GenericTreeNode<SchemaTag> => {
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
        }
    }

}