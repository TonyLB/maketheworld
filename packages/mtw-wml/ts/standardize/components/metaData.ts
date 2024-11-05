import { isImportable, isSchemaImport, SchemaExitTag, SchemaImportableBase, SchemaImportTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"

type ImportData = {
    fromKey: string;
    tag: Exclude<Extract<SchemaTag, SchemaImportableBase>, SchemaExitTag | SchemaImportTag>["tag"];
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
            if (treeNodeTypeguard(isImportable)(node)) {
                return {
                    ...previous,
                    [node.data.as ?? node.data.key]: {
                        fromKey: node.data.key,
                        tag: node.data.tag
                    }
                }
            }
            return previous
        }, {})
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Import', from: this._from, mapping: {} },
            children: Object.entries(this._imports).map(([key, { fromKey, tag }]): GenericTreeNode<SchemaTag> => ({
                data: { tag, key: fromKey, as: key !== fromKey ? key : undefined } as SchemaTag,
                children: []
            }))
        }
    }

}