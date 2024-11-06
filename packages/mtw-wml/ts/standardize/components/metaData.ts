import { isImportable, isSchemaImport, isSchemaRemove, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"

type ImportData = {
    fromKey: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
    remove?: boolean;
}

const extractImportsMap = (node: GenericTreeNode<SchemaTag>, options?: { remove?: boolean }): Record<string, ImportData> => {
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.reduce<Record<string, ImportData>>((previous, childNode) => ({
            ...previous,
            ...extractImportsMap(childNode, { remove: true })
        }), {})
    }
    if (treeNodeTypeguard(isImportable)(node)) {
        return {
            [node.data.as ?? node.data.key]: {
                fromKey: node.data.key,
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
            children: Object.entries(this._imports).map(([key, { fromKey, tag, remove }]): GenericTreeNode<SchemaTag> => {
                const subjectNode = {
                    data: { tag, key: fromKey, as: key !== fromKey ? key : undefined } as SchemaTag,
                    children: []
                }
                if (remove) {
                    return {
                        data: { tag: 'Remove' },
                        children: [subjectNode]
                    }
                }
                return subjectNode
            })
        }
    }

}