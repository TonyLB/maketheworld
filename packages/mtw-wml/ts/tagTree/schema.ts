import { isSchemaWithKey, SchemaTag, isSchemaAsset } from "@tonylb/mtw-base/ts/schema"
import TagTree, { TagTreeFilterArguments, TagTreePruneArgs } from "."
import { deepEqual } from "../lib/objects"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { v4 as uuidv4 } from 'uuid'
import { isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaImport } from "@tonylb/mtw-base/ts/schema/metaData"

const addWrapperKey = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return tree.map((node) => {
        if (treeNodeTypeguard(isSchemaReplace)(node)) {
            return { ...node, data: { ...node.data, wrapperKey: node.data.wrapperKey ?? uuidv4() }, children: addWrapperKey(node.children) }
        }
        return { ...node, children: addWrapperKey(node.children) }
    })
}

const removeWrapperKey = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return tree.map((node) => {
        if (treeNodeTypeguard(isSchemaReplace)(node)) {
            const { wrapperKey, ...data } = node.data
            return { ...node, data, children: removeWrapperKey(node.children) }
        }
        return { ...node, children: removeWrapperKey(node.children) }
    })
}

export class SchemaTagTree extends TagTree<SchemaTag> {
    constructor(tree: GenericTree<SchemaTag>) {
        super({
            tree: addWrapperKey(tree),
            compare: ({ data: A }, { data: B }) => {
                if (isSchemaAsset(A)) {
                    return isSchemaAsset(B) && A.uuid === B.uuid
                }
                if (A.tag === 'Story') {
                    return B.tag === 'Story' && A.uuid === B.uuid
                }
                if (isSchemaWithKey(A)) {
                    if (!isSchemaWithKey(B)) {
                        return false
                    }
                    return Boolean(
                        (A.key && A.key === B.key) ||
                        ('uuid' in A && 'uuid' in B && A.uuid && A.uuid === B.uuid)
                    )
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
            merge: ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } as SchemaTag }),
            orderIndependence: [['Description', 'Summary', 'Name', 'DisplayName', 'ShortName', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']],
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
