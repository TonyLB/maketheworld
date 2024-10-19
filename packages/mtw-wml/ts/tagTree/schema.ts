import TagTree, { TagTreeFilterArguments, TagTreePruneArgs } from "."
import { deepEqual } from "../lib/objects"
import { GenericTree, treeNodeTypeguard } from "../tree/baseClasses"
import { SchemaTag, isSchemaCondition, isSchemaConditionStatement, isSchemaImport, isSchemaReplace, isSchemaWithKey } from "../schema/baseClasses"
import { v4 as uuidv4 } from 'uuid'

const addWrapperKey = (tree: GenericTree<SchemaTag, Partial<{ inherited: boolean }>>): GenericTree<SchemaTag, Partial<{ inherited: boolean }>> => {
    return tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node) || treeNodeTypeguard(isSchemaReplace)(node)) {
            return { ...node, data: { ...node.data, wrapperKey: node.data.wrapperKey ?? uuidv4() }, children: addWrapperKey(node.children) }
        }
        return { ...node, children: addWrapperKey(node.children) }
    })
}

const removeWrapperKey = (tree: GenericTree<SchemaTag, Partial<{ inherited: boolean }>>): GenericTree<SchemaTag, Partial<{ inherited: boolean }>> => {
    return tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node) || treeNodeTypeguard(isSchemaReplace)(node)) {
            const { wrapperKey, ...data } = node.data
            return { ...node, data, children: removeWrapperKey(node.children) }
        }
        return { ...node, children: removeWrapperKey(node.children) }
    })
}

export class SchemaTagTree extends TagTree<SchemaTag, Partial<{ inherited: boolean }>> {
    constructor(tree: GenericTree<SchemaTag, Partial<{ inherited: boolean }>>) {
        super({
            tree: addWrapperKey(tree),
            compare: ({ data: A }, { data: B }) => {
                if (isSchemaWithKey(A)) {
                    return (isSchemaWithKey(B) && A.key === B.key)
                }
                if (isSchemaConditionStatement(A) && isSchemaConditionStatement(B)) {
                    return A.if === B.if
                }
                if (isSchemaCondition(A) && isSchemaCondition(B)) {
                    return A.wrapperKey === B.wrapperKey
                }
                if (isSchemaReplace(A) && isSchemaReplace(B)) {
                    return A.wrapperKey === B.wrapperKey
                }
                if (isSchemaImport(A) && isSchemaImport(B)) {
                    return A.from === B.from
                }
                return deepEqual(A, B)
            },
            classify: ({ tag }) => (tag),
            merge: ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } }),
            orderIndependence: [['Description', 'Summary', 'Name', 'ShortName', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']],
            orderIndependenceIgnore: ['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove']
        })
    }

    override get tree() {
        const returnValue = removeWrapperKey(super.tree)
        return returnValue
    }

    override clone(): SchemaTagTree {
        const returnValue = new SchemaTagTree([])
        returnValue._tagList = this._tagList
        returnValue._actions = this._actions
        return returnValue
    }

    override reordered(orderGroups: TagTreePruneArgs<SchemaTag>[]): SchemaTagTree {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { reorder: orderGroups }]
        return returnValue
    }

    override filter(args: TagTreeFilterArguments<SchemaTag>): SchemaTagTree {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { filter: args }]
        return returnValue
    }

    override prune(args: TagTreePruneArgs<SchemaTag>): SchemaTagTree {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { prune: args }]
        return returnValue
    }

    override reorderedSiblings(orderSort: string[][]): SchemaTagTree {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { reorderSiblings: orderSort }]
        return returnValue
    }

}

export default SchemaTagTree
